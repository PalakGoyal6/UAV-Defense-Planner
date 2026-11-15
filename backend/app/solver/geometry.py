import math
from typing import Dict, List, Tuple
from app.models import Asset, CandidateSite, Scenario

EARTH_RADIUS_KM = 6371.0

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
    If site.depot_distance_km is explicitly set, uses it.
    Otherwise derives from depot coordinates in scenario.parameters.
    For grid mode: Euclidean distance * 10 km/grid-unit.
    For geo mode: Haversine distance in km.
    """
    if site.depot_distance_km is not None and site.depot_distance_km > 0:
        return float(site.depot_distance_km)

    params = scenario.parameters
    coord_mode = scenario.coordinate_mode
    site_coords = get_site_coords(site, coord_mode)

    if coord_mode == "geo":
        depot_lat = params.depot_lat if params.depot_lat is not None else 0.0
        depot_lon = params.depot_lon if params.depot_lon is not None else 0.0
        return haversine_distance(site_coords[0], site_coords[1], depot_lat, depot_lon)
    else:
        depot_x = params.depot_x if params.depot_x is not None else 0.0
        depot_y = params.depot_y if params.depot_y is not None else 0.0
        grid_dist = euclidean_distance(site_coords[0], site_coords[1], depot_x, depot_y)
        return grid_dist * 10.0  # specified 10 km per grid km rule
