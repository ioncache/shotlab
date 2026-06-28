import { describe, expect, it } from 'vitest';
import { readIntegrationConfig } from './integration-config';

describe('readIntegrationConfig', () => {
  it('stays disabled when no integration env is set', () => {
    expect(readIntegrationConfig({})).toEqual({
      allowWriteTests: false,
      baseUrl: undefined,
      enabled: false,
      settingsPatch: undefined,
    });
  });

  it('enables read integration with a valid base url', () => {
    expect(
      readIntegrationConfig({
        METICULOUS_BASE_URL: 'http://machine.local:8080',
        METICULOUS_RUN_INTEGRATION: '1',
      }),
    ).toEqual({
      allowWriteTests: false,
      baseUrl: 'http://machine.local:8080',
      enabled: true,
      settingsPatch: undefined,
    });
  });

  it('parses write-test flags and json settings patches', () => {
    expect(
      readIntegrationConfig({
        METICULOUS_ALLOW_WRITE_TESTS: '1',
        METICULOUS_BASE_URL: 'http://machine.local:8080',
        METICULOUS_RUN_INTEGRATION: '1',
        METICULOUS_SETTINGS_PATCH_JSON: '{"auto_preheat":false}',
      }),
    ).toEqual({
      allowWriteTests: true,
      baseUrl: 'http://machine.local:8080',
      enabled: true,
      settingsPatch: {
        auto_preheat: false,
      },
    });
  });

  it('rejects invalid boolean flags', () => {
    expect(() =>
      readIntegrationConfig({
        METICULOUS_RUN_INTEGRATION: 'true',
      }),
    ).toThrow('METICULOUS_RUN_INTEGRATION must be "0" or "1" when set');
  });

  it('rejects enabled integration without a base url', () => {
    expect(() =>
      readIntegrationConfig({
        METICULOUS_RUN_INTEGRATION: '1',
      }),
    ).toThrow(
      'METICULOUS_BASE_URL is required when METICULOUS_RUN_INTEGRATION=1',
    );
  });

  it('rejects invalid base urls', () => {
    expect(() =>
      readIntegrationConfig({
        METICULOUS_BASE_URL: 'not-a-url',
        METICULOUS_RUN_INTEGRATION: '1',
      }),
    ).toThrow('METICULOUS_BASE_URL must be a valid URL');
  });

  it('rejects invalid settings patch json', () => {
    expect(() =>
      readIntegrationConfig({
        METICULOUS_BASE_URL: 'http://machine.local:8080',
        METICULOUS_RUN_INTEGRATION: '1',
        METICULOUS_SETTINGS_PATCH_JSON: '{',
      }),
    ).toThrow('METICULOUS_SETTINGS_PATCH_JSON must be valid JSON when set');
  });

  it('rejects non-object settings patches', () => {
    expect(() =>
      readIntegrationConfig({
        METICULOUS_BASE_URL: 'http://machine.local:8080',
        METICULOUS_RUN_INTEGRATION: '1',
        METICULOUS_SETTINGS_PATCH_JSON: '["bad"]',
      }),
    ).toThrow('METICULOUS_SETTINGS_PATCH_JSON must decode to a JSON object');
  });
});
