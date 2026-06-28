import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMeticulousClient } from '../src/index';
import { readIntegrationConfig } from '../src/integration-config';

type WriteClient = {
  getSettings: () => Promise<Record<string, unknown>>;
  listProfiles: () => Promise<Array<Record<string, unknown>>>;
  loadProfile: (id: string) => Promise<Record<string, unknown>>;
  preheat: () => Promise<Record<string, unknown>>;
  tare: () => Promise<void>;
  triggerAction: (name: string) => Promise<Record<string, unknown>>;
  updateSettings: (
    patch: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
};

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
  }) as unknown as WriteClient;
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
    await client.triggerAction('stop').catch(() => undefined);
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
      await client.triggerAction('stop').catch(() => undefined);
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
      await client.triggerAction('stop').catch(() => undefined);
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
