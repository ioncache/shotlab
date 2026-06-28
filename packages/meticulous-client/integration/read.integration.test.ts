import { beforeAll, describe, expect, it } from 'vitest';
import { createMeticulousClient, type MeticulousClient } from '../src/index';
import { readIntegrationConfig } from '../src/integration-config';

type ReadClient = Pick<
  MeticulousClient,
  | 'getCurrentHistory'
  | 'getHistory'
  | 'getLastHistory'
  | 'getLastProfile'
  | 'getMachine'
  | 'getProfile'
  | 'getSettings'
  | 'listProfiles'
>;

const integrationConfig = readIntegrationConfig();
const describeIfConfigured =
  integrationConfig.enabled && integrationConfig.baseUrl
    ? describe
    : describe.skip;

describeIfConfigured('Meticulous REST read endpoints', () => {
  const client = createMeticulousClient({
    baseUrl: integrationConfig.baseUrl ?? 'http://127.0.0.1:8080',
  }) as ReadClient;
  let profiles: Array<Record<string, unknown>> = [];
  let firstProfileId: string | undefined;

  beforeAll(async () => {
    profiles = await client.listProfiles();
    const firstProfile = profiles[0];
    firstProfileId =
      typeof firstProfile?.id === 'string' ? firstProfile.id : undefined;
  });

  it('reads machine information', async () => {
    const machine = await client.getMachine();

    expect(machine).toEqual(expect.any(Object));
    expect(
      machine.firmware ??
        machine.software_version ??
        machine.image_version ??
        machine.server,
    ).toBeDefined();
  });

  it('reads settings', async () => {
    const settings = await client.getSettings();

    expect(settings).toEqual(expect.any(Object));
  });

  it('reads profile summaries', async () => {
    expect(Array.isArray(profiles)).toBe(true);
  });

  it('reads full profile summaries', async () => {
    const fullProfiles = await client.listProfiles({ full: true });

    expect(Array.isArray(fullProfiles)).toBe(true);
  });

  it('reads history', async () => {
    const history = await client.getHistory();

    expect(history).toEqual(expect.any(Object));
    expect(Array.isArray(history.history)).toBe(true);
  });

  it('reads current history', async () => {
    const history = await client.getCurrentHistory();

    expect(history).toEqual(expect.any(Object));
  });

  it('reads last history entry', async () => {
    const history = await client.getLastHistory();

    expect(history).toEqual(expect.any(Object));
  });

  it('reads the last profile when available', async () => {
    const profile = await client.getLastProfile();

    expect(profile).toEqual(expect.any(Object));
  });

  it('reads a full profile when the machine returns a profile id', async (ctx) => {
    if (!firstProfileId) {
      ctx.skip();
      return;
    }

    const profile = await client.getProfile(firstProfileId);

    expect(profile).toEqual(expect.any(Object));
    expect(profile.id).toBe(firstProfileId);
  });
});
