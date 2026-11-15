import {
  Scenario, ScenarioListItem, FullPlanResponse,
  SensitivityResponse, CoordinateMode
} from '../types/defense';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

export async function fetchScenarios(): Promise<ScenarioListItem[]> {
  const res = await fetch(`${BASE_URL}/scenarios`);
  if (!res.ok) throw new Error(`Failed to fetch scenarios: ${res.statusText}`);
  return res.json();
}

export async function fetchScenario(id: string): Promise<Scenario> {
  const res = await fetch(`${BASE_URL}/scenarios/${id}`);
  if (!res.ok) throw new Error(`Failed to load scenario: ${res.statusText}`);
  return res.json();
}

export async function createScenario(scenario: Scenario): Promise<{ id: string; name: string }> {
  const res = await fetch(`${BASE_URL}/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  if (!res.ok) throw new Error(`Failed to save scenario: ${res.statusText}`);
  return res.json();
}

export async function updateScenario(id: string, scenario: Scenario): Promise<{ id: string; name: string }> {
  const res = await fetch(`${BASE_URL}/scenarios/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  if (!res.ok) throw new Error(`Failed to update scenario: ${res.statusText}`);
  return res.json();
}

export async function deleteScenario(id: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/scenarios/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete scenario: ${res.statusText}`);
}

export async function duplicateScenario(id: string): Promise<Scenario> {
  const res = await fetch(`${BASE_URL}/scenarios/${id}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to duplicate scenario: ${res.statusText}`);
  return res.json();
}

export async function solvePlan(scenario: Scenario): Promise<FullPlanResponse> {
  const res = await fetch(`${BASE_URL}/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Solver encountered an error');
  }
  return res.json();
}

export async function solveMultiRegion(scenario: Scenario, customBudgets?: Record<string, number>): Promise<FullPlanResponse> {
  const res = await fetch(`${BASE_URL}/solve/multi-region`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario, custom_budgets: customBudgets }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Multi-region solver encountered an error');
  }
  return res.json();
}

export async function fetchCoverageMatrix(scenario: Scenario): Promise<{
  coverage: Record<string, Record<string, number>>;
  distances: Record<string, Record<string, number>>;
  coordinate_mode: CoordinateMode;
}> {
  const res = await fetch(`${BASE_URL}/coverage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenario),
  });
  if (!res.ok) throw new Error('Failed to compute coverage matrix');
  return res.json();
}

export async function runSensitivityApi(payload: any): Promise<SensitivityResponse> {
  const res = await fetch(`${BASE_URL}/sensitivity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Sensitivity sweep failed');
  }
  return res.json();
}

export async function generateSyntheticApi(req: any): Promise<Scenario> {
  const res = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error('Failed to generate synthetic scenario');
  return res.json();
}

export async function importScenarioApi(data: any): Promise<Scenario> {
  const res = await fetch(`${BASE_URL}/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Import failed' }));
    throw new Error(err.detail || 'Failed to import scenario');
  }
  return res.json();
}

export async function fetchIndiaGeoJson(): Promise<any> {
  try {
    const res = await fetch('/geo/india_states.geojson');
    if (res.ok) return await res.json();
  } catch (err) {
    // fallback to backend API
  }
  const apiRes = await fetch(`${BASE_URL}/geo/states`);
  if (!apiRes.ok) throw new Error('Failed to load India boundary GeoJSON');
  return apiRes.json();
}
