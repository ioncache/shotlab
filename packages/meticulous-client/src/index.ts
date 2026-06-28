export type JsonObject = Record<string, unknown>;
export type JsonArray = unknown[];

export interface MeticulousClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export type MachineInfo = JsonObject;
export type HistoryResponse = JsonObject;
export type Profile = JsonObject;
export type Settings = JsonObject;

export interface ListProfilesOptions {
  full?: boolean;
}

export interface MeticulousClient {
  getCurrentHistory(): Promise<HistoryResponse>;
  getHistory(): Promise<HistoryResponse>;
  getLastHistory(): Promise<HistoryResponse>;
  getLastProfile(): Promise<Profile>;
  getMachine(): Promise<MachineInfo>;
  getProfile(id: string): Promise<Profile>;
  getSettings(): Promise<Settings>;
  listProfiles(options?: ListProfilesOptions): Promise<JsonArray>;
  loadProfile(id: string): Promise<JsonObject>;
  preheat(): Promise<JsonObject>;
  tare(): Promise<void>;
  triggerAction(name: string): Promise<JsonObject>;
  updateSettings(patch: JsonObject): Promise<Settings>;
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

  function get<T>(path: string): Promise<T> {
    return request<T>(path);
  }

  function post<T = void>(path: string): Promise<T> {
    return request<T>(path, { method: 'POST' });
  }

  function postJson<T>(path: string, body: JsonObject): Promise<T> {
    return request<T>(path, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });
  }

  return {
    getCurrentHistory: () => get<HistoryResponse>('history/current'),
    getHistory: () => get<HistoryResponse>('history'),
    getLastHistory: () => get<HistoryResponse>('history/last'),
    getLastProfile: () => get<Profile>('profile/last'),
    getMachine: () => get<MachineInfo>('machine'),
    getProfile: (id) => get<Profile>(`profile/get/${encodeURIComponent(id)}`),
    getSettings: () => get<Settings>('settings'),
    listProfiles: (listOptions) =>
      get<JsonArray>(`profile/list${listOptions?.full ? '?full=true' : ''}`),
    loadProfile: (id) =>
      get<JsonObject>(`profile/load/${encodeURIComponent(id)}`),
    preheat: () => post<JsonObject>('action/preheat'),
    tare: async () => {
      await post('action/tare');
    },
    triggerAction: (name) => post<JsonObject>(`action/${name}`),
    updateSettings: (patch) => postJson<Settings>('settings', patch),
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
