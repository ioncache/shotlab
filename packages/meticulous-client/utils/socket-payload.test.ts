import { describe, expect, it } from 'vitest';

import {
  parseSocketPayloadMetrics,
  sanitizeNormalizedValue,
} from './socket-payload.ts';

describe('parseSocketPayloadMetrics', () => {
  it('extracts only finite numeric metrics from the first payload object', () => {
    expect(
      parseSocketPayloadMetrics([
        {
          p: 309,
          profile_time: 'NaN',
          sensors: { p: 0.33, t: 25.5, w: -276.97 },
          t_tube: 99,
          time: 0,
          weight_pred: 123,
        },
      ]),
    ).toStrictEqual({
      machineTime: 0,
      pressure: 0.33,
      temperature: 25.5,
      weight: -276.97,
    });
  });

  it('returns an empty object for invalid payloads', () => {
    expect(parseSocketPayloadMetrics(['bad payload'])).toStrictEqual({});
  });
});

describe('sanitizeNormalizedValue', () => {
  it('converts NaN sentinels and non-finite numbers to null recursively', () => {
    expect(
      sanitizeNormalizedValue({
        arr: ['NaN', Number.NaN, Number.POSITIVE_INFINITY],
        nested: { value: 'ok' },
      }),
    ).toStrictEqual({
      arr: [null, null, null],
      nested: { value: 'ok' },
    });
  });
});
