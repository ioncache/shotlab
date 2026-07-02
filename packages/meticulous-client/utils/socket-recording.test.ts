import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createRecordingSessionDir,
  summarizeRecordingDirectory,
  writeRecordingArtifacts,
  type RecordedSocketEntry,
} from './socket-recording.ts';

describe('createRecordingSessionDir', () => {
  const createdPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdPaths.map(async (path) => {
        await rm(path, { force: true, recursive: true });
      }),
    );
    createdPaths.length = 0;
  });

  it('creates a timestamped recording directory with a sanitized label', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'shotlab-recordings-'));
    createdPaths.push(rootDir);

    const sessionDir = await createRecordingSessionDir({
      label: 'Morning Brew #1',
      now: new Date('2026-07-01T07:00:00.000Z'),
      rootDir,
    });

    expect(sessionDir).toContain('2026-07-01T07-00-00-000Z-morning-brew-1');
  });
});

describe('writeRecordingArtifacts', () => {
  const createdPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdPaths.map(async (path) => {
        await rm(path, { force: true, recursive: true });
      }),
    );
    createdPaths.length = 0;
  });

  it('writes raw, timeline, and chart artifacts from observed entries', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'shotlab-recordings-'));
    createdPaths.push(rootDir);

    const sessionDir = await createRecordingSessionDir({
      now: new Date('2026-07-01T07:00:00.000Z'),
      rootDir,
    });

    const entries: RecordedSocketEntry[] = [
      {
        event: 'status',
        kind: 'event',
        payload: [
          {
            profile_time: 12.5,
            sensors: { p: 8.9, t: 92.1, w: 18.2 },
            time: 101.2,
          },
        ],
        receivedAt: '2026-07-01T07:00:01.000Z',
        receivedAtMs: Date.parse('2026-07-01T07:00:01.000Z'),
      },
      {
        kind: 'state',
        receivedAt: '2026-07-01T07:00:02.000Z',
        receivedAtMs: Date.parse('2026-07-01T07:00:02.000Z'),
        state: {
          connected: true,
          socketId: 'socket-1',
          transport: 'websocket',
        },
      },
      {
        event: 'sensors',
        kind: 'event',
        payload: [
          {
            p: 7.4,
            t_tube: 91.8,
            time: 102.1,
            weight_pred: 21.5,
          },
        ],
        receivedAt: '2026-07-01T07:00:03.000Z',
        receivedAtMs: Date.parse('2026-07-01T07:00:03.000Z'),
      },
    ];

    await writeRecordingArtifacts({ entries, sessionDir });

    const rawEvents = await readFile(
      join(sessionDir, 'raw-events.jsonl'),
      'utf8',
    );
    const timeline = JSON.parse(
      await readFile(join(sessionDir, 'normalized-timeline.json'), 'utf8'),
    );
    const chartSeries = JSON.parse(
      await readFile(join(sessionDir, 'chart-series.json'), 'utf8'),
    );

    expect(rawEvents.trim().split('\n')).toHaveLength(3);
    expect(timeline).toEqual([
      {
        event: 'status',
        kind: 'event',
        machineTime: 101.2,
        payload: [
          {
            profile_time: 12.5,
            sensors: { p: 8.9, t: 92.1, w: 18.2 },
            time: 101.2,
          },
        ],
        pressure: 8.9,
        profileTime: 12.5,
        receivedAt: '2026-07-01T07:00:01.000Z',
        receivedAtMs: Date.parse('2026-07-01T07:00:01.000Z'),
        temperature: 92.1,
        weight: 18.2,
      },
      {
        kind: 'state',
        receivedAt: '2026-07-01T07:00:02.000Z',
        receivedAtMs: Date.parse('2026-07-01T07:00:02.000Z'),
        state: {
          connected: true,
          socketId: 'socket-1',
          transport: 'websocket',
        },
      },
      {
        event: 'sensors',
        kind: 'event',
        machineTime: 102.1,
        payload: [
          {
            p: 7.4,
            t_tube: 91.8,
            time: 102.1,
            weight_pred: 21.5,
          },
        ],
        pressure: 7.4,
        receivedAt: '2026-07-01T07:00:03.000Z',
        receivedAtMs: Date.parse('2026-07-01T07:00:03.000Z'),
        temperature: 91.8,
        weight: 21.5,
      },
    ]);
    expect(chartSeries).toEqual([
      {
        event: 'status',
        machineTime: 101.2,
        pressure: 8.9,
        profileTime: 12.5,
        receivedAt: '2026-07-01T07:00:01.000Z',
        receivedAtMs: Date.parse('2026-07-01T07:00:01.000Z'),
        temperature: 92.1,
        weight: 18.2,
      },
      {
        event: 'sensors',
        machineTime: 102.1,
        pressure: 7.4,
        receivedAt: '2026-07-01T07:00:03.000Z',
        receivedAtMs: Date.parse('2026-07-01T07:00:03.000Z'),
        temperature: 91.8,
        weight: 21.5,
      },
    ]);
  });

  it('sanitizes NaN string sentinels in normalized payloads while preserving raw events', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'shotlab-recordings-'));
    createdPaths.push(rootDir);

    const sessionDir = await createRecordingSessionDir({
      now: new Date('2026-07-01T07:00:00.000Z'),
      rootDir,
    });

    const entries: RecordedSocketEntry[] = [
      {
        event: 'sensors',
        kind: 'event',
        payload: [
          {
            motor_temp: 'NaN',
            p: 7.4,
            t_tube: 91.8,
            time: 102.1,
            weight_pred: 21.5,
          },
        ],
        receivedAt: '2026-07-01T07:00:03.000Z',
        receivedAtMs: Date.parse('2026-07-01T07:00:03.000Z'),
      },
    ];

    await writeRecordingArtifacts({ entries, sessionDir });

    const rawEvents = await readFile(
      join(sessionDir, 'raw-events.jsonl'),
      'utf8',
    );
    const timeline = JSON.parse(
      await readFile(join(sessionDir, 'normalized-timeline.json'), 'utf8'),
    );

    expect(rawEvents).toContain('"motor_temp":"NaN"');
    expect(timeline[0]?.payload?.[0]?.motor_temp).toBeNull();
  });
});

