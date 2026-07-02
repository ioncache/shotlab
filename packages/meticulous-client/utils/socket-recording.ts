import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SocketIoState } from '../src/socket-io-client.ts';
import {
  parseSocketPayloadMetrics,
  sanitizeNormalizedValue,
} from './socket-payload.ts';

export type RecordedSocketEventEntry = {
  event: string;
  kind: 'event';
  payload: unknown[];
  receivedAt: string;
  receivedAtMs: number;
};

export type RecordedSocketStateEntry = {
  kind: 'state';
  receivedAt: string;
  receivedAtMs: number;
  state: SocketIoState;
};

export type RecordedSocketEntry =
  | RecordedSocketEventEntry
  | RecordedSocketStateEntry;

type RecordingSessionDirOptions = {
  label?: string;
  now?: Date;
  rootDir: string;
};

type WriteRecordingArtifactsOptions = {
  entries: RecordedSocketEntry[];
  sessionDir: string;
};

type RecordingSummary = {
  eventCounts: Record<string, number>;
  eventNames: string[];
  firstReceivedAt?: string;
  lastReceivedAt?: string;
  totalEntries: number;
};

type NormalizedTimelineEntry =
  | RecordedSocketStateEntry
  | (RecordedSocketEventEntry & {
      machineTime?: number;
      pressure?: number;
      profileTime?: number;
      temperature?: number;
      weight?: number;
    });

type ChartSeriesRow = {
  event: string;
  machineTime?: number;
  pressure?: number;
  profileTime?: number;
  receivedAt: string;
  receivedAtMs: number;
  temperature?: number;
  weight?: number;
};

export async function createRecordingSessionDir(
  options: RecordingSessionDirOptions,
) {
  const timestamp = (options.now ?? new Date())
    .toISOString()
    .replaceAll(':', '-')
    .replace('.', '-');
  const labelSuffix = options.label ? `-${slugify(options.label)}` : '';
  const sessionDir = join(options.rootDir, `${timestamp}${labelSuffix}`);

  await mkdir(sessionDir, { recursive: true });

  return sessionDir;
}

export async function writeRecordingArtifacts(
  options: WriteRecordingArtifactsOptions,
) {
  const timeline = normalizeTimelineEntries(options.entries);
  const chartSeries = buildChartSeries(timeline);
  const rawEvents = options.entries
    .map((entry) => JSON.stringify(entry))
    .join('\n');

  await Promise.all([
    writeFile(
      join(options.sessionDir, 'raw-events.jsonl'),
      `${rawEvents}\n`,
      'utf8',
    ),
    writeFile(
      join(options.sessionDir, 'normalized-timeline.json'),
      JSON.stringify(timeline, null, 2),
      'utf8',
    ),
    writeFile(
      join(options.sessionDir, 'chart-series.json'),
      JSON.stringify(chartSeries, null, 2),
      'utf8',
    ),
  ]);
}

export async function summarizeRecordingDirectory(
  recordingDir: string,
): Promise<RecordingSummary> {
  const rawEvents = await readFile(
    join(recordingDir, 'raw-events.jsonl'),
    'utf8',
  );
  const entries = rawEvents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as RecordedSocketEntry);

  const eventCounts = Object.fromEntries(
    entries
      .filter(isEventEntry)
      .reduce((counts, entry) => {
        counts.set(entry.event, (counts.get(entry.event) ?? 0) + 1);
        return counts;
      }, new Map<string, number>())
      .entries()
      .toArray()
      .toSorted(([left], [right]) => left.localeCompare(right)),
  );

  return {
    eventCounts,
    eventNames: Object.keys(eventCounts),
    firstReceivedAt: entries[0]?.receivedAt,
    lastReceivedAt: entries.at(-1)?.receivedAt,
    totalEntries: entries.length,
  };
}

function normalizeTimelineEntries(
  entries: RecordedSocketEntry[],
): NormalizedTimelineEntry[] {
  return entries.map((entry) => {
    if (entry.kind === 'state') {
      return entry;
    }

    const metrics = parseSocketPayloadMetrics(entry.payload);

    return {
      ...entry,
      machineTime: metrics.machineTime,
      payload: sanitizeNormalizedValue(entry.payload) as unknown[],
      pressure: metrics.pressure,
      profileTime: metrics.profileTime,
      temperature: metrics.temperature,
      weight: metrics.weight,
    };
  });
}

function buildChartSeries(
  timeline: NormalizedTimelineEntry[],
): ChartSeriesRow[] {
  return timeline
    .filter(isEventEntry)
    .filter(
      (entry) =>
        entry.machineTime !== undefined ||
        entry.profileTime !== undefined ||
        entry.temperature !== undefined ||
        entry.weight !== undefined ||
        entry.pressure !== undefined,
    )
    .map((entry) => ({
      event: entry.event,
      machineTime: entry.machineTime,
      pressure: entry.pressure,
      profileTime: entry.profileTime,
      receivedAt: entry.receivedAt,
      receivedAtMs: entry.receivedAtMs,
      temperature: entry.temperature,
      weight: entry.weight,
    }));
}

function isEventEntry(
  entry: RecordedSocketEntry | NormalizedTimelineEntry,
): entry is RecordedSocketEventEntry & Partial<ChartSeriesRow> {
  return entry.kind === 'event';
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
