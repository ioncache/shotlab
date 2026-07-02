import { describe, expect, it } from 'vitest';

import type {
  BrewCoreMetrics,
  HistoryShotSetpoints,
  KnownMeticulousSocketEvent,
  LiveSensorsEventPayload,
  MachinePhaseSetpoints,
  MeticulousSocketEvent,
} from './index';

describe('live socket types', () => {
  it('allows shared setpoint fields to flow into history-oriented shapes', () => {
    const shared: MachinePhaseSetpoints = {
      active: 'pressure',
      flow: 3.2,
      power: 42,
      pressure: 8.7,
      temperature: 93.5,
    };
    const historySetpoints: HistoryShotSetpoints = shared;

    expect(historySetpoints).toMatchObject({
      active: 'pressure',
      flow: 3.2,
      power: 42,
      pressure: 8.7,
    });
  });

  it('keeps the core brew metrics reusable across live payloads', () => {
    const metrics: BrewCoreMetrics = {
      f: 1.8,
      g: 1.6,
      p: 8.9,
      t: 92.4,
      w: 18.2,
    };
    const sensors: LiveSensorsEventPayload = {
      ...metrics,
      a_0: 49,
      a_1: 49,
      a_2: 49,
      a_3: 49,
      bh_cur: 0.05,
      bh_pwr: 0,
      lam_temp: 26.4,
      m_cur: 0,
      m_pos: 75.9,
      m_pwr: 0,
      m_spd: 0,
      motor_temp: 'NaN',
      t_bar_down: 24.2,
      t_bar_md: 24.3,
      t_bar_mu: 24.5,
      t_bar_up: 24.5,
      t_ext_1: 23.2,
      t_ext_2: 23.3,
      t_motor_temp: 25.8,
      t_tube: 24.4,
      w_stat: true,
      weight_pred: -282.02,
    };

    expect(sensors.p).toBe(8.9);
    expect(sensors.w).toBe(18.2);
  });

  it('treats known live events as compatible with the generic socket event shape', () => {
    const event: KnownMeticulousSocketEvent = {
      event: 'heater_status',
      payload: [0],
    };
    const genericEvent: MeticulousSocketEvent = event;

    expect(genericEvent).toEqual({
      event: 'heater_status',
      payload: [0],
    });
  });
});
