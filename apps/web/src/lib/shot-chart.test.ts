import { describe, expect, it } from 'vitest';
import {
  buildShotChartSummary,
  getShotChartSeries,
  getShotPointDetails,
  isShotReplayAvailable,
  readShotReplayDurationMs,
  readShotReplayElapsedMs,
  selectShotPointIndex,
  selectShotReplayPointIndex,
  stepShotPointIndex,
} from './shot-chart';
import type { DashboardShot } from './dashboard-types';

const shot: DashboardShot = {
  brewedAt: '2026-06-28 11:59',
  doseGrams: 18,
  durationSeconds: 21.684,
  id: 'shot-1',
  points: [
    {
      flow: 2.58,
      gravimetricFlow: 0,
      pressure: 0,
      second: 0.002,
      temperatureCelsius: 100.65,
      weight: 0,
    },
    {
      flow: 3.55,
      gravimetricFlow: 3.22,
      pressure: 5.99,
      second: 9.573,
      temperatureCelsius: 109.27,
      weight: 27.51,
    },
    {
      flow: 0,
      gravimetricFlow: 0.02,
      pressure: 0,
      second: 21.684,
      temperatureCelsius: 95.4,
      weight: 51.37,
    },
  ],
  profile: 'Low Contact',
  source: 'history',
  yieldGrams: 51.37,
};

describe('buildShotChartSummary', () => {
  it('formats the chart title and subtitle from the selected shot', () => {
    expect(buildShotChartSummary(shot)).toEqual({
      subtitle: '21.68 s • 51.37 g',
      title: 'Low Contact • 2026-06-28 11:59',
    });
  });
});

describe('getShotChartSeries', () => {
  it('returns the four requested chart series on a shared time axis', () => {
    expect(getShotChartSeries(shot)).toEqual({
      flow: [2.58, 3.55, 0],
      gravimetricFlow: [0, 3.22, 0.02],
      pressure: [0, 5.99, 0],
      time: [0.002, 9.573, 21.684],
      weight: [0, 27.51, 51.37],
    });
  });
});

describe('selectShotPointIndex', () => {
  it('defaults to the final point when there is no active selection', () => {
    expect(selectShotPointIndex(shot)).toBe(2);
  });

  it('clamps out-of-range selected indexes back into the shot', () => {
    expect(selectShotPointIndex(shot, -10)).toBe(0);
    expect(selectShotPointIndex(shot, 999)).toBe(2);
  });
});

describe('isShotReplayAvailable', () => {
  it('only enables replay for multi-point history shots', () => {
    expect(isShotReplayAvailable(shot)).toBe(true);
    expect(
      isShotReplayAvailable({
        ...shot,
        points: [shot.points[0]],
      }),
    ).toBe(false);
    expect(
      isShotReplayAvailable({
        ...shot,
        source: 'live',
      }),
    ).toBe(false);
  });
});

describe('stepShotPointIndex', () => {
  it('moves one step and stays within the available point range', () => {
    expect(stepShotPointIndex(shot, 1, -1)).toBe(0);
    expect(stepShotPointIndex(shot, 1, 1)).toBe(2);
    expect(stepShotPointIndex(shot, 2, 1)).toBe(2);
  });
});

describe('replay timing helpers', () => {
  it('reads the total replay duration from the declared shot duration', () => {
    expect(readShotReplayDurationMs(shot)).toBe(21684);
  });

  it('scales replay timing to match the declared shot duration', () => {
    const sparseShot: DashboardShot = {
      ...shot,
      durationSeconds: 18,
      points: [
        { ...shot.points[0], second: 0 },
        { ...shot.points[1], second: 1 },
        { ...shot.points[2], second: 3 },
      ],
    };

    expect(readShotReplayDurationMs(sparseShot)).toBe(18000);
    expect(readShotReplayElapsedMs(sparseShot, 0)).toBe(0);
    expect(readShotReplayElapsedMs(sparseShot, 1)).toBe(6000);
    expect(readShotReplayElapsedMs(sparseShot, 2)).toBe(18000);
    expect(selectShotReplayPointIndex(sparseShot, 0)).toBe(0);
    expect(selectShotReplayPointIndex(sparseShot, 5999)).toBe(0);
    expect(selectShotReplayPointIndex(sparseShot, 6000)).toBe(1);
    expect(selectShotReplayPointIndex(sparseShot, 17999)).toBe(1);
    expect(selectShotReplayPointIndex(sparseShot, 18000)).toBe(2);
  });

  it('falls back to the recorded span when the declared duration is zero', () => {
    const zeroDurationShot: DashboardShot = {
      ...shot,
      durationSeconds: 0,
      points: [
        { ...shot.points[0], second: 0 },
        { ...shot.points[1], second: 1 },
        { ...shot.points[2], second: 3 },
      ],
    };

    expect(readShotReplayDurationMs(zeroDurationShot)).toBe(3000);
    expect(readShotReplayElapsedMs(zeroDurationShot, 1)).toBe(1000);
    expect(selectShotReplayPointIndex(zeroDurationShot, 999)).toBe(0);
    expect(selectShotReplayPointIndex(zeroDurationShot, 1000)).toBe(1);
    expect(selectShotReplayPointIndex(zeroDurationShot, 3000)).toBe(2);
  });
});

describe('getShotPointDetails', () => {
  it('returns the selected timestamp values for the chart legend and inspector', () => {
    expect(getShotPointDetails(shot, 1)).toEqual({
      metrics: [
        { label: 'Pressure', value: '5.99 bar' },
        { label: 'Flow', value: '3.55 ml/s' },
        { label: 'Grav. flow', value: '3.22 g/s' },
        { label: 'Weight', value: '27.51 g' },
      ],
      time: '9.57 s',
    });
  });
});
