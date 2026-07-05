import {
  type JsonObject,
  type LastProfileResponse,
  type MeticulousSocketEvent,
  type Settings,
} from '@shotlab/meticulous-client';
import type { DashboardShot, DashboardShotPoint } from './dashboard-types';

export interface LiveTelemetryState {
  lastProfile: LastProfileResponse;
  liveShot?: DashboardShot;
  machine: JsonObject;
  settings: Settings;
}

interface ApplyLiveSocketEventInput {
  event: MeticulousSocketEvent;
  lastProfile: LastProfileResponse;
  liveShot?: DashboardShot;
  machine: JsonObject;
  settings: Settings;
}

export function applyLiveSocketEvent(
  input: ApplyLiveSocketEventInput,
): LiveTelemetryState {
  switch (input.event.event) {
    case 'status':
      return applyStatusEvent(input);
    case 'sensors':
      return applySensorsEvent(input);
    case 'settings':
      return {
        lastProfile: input.lastProfile,
        liveShot: input.liveShot,
        machine: input.machine,
        settings: patchSettingsFromSettingsEvent(
          input.settings,
          input.event.payload,
        ),
      };
    case 'profile':
      return applyProfileEvent(input);
    case 'heater_status':
    default:
      return {
        lastProfile: input.lastProfile,
        liveShot: input.liveShot,
        machine: input.machine,
        settings: input.settings,
      };
  }
}

export function patchMachineFromStatusEvent(
  machine: JsonObject,
  payload: unknown[],
): JsonObject {
  const status = readFirstObject(payload);
  if (!status) {
    return machine;
  }

  const nextStatus = readStringValue(status.status);
  const nextName = readStringValue(status.name);
  const nextState = readStringValue(status.state);
  const nextLoadedProfile = readStringValue(status.loaded_profile);
  const nextProfile = readStringValue(status.profile);
  const sensors = readObjectValue(status.sensors);
  const nextWeight = readNumberValue(sensors?.w);
  const nextTemperature = readNumberValue(sensors?.t);

  return mergeJsonObject(machine, {
    ...(nextName ? { name: nextName } : {}),
    ...(nextState ? { current_state: nextState, state: nextState } : {}),
    ...(nextStatus || nextName || nextState
      ? { status: nextStatus ?? nextName ?? nextState }
      : {}),
    ...(nextLoadedProfile ? { loaded_profile: nextLoadedProfile } : {}),
    ...(nextProfile ? { profile: nextProfile } : {}),
    ...(nextTemperature !== undefined
      ? {
          temp: nextTemperature,
          temperature: nextTemperature,
          water_temperature: nextTemperature,
        }
      : {}),
    ...(nextWeight !== undefined
      ? { current_weight: nextWeight, scale: nextWeight, weight: nextWeight }
      : {}),
  });
}

export function patchMachineFromSensorsEvent(
  machine: JsonObject,
  payload: unknown[],
): JsonObject {
  const sensors = readFirstObject(payload);
  if (!sensors) {
    return machine;
  }

  const nextWeight = readNumberValue(sensors.weight_pred);
  if (nextWeight === undefined) {
    return machine;
  }

  if (readNumberValue(machine.weight) === nextWeight) {
    return machine;
  }

  return mergeJsonObject(machine, {
    current_weight: nextWeight,
    scale: nextWeight,
    weight: nextWeight,
  });
}

export function patchSettingsFromSettingsEvent(
  settings: Settings,
  payload: unknown[],
): Settings {
  const nextSettings = readFirstObject(payload);
  if (!nextSettings) {
    return settings;
  }

  return mergeJsonObject(settings, nextSettings) as Settings;
}

export function patchLastProfileFromProfileEvent(
  lastProfile: LastProfileResponse,
  payload: unknown[],
): LastProfileResponse {
  const profile = readFirstObject(payload);
  if (!profile || readStringValue(profile.change) !== 'load') {
    return lastProfile;
  }

  const profileId = readStringValue(profile.profile_id);
  if (!profileId) {
    return lastProfile;
  }

  const nextProfile = mergeJsonObject(
    readObjectValue(lastProfile.profile) ?? {},
    { id: profileId },
  );

  return mergeJsonObject(lastProfile as JsonObject, {
    profile: nextProfile,
  }) as LastProfileResponse;
}

