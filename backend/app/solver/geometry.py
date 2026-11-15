import json
import math
import os
from typing import Any, Dict, List, Optional, Tuple
from shapely.geometry import Point, shape
from shapely.prepared import prep

from app.models import Asset, CandidateSite, Scenario, Depot

EARTH_RADIUS_KM = 6371.0

_CACHED_INDIA_GEOJSON: Optional[Dict[str, Any]] = None
_CACHED_STATE_GEOMS: Optional[List[Tuple[str, Any, Any, Tuple[float, float, float, float]]]] = None

def get_india_geojson() -> Dict[str, Any]:
    global _CACHED_INDIA_GEOJSON
    if _CACHED_INDIA_GEOJSON is None:
        geojson_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "india_states.geojson")
        with open(geojson_path, "r", encoding="utf-8") as f:
            _CACHED_INDIA_GEOJSON = json.load(f)
    return _CACHED_INDIA_GEOJSON

def get_state_geometries():
    """
    Returns cached list of (state_name, shapely_geom, prepared_geom, (minx, miny, maxx, maxy))
    """
    global _CACHED_STATE_GEOMS
    if _CACHED_STATE_GEOMS is None:
        gj = get_india_geojson()
        geoms = []
        for feat in gj.get("features", []):
            st_name = feat.get("properties", {}).get("state_name", "Unknown")
            geom = shape(feat["geometry"])
            prepared = prep(geom)
            bounds = geom.bounds  # (minx, miny, maxx, maxy) -> (min_lon, min_lat, max_lon, max_lat)
            geoms.append((st_name, geom, prepared, bounds))
        _CACHED_STATE_GEOMS = geoms
    return _CACHED_STATE_GEOMS

def find_state_for_point(lat: Optional[float], lon: Optional[float]) -> str:
    """
    Identifies the Indian State/UT for given (lat, lon) coordinates using
    Survey of India compliant boundary polygons. Returns 'Outside India' if outside.
    """
    if lat is None or lon is None:
        return "Outside India"
    
    # Rapid bounding box check for whole India first
    if not (6.0 <= lat <= 38.0 and 68.0 <= lon <= 98.0):
        return "Outside India"

    pt = Point(lon, lat)
    state_geoms = get_state_geometries()
    for st_name, geom, prepared, bounds in state_geoms:
        min_lon, min_lat, max_lon, max_lat = bounds
        if not (min_lon <= lon <= max_lon and min_lat <= lat <= max_lat):
            continue
        if prepared.contains(pt) or geom.covers(pt):
            return st_name

    return "Outside India"

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes great-circle distance between two points in km using Haversine formula.
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return EARTH_RADIUS_KM * c

def euclidean_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """
    Computes 2D Euclidean distance in km.
    """
    return math.hypot(x2 - x1, y2 - y1)

def compute_distance(
    coordinate_mode: str,
    p1: Tuple[float, float],
    p2: Tuple[float, float]
) -> float:
    """
    Computes distance between p1 and p2 based on coordinate mode ('grid' or 'geo').
    For 'grid', coords are (x, y). For 'geo', coords are (lat, lon).
    """
    if coordinate_mode == "geo":
        return haversine_distance(p1[0], p1[1], p2[0], p2[1])
    return euclidean_distance(p1[0], p1[1], p2[0], p2[1])

def get_asset_coords(asset: Asset, coordinate_mode: str) -> Tuple[float, float]:
    if coordinate_mode == "geo":
        lat = asset.lat if asset.lat is not None else 0.0
        lon = asset.lon if asset.lon is not None else 0.0
        return (lat, lon)
    x = asset.x if asset.x is not None else 0.0
    y = asset.y if asset.y is not None else 0.0
    return (x, y)

