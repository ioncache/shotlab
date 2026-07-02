import { connectSocketIo } from './socket-io-client.js';
import type {
  LiveButtonEventPayload,
  LiveHeaterStatusEventPayload,
  LiveProfileEventPayload,
  LiveProfileHoverEventPayload,
  LiveSensorsEventPayload,
  LiveSettingsEventPayload,
  LiveStatusEventPayload,
  MachinePhaseSetpoints,
} from './socket-types.js';

export type {
  BrewCoreMetrics,
  LiveButtonEventPayload,
  LiveHeaterStatusEventPayload,
  LiveProfileEventPayload,
  LiveProfileHoverEventPayload,
  LiveSensorsEventPayload,
  LiveSettingsEventPayload,
  LiveStatusEventPayload,
  MachinePhaseSetpoints,
} from './socket-types.js';

export type JsonObject = Record<string, unknown>;
export type JsonArray = unknown[];

export interface MeticulousClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
}

export interface ConnectMeticulousSocketOptions {
  baseUrl: string;
  onAny?: (event: MeticulousSocketEvent) => void;
  onStateChange?: (state: MeticulousSocketState) => void;
}

export interface RepositoryRevision {
  branch?: string | null;
  commit?: string | null;
}

export type RepositoryInfo = Record<string, RepositoryRevision>;

export interface MachineInfo {
  batch_number?: string;
  build_date?: string;
  color?: string;
  firmware?: string;
  hostname?: string;
  image_build_channel?: string;
  image_version?: string;
  mainVoltage?: number;
  manufacturing?: boolean;
  name?: string;
  repository_info?: RepositoryInfo;
  serial?: string;
  software_version?: string;
  upgrade_first_boot?: boolean;
  version_history?: string[];
}

export interface ProfileDisplay {
  accentColor?: string;
  description?: string;
  image?: string;
  shortDescription?: string;
}

export interface ProfileAuthorReference {
  author_id?: string;
  name?: string;
  profile_id?: string;
}

export interface ProfileVariable {
  key?: string;
  name?: string;
  type?: string;
  value?: number | string;
}

export interface ProfileDynamics {
  interpolation?: string;
  over?: string;
  points?: Array<[number, number | string]>;
}

export interface ProfileTrigger {
  comparison?: string;
  relative?: boolean;
  type?: string;
  value?: number | string;
}

export interface ProfileLimit {
  comparison?: string;
  relative?: boolean;
  type?: string;
  value?: number | string;
}

export interface ProfileStage {
  dynamics?: ProfileDynamics;
  exit_triggers?: ProfileTrigger[];
  key?: string;
  limits?: ProfileLimit[];
  name?: string;
  type?: string;
}

export interface MachineProfile {
  author?: string;
  author_id?: string;
  db_key?: number;
  display?: ProfileDisplay;
  final_weight?: number;
  id?: string;
  last_changed?: number;
  name?: string;
  previous_authors?: ProfileAuthorReference[];
  stages?: ProfileStage[];
  temperature?: number;
  variables?: ProfileVariable[];
}

export interface LastProfileResponse {
  load_time?: number;
  profile?: MachineProfile;
}
export interface ReverseScrollingSettings {
  home?: boolean;
  keyboard?: boolean;
  menus?: boolean;
}

