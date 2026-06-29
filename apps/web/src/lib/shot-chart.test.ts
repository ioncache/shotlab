import { describe, expect, it } from 'vitest';
import {
  buildShotChartSummary,
  getShotChartSeries,
  getShotPointDetails,
  selectShotPointIndex,
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
  yieldGrams: 51.37,
};

describe('buildShotChartSummary', () => {
  it('formats the chart title and subtitle from the selected shot', () => {
    expect(buildShotChartSummary(shot)).toEqual({
      subtitle: '21.684 s • 51.37 g',
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

describe('getShotPointDetails', () => {
  it('returns the selected timestamp values for the chart legend and inspector', () => {
    expect(getShotPointDetails(shot, 1)).toEqual({
      metrics: [
        { label: 'Pressure', value: '5.99 bar' },
        { label: 'Flow', value: '3.55 ml/s' },
        { label: 'Grav. flow', value: '3.22 g/s' },
        { label: 'Weight', value: '27.51 g' },
      ],
      time: '9.573 s',
    });
  });
});
