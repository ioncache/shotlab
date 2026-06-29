import {
  createMeticulousClient,
  type MeticulousClientOptions,
} from '@shotlab/meticulous-client';

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