export interface Settings {
  allow_debug_sending?: boolean;
  allow_legacy_json?: boolean;
  allow_stage_skipping?: boolean;
  auto_purge_after_shot?: boolean;
  auto_start_shot?: boolean;
  clock_format_24_hour?: boolean;
  debug_shot_data_retention_days?: number;
  disable_ui_features?: boolean;
  disallow_firmware_flashing?: boolean;
  enable_sounds?: boolean;
  heat_on_boot?: boolean;
  heating_timeout?: number;
  hostname_override?: string | null;
  idle_screen?: string;
  partial_retraction?: number;
  profile_order?: string[];
  reverse_scrolling?: ReverseScrollingSettings;
  ssh_enabled?: boolean;
  telemetry_service_enabled?: boolean;
  time_zone?: string;
  timezone_sync?: string;
  update_channel?: string;
  usb_mode?: string;
}
export interface HistoryShotSensors extends JsonObject {
  adc_0?: number;
  adc_1?: number;
  adc_2?: number;
  adc_3?: number;
  bandheater_current?: number;
  bandheater_power?: number;
  bar_down?: number;
  bar_mid_down?: number;
  bar_mid_up?: number;
  bar_up?: number;
  external_1?: number;
  external_2?: number;
  lam_temp?: number;
  motor_current?: number;
  motor_position?: number;
  motor_power?: number;
  motor_speed?: number;
  motor_temp?: number;
  motor_thermistor?: string;
  pressure_sensor?: number;
  tube?: number;
  water_status?: boolean;
  weight_prediction?: number;
}
export type HistoryShotSetpoints = MachinePhaseSetpoints;
export interface HistoryShotMetrics extends JsonObject {
  flow?: number;
  gravimetric_flow?: number;
  pressure?: number;
  setpoints?: HistoryShotSetpoints;
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
  db_key?: number;
  data?: HistoryPoint[];
  debug_file?: string | null;
  dose?: number;
  dose_grams?: number;
  duration?: number;
  duration_seconds?: number;
  file?: string;
  id?: string;
  name?: string;
  profile?: string | MachineProfile;
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

export interface MeticulousSocketEvent<
  TEvent extends string = string,
  TPayload extends unknown[] = unknown[],
> {
  event: TEvent;
  payload: TPayload;
}

export type KnownMeticulousSocketEvent =
  | MeticulousSocketEvent<'button', [LiveButtonEventPayload]>
  | MeticulousSocketEvent<'heater_status', [LiveHeaterStatusEventPayload]>
  | MeticulousSocketEvent<'profile', [LiveProfileEventPayload]>
  | MeticulousSocketEvent<'profileHover', [LiveProfileHoverEventPayload]>
  | MeticulousSocketEvent<'sensors', [LiveSensorsEventPayload]>
  | MeticulousSocketEvent<'settings', [LiveSettingsEventPayload]>
  | MeticulousSocketEvent<'status', [LiveStatusEventPayload]>;

export interface MeticulousSocketConnection {
  close(): Promise<void>;
  getState(): MeticulousSocketState;
  onAny(listener: (event: MeticulousSocketEvent) => void): void;
}

export interface MeticulousSocketState {
  connected: boolean;
  error?: string;
  socketId?: string;
  transport?: string;
}

export interface MeticulousClient {
  getCurrentHistory(): Promise<CurrentHistory>;
  getHistory(): Promise<HistoryResponse>;
  getLastHistory(): Promise<HistoryEntry>;
  getLastProfile(): Promise<LastProfileResponse>;
  getMachine(): Promise<MachineInfo>;
  getProfile(id: string): Promise<MachineProfile>;
  getSettings(): Promise<Settings>;
  listProfiles(options?: ListProfilesOptions): Promise<MachineProfile[]>;
  loadProfile(id: string): Promise<ActionResult>;
  preheat(): Promise<ActionResult>;
  tare(): Promise<void>;
  triggerAction(name: string): Promise<ActionResult>;
  updateSettings(patch: JsonObject): Promise<Settings>;
}

export interface ActionResult {
  action?: string;
  id?: string;
  ok?: boolean;
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

export async function connectSocket(
  options: ConnectMeticulousSocketOptions,
): Promise<MeticulousSocketConnection> {
  const socket = await connectSocketIo({
    baseUrl: normalizeMachineBaseUrl(options.baseUrl),
    onStateChange: options.onStateChange,
  });
  let closed = false;

  if (options.onAny) {
    socket.onAny(wrapSocketListener(options.onAny));
  }

  return {
    close: async () => {
      if (closed) {
        return;
      }

      closed = true;
      socket.close();
    },
    getState: () => socket.getState(),
    onAny: (listener) => {
      socket.onAny(wrapSocketListener(listener));
    },
  };
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
    getLastProfile: () => get<LastProfileResponse>('profile/last'),
    getMachine: () => get<MachineInfo>('machine'),
    getProfile: (id) =>
      get<MachineProfile>(`profile/get/${encodeURIComponent(id)}`),
    getSettings: () => get<Settings>('settings'),
    listProfiles: (listOptions) =>
      get<MachineProfile[]>(
        `profile/list${listOptions?.full ? '?full=true' : ''}`,
      ),
    loadProfile: (id) =>
      get<ActionResult>(`profile/load/${encodeURIComponent(id)}`),
    preheat: () => post<ActionResult>(actionPath(METICULOUS_ACTIONS.PREHEAT)),
    tare: async () => {
      await post(actionPath(METICULOUS_ACTIONS.TARE));
    },
    triggerAction: (name) => post<ActionResult>(actionPath(name)),
    updateSettings: (patch) => postJson<Settings>('settings', patch),
  };
}

function normalizeApiBaseUrl(baseUrl: string): string {
  const url = parseBaseUrl(baseUrl);
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname.endsWith('/api/v1')) {
    url.pathname = pathname;
  } else {
    url.pathname = `${pathname}/api/v1`;
  }

  return url.toString().replace(/\/+$/, '');
}

function normalizeMachineBaseUrl(baseUrl: string): string {
  const url = parseBaseUrl(baseUrl);
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname.endsWith('/api/v1')) {
    url.pathname = pathname.slice(0, -'/api/v1'.length) || '/';
  } else {
    url.pathname = pathname || '/';
  }

  return url.toString().replace(/\/+$/, '');
}

function parseBaseUrl(baseUrl: string): URL {
  const url = new URL(baseUrl);
  if (url.search || url.hash) {
    throw new Error('baseUrl must not include a query string or fragment');
  }

  return url;
}

function wrapSocketListener(
  listener: (event: MeticulousSocketEvent) => void,
): (event: string, ...payload: unknown[]) => void {
  return (event, ...payload) => {
    listener({ event, payload });
  };
}
