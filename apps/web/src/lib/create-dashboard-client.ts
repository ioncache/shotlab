import {
  createMeticulousClient,
  type MeticulousClientOptions,
} from '../../../../packages/meticulous-client/src/index';

export function createDashboardClient(
  baseUrl: string,
  fetchImpl: MeticulousClientOptions['fetch'] = fetch,
) {
  return createMeticulousClient({
    baseUrl,
    fetch(input, init) {
      return fetchImpl(input, {
        ...init,
        cache: 'no-store',
      });
    },
  });
}
