import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createMeticulousClient,
  METICULOUS_ACTIONS,
  type MeticulousClient,
} from '../src/index';
import { readIntegrationConfig } from '../src/integration-config';

type WriteClient = Pick<
  MeticulousClient,
  | 'getSettings'
  | 'listProfiles'
  | 'loadProfile'
  | 'preheat'
  | 'tare'
  | 'triggerAction'
  | 'updateSettings'
>;

const integrationConfig = readIntegrationConfig();
const describeIfConfigured =
  integrationConfig.enabled &&
  integrationConfig.baseUrl &&
  integrationConfig.allowWriteTests
    ? describe
    : describe.skip;

describeIfConfigured('Meticulous REST write endpoints', () => {
  const client = createMeticulousClient({
    baseUrl: integrationConfig.baseUrl ?? 'http://127.0.0.1:8080',
  }) as WriteClient;
  let firstProfileId: string | undefined;
  let settingsPatch: Record<string, unknown> | undefined;

  beforeAll(async () => {
    const profiles = await client.listProfiles();
    const firstProfile = profiles[0];
    firstProfileId =
      typeof firstProfile?.id === 'string' ? firstProfile.id : undefined;

    const settings = await client.getSettings();
    settingsPatch =
      integrationConfig.settingsPatch ?? deriveSettingsPatch(settings);
  });

  // ponytail: best-effort neutral reset at the end of the write suite; tests
  // that can leave active state also stop in a finally block.
  afterAll(async () => {
    await client.triggerAction(METICULOUS_ACTIONS.STOP).catch(() => undefined);
  });

  it('posts tare', async () => {
    await expect(client.tare()).resolves.toBeUndefined();
  });

  it('loads a profile when the machine returns a profile id', async (ctx) => {
    if (!firstProfileId) {
      ctx.skip();
      return;
    }

    try {
      const result = await client.loadProfile(firstProfileId);

      expect(result).toEqual(expect.any(Object));
    } finally {
      await client
        .triggerAction(METICULOUS_ACTIONS.STOP)
        .catch(() => undefined);
    }
  });

  it('updates settings when a safe patch is available', async (ctx) => {
    if (!settingsPatch) {
      ctx.skip();
      return;
    }

    const result = await client.updateSettings(settingsPatch);

    expect(result).toEqual(expect.any(Object));
  });

  it('runs preheat through the generic action endpoint', async () => {
    try {
      const result = await client.preheat();

      expect(result).toEqual(expect.any(Object));
    } finally {
      await client
        .triggerAction(METICULOUS_ACTIONS.STOP)
        .catch(() => undefined);
    }
  });
});

function deriveSettingsPatch(
  settings: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (typeof settings.enable_sounds === 'boolean') {
    return { enable_sounds: settings.enable_sounds };
  }

  if (typeof settings.clock_format_24_hour === 'boolean') {
    return { clock_format_24_hour: settings.clock_format_24_hour };
  }

  return undefined;
}