describe('summarizeRecordingDirectory', () => {
  const createdPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(
      createdPaths.map(async (path) => {
        await rm(path, { force: true, recursive: true });
      }),
    );
    createdPaths.length = 0;
  });

  it('summarizes a saved recording directory', async () => {
    const rootDir = await mkdtemp(join(tmpdir(), 'shotlab-recordings-'));
    createdPaths.push(rootDir);

    const sessionDir = await createRecordingSessionDir({
      now: new Date('2026-07-01T07:00:00.000Z'),
      rootDir,
    });

    await writeRecordingArtifacts({
      entries: [
        {
          event: 'status',
          kind: 'event',
          payload: [{ sensors: { p: 8.9 }, time: 101.2 }],
          receivedAt: '2026-07-01T07:00:01.000Z',
          receivedAtMs: Date.parse('2026-07-01T07:00:01.000Z'),
        },
        {
          event: 'status',
          kind: 'event',
          payload: [{ sensors: { p: 9.1 }, time: 102.8 }],
          receivedAt: '2026-07-01T07:00:03.000Z',
          receivedAtMs: Date.parse('2026-07-01T07:00:03.000Z'),
        },
        {
          event: 'button',
          kind: 'event',
          payload: [{ type: 'ENCODER_PRESSED' }],
          receivedAt: '2026-07-01T07:00:04.000Z',
          receivedAtMs: Date.parse('2026-07-01T07:00:04.000Z'),
        },
      ],
      sessionDir,
    });

    await expect(summarizeRecordingDirectory(sessionDir)).resolves.toEqual({
      eventCounts: {
        button: 1,
        status: 2,
      },
      eventNames: ['button', 'status'],
      firstReceivedAt: '2026-07-01T07:00:01.000Z',
      lastReceivedAt: '2026-07-01T07:00:04.000Z',
      totalEntries: 3,
    });
  });
});
