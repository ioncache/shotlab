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

export interface ShotChartExtents {
  brewMax: number;
  weightMax: number;
}

export function isShotReplayAvailable(shot: DashboardShot): boolean {
  return shot.source === 'history' && shot.points.length > 1;
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

export function getShotChartExtents(shot: DashboardShot): ShotChartExtents {
  let brewMax = 0;
  let weightMax = 0;

  for (const point of shot.points) {
    brewMax = Math.max(
      brewMax,
      point.flow ?? 0,
      point.gravimetricFlow ?? 0,
      point.pressure ?? 0,
    );
    weightMax = Math.max(weightMax, point.weight ?? 0);
  }

  return {
    brewMax: brewMax > 0 ? brewMax : 1,
    weightMax: weightMax > 0 ? weightMax : 1,
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

export function stepShotPointIndex(
  shot: DashboardShot,
  selectedPointIndex: number | undefined,
  step: number,
): number {
  return selectShotPointIndex(
    shot,
    selectShotPointIndex(shot, selectedPointIndex) + step,
  );
}

export function readShotReplayDurationMs(shot: DashboardShot): number {
  const firstSecond = shot.points[0]?.second;
  const lastSecond = shot.points.at(-1)?.second;

  if (
    shot.durationSeconds !== null &&
    shot.durationSeconds !== undefined &&
    shot.durationSeconds > 0
  ) {
    return Math.round(shot.durationSeconds * 1000);
  }

  if (
    firstSecond === undefined ||
    lastSecond === undefined ||
    lastSecond <= firstSecond
  ) {
    return 0;
  }

  return Math.round((lastSecond - firstSecond) * 1000);
}

export function readShotReplayElapsedMs(
  shot: DashboardShot,
  selectedPointIndex: number | undefined,
): number {
  const currentIndex = selectShotPointIndex(shot, selectedPointIndex);
  const currentPoint = shot.points[currentIndex];
  const firstSecond = shot.points[0]?.second;

  if (!currentPoint || firstSecond === undefined) {
    return 0;
  }

  const replayScale = readShotReplayScale(shot);

  return Math.max(
    0,
    Math.round((currentPoint.second - firstSecond) * 1000 * replayScale),
  );
}

export function selectShotReplayPointIndex(
  shot: DashboardShot,
  elapsedMs: number,
): number {
  const replayDurationMs = readShotReplayDurationMs(shot);
  if (replayDurationMs <= 0) {
    return selectShotPointIndex(shot);
  }

  const clampedElapsedMs = Math.max(0, Math.min(elapsedMs, replayDurationMs));
  let nextIndex = 0;

  for (let index = 0; index < shot.points.length; index += 1) {
    if (readShotReplayElapsedMs(shot, index) <= clampedElapsedMs) {
      nextIndex = index;
      continue;
    }

    break;
  }

  return nextIndex;
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
  return value === null || value === undefined
    ? 'Unavailable'
    : `${value.toFixed(2)} ${unit}`;
}

function readShotReplayScale(shot: DashboardShot): number {
  const firstSecond = shot.points[0]?.second;
  const lastSecond = shot.points.at(-1)?.second;

  if (
    shot.durationSeconds === null ||
    shot.durationSeconds === undefined ||
    shot.durationSeconds <= 0 ||
    firstSecond === undefined ||
    lastSecond === undefined
  ) {
    return 1;
  }

  const recordedSpanSeconds = lastSecond - firstSecond;
  if (recordedSpanSeconds <= 0) {
    return 1;
  }

  return shot.durationSeconds / recordedSpanSeconds;
}
