import type { ShotPointDetails } from './shot-chart';

export type ChartSource = 'history' | 'live';

export const DEFAULT_CHART_POINT_DETAILS: ShotPointDetails = {
  metrics: [
    { label: 'Pressure', value: '0 bar' },
    { label: 'Flow', value: '0 ml/s' },
    { label: 'Grav. flow', value: '0 g/s' },
    { label: 'Weight', value: '0 g' },
  ],
  time: '0 s',
};

export function resolveMachineAssetUrl(
  baseUrl: string | undefined,
  assetUrl: string,
): string {
  if (!baseUrl) {
    return assetUrl;
  }

  try {
    return new URL(assetUrl, baseUrl).toString();
  } catch {
    return assetUrl;
  }
}

export function formatGrams(value: number | null): string {
  return formatUnit(value, 'g');
}

export function formatCelsius(value: number | null): string {
  return formatUnit(value, 'C');
}

export function formatSeconds(value: number | null): string {
  return formatUnit(value, 's');
}

export function readSourceEmptyText(source: ChartSource): string {
  return source === 'live' ? 'No brew in process...' : 'No shot loaded.';
}

export function readSourceLabel(source: ChartSource): string {
  return source === 'live' ? 'Live brew' : 'Selected shot';
}

function formatUnit(value: number | null, unit: string): string {
  return value === null || value === undefined
    ? 'Unavailable'
    : `${value.toFixed(2)} ${unit}`;
}
