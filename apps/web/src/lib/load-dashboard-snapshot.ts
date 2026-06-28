import type { MeticulousClient } from '../../../../packages/meticulous-client/src/index';
import { selectDashboardSnapshot } from './dashboard-selectors';

type ReadDashboardClient = Pick<
  MeticulousClient,
  'getHistory' | 'getLastProfile' | 'getMachine' | 'getSettings'
>;

export async function loadDashboardSnapshot(
  client: ReadDashboardClient,
) {
  const [machine, settings, history, lastProfile] = await Promise.all([
    client.getMachine(),
    client.getSettings(),
    client.getHistory(),
    client.getLastProfile(),
  ]);

  return selectDashboardSnapshot(machine, settings, history, lastProfile);
}
