export interface BrewCoreMetrics {
  f?: number;
  g?: number;
  p?: number;
  t?: number;
  w?: number;
}

export interface MachinePhaseSetpoints {
  active?: string | null;
  flow?: number;
  power?: number;
  pressure?: number;
  temperature?: number;
}

export interface LiveStatusEventPayload {
  extracting?: boolean;
  id?: string;
  loaded_profile?: string;
  name: string;
  profile: string;
  profile_time: number;
  sensors: BrewCoreMetrics;
  setpoints: MachinePhaseSetpoints;
  state: string;
  time: number;
}

export interface LiveSensorsEventPayload extends BrewCoreMetrics {
  a_0?: number;
  a_1?: number;
  a_2?: number;
  a_3?: number;
  bh_cur?: number;
  bh_pwr?: number;
  lam_temp?: number;
  m_cur?: number;
  m_pos?: number;
  m_pwr?: number;
  m_spd?: number;
  motor_temp?: number | string;
  t_bar_down?: number;
  t_bar_md?: number;
  t_bar_mu?: number;
  t_bar_up?: number;
  t_ext_1?: number;
  t_ext_2?: number;
  t_motor_temp?: number;
  t_tube?: number;
  w_stat?: boolean;
  weight_pred?: number;
}

export interface LiveButtonEventPayload {
  time_since_last_event: number;
  type: string;
}

export interface LiveProfileHoverEventPayload {
  from: string;
  id: string;
  type: string;
}

export interface LiveProfileEventPayload {
  change: string;
  profile_id: string;
}

export type LiveHeaterStatusEventPayload = number;

export type LiveSettingsEventPayload = Record<string, unknown>;
