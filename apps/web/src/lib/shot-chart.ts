import type { DashboardMetric, DashboardShot } from './dashboard-types';

export interface ShotChartSeries {
  flow: Array<number | null>;
  gravimetricFlow: Array<number | null>;
  pressure: Array<number | null>;
  time: number[];
  weight: Array<number | null>;
}

export interface ShotPointDetails {
  metrics: DashboardMetric[];
  time: string;
}

export interface ShotChartSummary {
  subtitle: string;
  title: string;
}

export function buildShotChartSummary(shot: DashboardShot): ShotChartSummary {
  return {
    subtitle: [
      formatSeconds(shot.durationSeconds),
      formatGrams(shot.yieldGrams),
    ].join(' • '),
    title: `${shot.profile} • ${shot.brewedAt}`,
  };
}

export function getShotChartSeries(shot: DashboardShot): ShotChartSeries {
  return {
    flow: shot.points.map((point) => point.flow),
    gravimetricFlow: shot.points.map((point) => point.gravimetricFlow),
    pressure: shot.points.map((point) => point.pressure),
    time: shot.points.map((point) => point.second),
    weight: shot.points.map((point) => point.weight),
  };
}

export function selectShotPointIndex(
  shot: DashboardShot,
  selectedPointIndex?: number,
): number {
  if (shot.points.length === 0) {
    return -1;
  }

  if (selectedPointIndex === undefined) {
    return shot.points.length - 1;
  }

  return Math.max(0, Math.min(selectedPointIndex, shot.points.length - 1));
}

export function getShotPointDetails(
  shot: DashboardShot,
  selectedPointIndex?: number,
): ShotPointDetails {
  const point = shot.points[selectShotPointIndex(shot, selectedPointIndex)];

  return {
    metrics: [
      { label: 'Pressure', value: formatUnit(point?.pressure, 'bar') },
      { label: 'Flow', value: formatUnit(point?.flow, 'ml/s') },
      { label: 'Grav. flow', value: formatUnit(point?.gravimetricFlow, 'g/s') },
      { label: 'Weight', value: formatUnit(point?.weight, 'g') },
    ],
    time: formatSeconds(point?.second ?? null),
  };
}

function formatGrams(value: number | null): string {
  return formatUnit(value, 'g');
}

function formatSeconds(value: number | null): string {
  return formatUnit(value, 's');
}

function formatUnit(value: number | null, unit: string): string {
  return value === null || value === undefined ? 'Unavailable' : `${value} ${unit}`;
}
