export type JsonObject = Record<string, unknown>;
export type JsonArray = unknown[];

export interface MeticulousClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export type MachineInfo = JsonObject;
export type Profile = JsonObject;
export type Settings = JsonObject;
export interface HistoryShotSensors extends JsonObject {
  external_1?: number;
  external_2?: number;
}
export interface HistoryShotMetrics extends JsonObject {
  flow?: number;
  gravimetric_flow?: number;
  pressure?: number;
  weight?: number;
}
export interface HistoryPoint extends JsonObject {
  profile_time?: number;
  sensors?: HistoryShotSensors;
  shot?: HistoryShotMetrics;
  status?: string;
  time?: number;
}
export interface HistoryEntry extends JsonObject {
  brewed_at?: string;
  created_at?: string;
  data?: HistoryPoint[];
  dose?: number;
  dose_grams?: number;
  duration?: number;
  duration_seconds?: number;
  id?: string;
  name?: string;
  profile?: string;
  profile_name?: string;
  profile_title?: string;
  points?: JsonObject[];
  temperature?: number;
  final_temperature?: number;
  time?: number;
  timestamp?: string;
  uuid?: string;
  weight?: number;
  weights?: number[];
  weight_trace?: number[];
  yield?: number;
  yield_grams?: number;
}
export interface HistoryResponse extends JsonObject {
  history?: HistoryEntry[];
}
export type CurrentHistory = HistoryEntry | null;
export type MeticulousActionCatalog = Record<string, string>;
export const METICULOUS_ACTIONS: MeticulousActionCatalog & {
  readonly PREHEAT: 'preheat';
  readonly STOP: 'stop';
  readonly TARE: 'tare';
} = {
  PREHEAT: 'preheat',
  STOP: 'stop',
  TARE: 'tare',
};

export interface ListProfilesOptions {
  full?: boolean;
}

export interface MeticulousClient {
  getCurrentHistory(): Promise<CurrentHistory>;
  getHistory(): Promise<HistoryResponse>;
  getLastHistory(): Promise<HistoryEntry>;
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

function actionPath(name: string): string {
  return `action/${encodeURIComponent(name)}`;
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
    getCurrentHistory: () => get<CurrentHistory>('history/current'),
    getHistory: () => get<HistoryResponse>('history'),
    getLastHistory: () => get<HistoryEntry>('history/last'),
    getLastProfile: () => get<Profile>('profile/last'),
    getMachine: () => get<MachineInfo>('machine'),
    getProfile: (id) => get<Profile>(`profile/get/${encodeURIComponent(id)}`),
    getSettings: () => get<Settings>('settings'),
    listProfiles: (listOptions) =>
      get<JsonArray>(`profile/list${listOptions?.full ? '?full=true' : ''}`),
    loadProfile: (id) =>
      get<JsonObject>(`profile/load/${encodeURIComponent(id)}`),
    preheat: () => post<JsonObject>(actionPath(METICULOUS_ACTIONS.PREHEAT)),
    tare: async () => {
      await post(actionPath(METICULOUS_ACTIONS.TARE));
    },
    triggerAction: (name) => post<JsonObject>(actionPath(name)),
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
