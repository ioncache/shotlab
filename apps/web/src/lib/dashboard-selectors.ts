import type {
  HistoryEntry,
  HistoryResponse,
  JsonObject,
  LastProfileResponse,
  Settings,
} from '@shotlab/meticulous-client';
import type {
  DashboardMetric,
  DashboardShot,
  DashboardShotPoint,
  DashboardSnapshot,
} from './dashboard-types';

export function selectLiveCards(
  machine: JsonObject,
  settings: Settings,
  lastProfile: LastProfileResponse,
): DashboardMetric[] {
  const profileObject = asObject(lastProfile.profile);
  const machineStatus = readMachineStatus(machine);
  const profile =
    readString(machine, 'profile', 'profile_title', 'loaded_profile') ??
    readString(lastProfile, 'title', 'name', 'profile_title', 'id') ??
    readString(profileObject, 'name', 'title', 'profile_title', 'id');
  const temperature = readNumber(
    machine,
    'water_temperature',
    'temperature',
    'temp',
  );
  const weight = readNumber(machine, 'weight', 'current_weight', 'scale');

  return [
    {
      label: 'Temperature',
      value: temperature === undefined ? 'Unavailable' : `${temperature} C`,
    },
    {
      label: 'Machine status',
      value: machineStatus ?? 'Unknown',
    },
    {
      label: 'Weight',
      value: weight === undefined ? 'Unavailable' : `${weight} g`,
    },
    {
      label: 'Last loaded profile',
      value: profile ?? 'Unavailable',
    },
  ];
}

export function selectHistoryShots(history: HistoryResponse): DashboardShot[] {
  const rows = Array.isArray(history.history) ? history.history : [];

  return rows
    .map((row, index) => selectHistoryShot(row, index))
    .filter((shot): shot is DashboardShot => shot !== undefined);
}

export function selectDashboardSnapshot(
  machine: JsonObject,
  settings: Settings,
  history: JsonObject,
  lastProfile: LastProfileResponse,
): DashboardSnapshot {
  const liveCards = selectLiveCards(machine, settings, lastProfile);
  const shots = selectHistoryShots(history);

  return {
    liveCards,
    machineStateLabel: readMachineStatus(machine) ?? 'Unknown',
    selectedShotId: shots[0]?.id,
    shots,
  };
}

function readMachineStatus(machine: JsonObject): string | undefined {
  return readString(machine, 'status', 'name', 'state', 'current_state');
}

function selectHistoryShot(row: HistoryEntry, index: number): DashboardShot | undefined {
  const points = selectShotPoints(row);
  const hasNestedHistoryData = Array.isArray(row.data) && row.data.length > 0;
  if (points.length === 0) {
    return undefined;
  }

  const timestamp = readString(row, 'timestamp', 'created_at', 'brewed_at');

  return {
    brewedAt: formatTimestamp(timestamp ?? readEpochSeconds(row, 'time')),
    doseGrams: readNullableNumber(row, 'dose', 'dose_grams'),
    durationSeconds:
      readNullableNumber(row, 'duration', 'duration_seconds') ??
      (timestamp ? readNullableNumber(row, 'time') : null) ??
      (hasNestedHistoryData ? points.at(-1)?.second ?? null : null),
    id: readString(row, 'id', 'uuid') ?? `shot-${index + 1}`,
    points,
    profile:
      readString(row, 'name', 'profile_title', 'profile', 'profile_name') ??
      'Unknown profile',
    yieldGrams:
      readNullableNumber(row, 'weight', 'yield', 'yield_grams') ??
      (hasNestedHistoryData ? points.at(-1)?.weight ?? null : null),
  };
}

function selectShotPoints(row: JsonObject): DashboardShotPoint[] {
  const weights = readNumberArray(row, 'weights', 'weight_trace', 'series');
  if (weights.length > 0) {
    return weights.map((weight, index) => ({
      flow: null,
      gravimetricFlow: null,
      pressure: null,
      second: index,
      temperatureCelsius: null,
      weight,
    }));
  }

  const historyData = Array.isArray(row.data) ? row.data : [];
  if (historyData.length > 0) {
    return historyData
      .map((point) => {
        const nextPoint = asObject(point);
        const shot = asObject(nextPoint.shot);
        const millisecond = readNumber(nextPoint, 'time', 'profile_time');
        const weight = readNullableNumber(shot, 'weight');

        if (millisecond === undefined) {
          return undefined;
        }

        return {
          flow: readNullableNumber(shot, 'flow'),
          gravimetricFlow: readNullableNumber(shot, 'gravimetric_flow'),
          pressure: readNullableNumber(shot, 'pressure'),
          second: millisecond / 1000,
          temperatureCelsius: readNullableNumber(
            asObject(nextPoint.sensors),
            'external_1',
          ),
          weight,
        };
      })
      .filter((point): point is DashboardShotPoint => point !== undefined);
  }

  const points = Array.isArray(row.points) ? row.points : [];

  return points
    .map((point, index) => {
      const nextPoint = asObject(point);
      const second =
        readNumber(nextPoint, 'second', 'time', 't') ?? index;
      const weight = readNullableNumber(nextPoint, 'weight', 'y', 'value');

      if (weight === null && readNumber(nextPoint, 'second', 'time', 't') === undefined) {
        return undefined;
      }

      return {
        flow: readNullableNumber(nextPoint, 'flow'),
        gravimetricFlow: readNullableNumber(nextPoint, 'gravimetricFlow'),
        pressure: readNullableNumber(nextPoint, 'pressure'),
        second,
        temperatureCelsius: readNullableNumber(
          nextPoint,
          'temperature',
          'temperatureCelsius',
        ),
        weight,
      };
    })
    .filter((point): point is DashboardShotPoint => point !== undefined);
}

function readString(
  value: JsonObject,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function readNumber(
  value: JsonObject,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === 'string') {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function readNumberArray(value: JsonObject, ...keys: string[]): number[] {
  for (const key of keys) {
    const candidate = value[key];
    if (!Array.isArray(candidate)) {
      continue;
    }

    return candidate
      .map((entry) => {
        if (typeof entry === 'number' && Number.isFinite(entry)) {
          return entry;
        }
        if (typeof entry === 'string') {
          const parsed = Number(entry);
          if (Number.isFinite(parsed)) {
            return parsed;
          }
        }
        return undefined;
      })
      .filter((entry): entry is number => entry !== undefined);
  }

  return [];
}

function readNullableNumber(value: JsonObject, ...keys: string[]): number | null {
  return readNumber(value, ...keys) ?? null;
}

function formatTimestamp(value?: string): string {
  if (!value) {
    return 'Unknown time';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function readEpochSeconds(value: JsonObject, ...keys: string[]): string | undefined {
  const epochSeconds = readNumber(value, ...keys);
  if (epochSeconds === undefined) {
    return undefined;
  }

  return new Date(epochSeconds * 1000).toISOString();
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}
