export type DashboardShotSource = 'history' | 'live';

export interface DashboardMetric {
  label: string;
  value: string;
}

export interface DashboardShotPoint {
  flow: number | null;
  gravimetricFlow: number | null;
  pressure: number | null;
  second: number;
  temperatureCelsius: number | null;
  weight: number | null;
}

export interface DashboardShot {
  id: string;
  source: DashboardShotSource;
  brewedAt: string;
  profile: string;
  profileId?: string;
  profileImage?: string;
  doseGrams: number | null;
  yieldGrams: number | null;
  durationSeconds: number | null;
  points: DashboardShotPoint[];
}

export interface DashboardSnapshot {
  machineStateLabel: string;
  liveCards: DashboardMetric[];
  selectedShotId?: string;
  shots: DashboardShot[];
}