function applyStatusEvent(
  input: ApplyLiveSocketEventInput,
): LiveTelemetryState {
  const machine = patchMachineFromStatusEvent(
    input.machine,
    input.event.payload,
  );

  return {
    lastProfile: input.lastProfile,
    liveShot: patchLiveShotFromStatusEvent(
      input.liveShot,
      input.lastProfile,
      input.event.payload,
    ),
    machine,
    settings: input.settings,
  };
}

function applySensorsEvent(
  input: ApplyLiveSocketEventInput,
): LiveTelemetryState {
  return {
    lastProfile: input.lastProfile,
    liveShot: patchLiveShotFromSensorsEvent(
      input.liveShot,
      input.machine,
      input.event.payload,
    ),
    machine: patchMachineFromSensorsEvent(input.machine, input.event.payload),
    settings: input.settings,
  };
}

function applyProfileEvent(
  input: ApplyLiveSocketEventInput,
): LiveTelemetryState {
  const lastProfile = patchLastProfileFromProfileEvent(
    input.lastProfile,
    input.event.payload,
  );

  return {
    lastProfile,
    liveShot: patchLiveShotProfile(lastProfile, input.liveShot),
    machine: input.machine,
    settings: input.settings,
  };
}

function patchLiveShotFromStatusEvent(
  liveShot: DashboardShot | undefined,
  lastProfile: LastProfileResponse,
  payload: unknown[],
): DashboardShot | undefined {
  const status = readFirstObject(payload);
  if (!status) {
    return liveShot;
  }

  if (!readIsBrewingStatus(status)) {
    return liveShot;
  }

  const nextPoint = createLiveShotPoint(status);
  const nextId = readStringValue(status.id)
    ? `live-shot:${readStringValue(status.id)}`
    : 'live-shot';
  const previousPoints = liveShot?.id === nextId ? liveShot.points : [];
  const nextPoints = nextPoint
    ? appendLiveShotPoint(previousPoints, nextPoint)
    : previousPoints;
  const nextProfile = resolveLiveProfile(lastProfile, status, liveShot);
  const latestPoint = nextPoints.at(-1);

  return {
    brewedAt:
      liveShot?.id === nextId
        ? liveShot.brewedAt
        : formatLiveTimestamp(readNumberValue(status.time)),
    doseGrams: null,
    durationSeconds: latestPoint?.second ?? null,
    id: nextId,
    points: nextPoints,
    profile: nextProfile.name,
    profileId: nextProfile.id,
    profileImage: nextProfile.image,
    source: 'live',
    yieldGrams: latestPoint?.weight ?? null,
  };
}

function patchLiveShotFromSensorsEvent(
  liveShot: DashboardShot | undefined,
  machine: JsonObject,
  payload: unknown[],
): DashboardShot | undefined {
  if (!liveShot || liveShot.points.length === 0) {
    return liveShot;
  }

  if (!readIsBrewingMachine(machine)) {
    return liveShot;
  }

  const sensors = readFirstObject(payload);
  const nextWeight = readNumberValue(sensors?.weight_pred);
  if (nextWeight === undefined) {
    return liveShot;
  }

  const nextPoints = [...liveShot.points];
  const lastPoint = nextPoints.at(-1);
  if (!lastPoint || lastPoint.weight === nextWeight) {
    return liveShot;
  }

  nextPoints[nextPoints.length - 1] = {
    ...lastPoint,
    weight: nextWeight,
  };

  return {
    ...liveShot,
    durationSeconds: nextPoints.at(-1)?.second ?? null,
    points: nextPoints,
    yieldGrams: nextWeight,
  };
}

function patchLiveShotProfile(
  lastProfile: LastProfileResponse,
  liveShot: DashboardShot | undefined,
): DashboardShot | undefined {
  if (!liveShot) {
    return liveShot;
  }

  const nextProfile = resolveLiveProfile(lastProfile, undefined, liveShot);
  if (
    liveShot.profile === nextProfile.name &&
    liveShot.profileId === nextProfile.id &&
    liveShot.profileImage === nextProfile.image
  ) {
    return liveShot;
  }

  return {
    ...liveShot,
    profile: nextProfile.name,
    profileId: nextProfile.id,
    profileImage: nextProfile.image,
  };
}

