export type JsonObject = Record<string, unknown>;

export interface MeticulousClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export type MachineInfo = JsonObject;

export interface MeticulousClient {
  getMachine(): Promise<MachineInfo>;
  tare(): Promise<void>;
}

export class MeticulousHttpError extends Error {
  readonly body: string;
  readonly status: number;
  readonly statusText: string;

  constructor(response: Response, body: string) {
    super(
      `Meticulous API request failed: ${response.status} ${response.statusText}`,
    );
    this.name = 'MeticulousHttpError';
    this.body = body;
    this.status = response.status;
    this.statusText = response.statusText;
  }
}

export function createMeticulousClient(
  options: MeticulousClientOptions,
): MeticulousClient {
  const baseUrl = normalizeApiBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? fetch;

  async function request<T = void>(
    path: string,
    init: RequestInit = { method: 'GET' },
  ): Promise<T> {
    const response = await fetchImpl(`${baseUrl}/${path}`, init);
    const body = await response.text();

    if (!response.ok) {
      throw new MeticulousHttpError(response, body);
    }

    if (body.length === 0) {
      return undefined as T;
    }

    return JSON.parse(body) as T;
  }

  return {
    getMachine: () => request<MachineInfo>('machine'),
    tare: async () => {
      await request('action/tare', { method: 'POST' });
    },
  };
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.search || url.hash) {
    throw new Error('baseUrl must not include a query string or fragment');
  }
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname.endsWith('/api/v1')) {
    url.pathname = pathname;
  } else {
    url.pathname = `${pathname}/api/v1`;
  }

  return url.toString().replace(/\/+$/, '');
}