def get_site_coords(site: CandidateSite, coordinate_mode: str) -> Tuple[float, float]:
    if coordinate_mode == "geo":
        lat = site.lat if site.lat is not None else 0.0
        lon = site.lon if site.lon is not None else 0.0
        return (lat, lon)
    x = site.x if site.x is not None else 0.0
    y = site.y if site.y is not None else 0.0
    return (x, y)

def compute_coverage_matrix(
    scenario: Scenario
) -> Tuple[Dict[str, Dict[str, int]], Dict[str, Dict[str, float]]]:
    """
    Calculates coverage matrix a_ij:
    a_ij = 1 if distance(asset_i, site_j) <= range_km_j, else 0.
    Applies any user overrides stored in scenario.coverage_overrides ('assetId_siteId': 0 or 1).
    Returns (coverage_matrix, distance_matrix).
    coverage_matrix[asset_id][site_id] = 1 or 0
    distance_matrix[asset_id][site_id] = distance in km
    """
    coord_mode = scenario.coordinate_mode
    coverage: Dict[str, Dict[str, int]] = {}
    distances: Dict[str, Dict[str, float]] = {}

    for asset in scenario.assets:
        a_id = asset.id
        coverage[a_id] = {}
        distances[a_id] = {}
        a_coords = get_asset_coords(asset, coord_mode)

        for site in scenario.sites:
            s_id = site.id
            s_coords = get_site_coords(site, coord_mode)
            dist = compute_distance(coord_mode, a_coords, s_coords)
            distances[a_id][s_id] = round(dist, 4)

            # Auto coverage condition
            is_covered = 1 if dist <= (site.range_km + 1e-7) else 0

            # Check override
            override_key = f"{a_id}_{s_id}"
            if override_key in scenario.coverage_overrides:
                is_covered = int(scenario.coverage_overrides[override_key])

            coverage[a_id][s_id] = is_covered

    return coverage, distances

def compute_depot_distance(
    site: CandidateSite,
    scenario: Scenario
) -> float:
    """
    Computes distance to logistics replenishment depot.
    If scenario.depots has depots, finds the distance to the nearest depot.
    Otherwise, if site.depot_distance_km is explicitly set, uses it.
    Otherwise derives from depot coordinates in scenario.parameters.
    For grid mode: Euclidean distance * 10 km/grid-unit.
    For geo mode: Haversine distance in km.
    """
    coord_mode = scenario.coordinate_mode
    site_coords = get_site_coords(site, coord_mode)

    # 1. If scenario has multiple depots, compute min distance to nearest depot
    if scenario.depots:
        min_dist = float("inf")
        for depot in scenario.depots:
            if coord_mode == "geo":
                d_lat = depot.lat if depot.lat is not None else 0.0
                d_lon = depot.lon if depot.lon is not None else 0.0
                dist = haversine_distance(site_coords[0], site_coords[1], d_lat, d_lon)
            else:
                d_x = depot.x if depot.x is not None else 0.0
                d_y = depot.y if depot.y is not None else 0.0
                dist = euclidean_distance(site_coords[0], site_coords[1], d_x, d_y) * 10.0
            if dist < min_dist:
                min_dist = dist
        if min_dist != float("inf"):
            return round(min_dist, 2)

    # 2. Check site-level override
    if site.depot_distance_km is not None and site.depot_distance_km > 0:
        return float(site.depot_distance_km)

    # 3. Fallback to scenario parameters depot
    params = scenario.parameters
    if coord_mode == "geo":
        depot_lat = params.depot_lat if params.depot_lat is not None else 0.0
        depot_lon = params.depot_lon if params.depot_lon is not None else 0.0
        return round(haversine_distance(site_coords[0], site_coords[1], depot_lat, depot_lon), 2)
    else:
        depot_x = params.depot_x if params.depot_x is not None else 0.0
        depot_y = params.depot_y if params.depot_y is not None else 0.0
        grid_dist = euclidean_distance(site_coords[0], site_coords[1], depot_x, depot_y)
        return round(grid_dist * 10.0, 2)  # specified 10 km per grid km rule