function createLiveShotPoint(
  status: JsonObject,
): DashboardShotPoint | undefined {
  const profileTime = readNumberValue(status.profile_time);
  if (profileTime === undefined) {
    return undefined;
  }

  const sensors = readObjectValue(status.sensors);

  return {
    flow: readNullableNumber(sensors, 'f'),
    gravimetricFlow: readNullableNumber(sensors, 'g'),
    pressure: readNullableNumber(sensors, 'p'),
    second: profileTime / 1000,
    temperatureCelsius: readNullableNumber(sensors, 't'),
    weight: readNullableNumber(sensors, 'w'),
  };
}

function appendLiveShotPoint(
  points: DashboardShotPoint[],
  nextPoint: DashboardShotPoint,
): DashboardShotPoint[] {
  if (points.length === 0) {
    return [nextPoint];
  }

  const nextPoints = [...points];
  const lastPoint = nextPoints.at(-1);
  if (!lastPoint) {
    return [nextPoint];
  }

  if (lastPoint.second === nextPoint.second) {
    nextPoints[nextPoints.length - 1] = {
      flow: nextPoint.flow ?? lastPoint.flow,
      gravimetricFlow: nextPoint.gravimetricFlow ?? lastPoint.gravimetricFlow,
      pressure: nextPoint.pressure ?? lastPoint.pressure,
      second: lastPoint.second,
      temperatureCelsius:
        nextPoint.temperatureCelsius ?? lastPoint.temperatureCelsius,
      weight: nextPoint.weight ?? lastPoint.weight,
    };
    return nextPoints;
  }

  return [...nextPoints, nextPoint];
}

function resolveLiveProfile(
  lastProfile: LastProfileResponse,
  status: JsonObject | undefined,
  liveShot: DashboardShot | undefined,
): {
  id?: string;
  image?: string;
  name: string;
} {
  const profile = readObjectValue(lastProfile.profile);
  const statusReference =
    readStringValue(status?.profile) ?? readStringValue(status?.loaded_profile);
  const profileId = readStringValue(profile?.id);
  const profileName =
    readStringValue(profile?.name) ?? readStringValue(profile?.title);
  const profileImage = readStringValue(
    readObjectValue(profile?.display)?.image,
  );
  const matchesLastProfile =
    statusReference !== undefined &&
    (normalize(statusReference) === normalize(profileId) ||
      normalize(statusReference) === normalize(profileName));

  return {
    id: (matchesLastProfile ? profileId : undefined) ?? liveShot?.profileId,
    image:
      (matchesLastProfile || statusReference === undefined
        ? profileImage
        : undefined) ?? liveShot?.profileImage,
    name: statusReference ?? profileName ?? liveShot?.profile ?? 'Live brew',
  };
}

function readIsBrewingStatus(status: JsonObject): boolean {
  const extracting = status.extracting;
  if (extracting === true) {
    return true;
  }

  return readIsBrewingMachine(status);
}

function readIsBrewingMachine(machine: JsonObject): boolean {
  const state = (
    readStringValue(machine.state) ??
    readStringValue(machine.status) ??
    readStringValue(machine.name)
  )?.toLowerCase();

  if (!state) {
    return false;
  }

  return (
    state.includes('brew') || state === 'extraction' || state === 'retracting'
  );
}

function formatLiveTimestamp(value: number | undefined): string {
  if (value === undefined || value <= 0) {
    return 'Live brew';
  }

  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) {
    return 'Live brew';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function mergeJsonObject(current: JsonObject, patch: JsonObject): JsonObject {
  let nextObject = current;

  for (const [key, value] of Object.entries(patch)) {
    if (current[key] === value) {
      continue;
    }

    if (nextObject === current) {
      nextObject = { ...current };
    }

    nextObject[key] = value;
  }

  return nextObject;
}

function readFirstObject(payload: unknown[]): JsonObject | undefined {
  return readObjectValue(payload[0]);
}

function readObjectValue(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function readNullableNumber(
  value: JsonObject | undefined,
  key: string,
): number | null {
  return value ? (readNumberValue(value[key]) ?? null) : null;
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}
