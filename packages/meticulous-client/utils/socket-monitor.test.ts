import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DEPTH_LIMIT,
  DEFAULT_SAMPLE_LIMIT,
  normalizeMachineBaseUrl,
  parseCliArgs,
  resolveRecordingPath,
  runCli,
} from './socket-monitor.ts';

const ANSI_ESCAPE_GLOBAL = new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g');

function stripAnsi(value: string) {
  return value.replace(ANSI_ESCAPE_GLOBAL, '');
}

describe('parseCliArgs', () => {
  it('parses the monitor subcommand with defaults', () => {
    expect(
      parseCliArgs(['monitor', 'http://machine.local:8080']),
    ).toStrictEqual({
      baseUrl: 'http://machine.local:8080',
      command: 'monitor',
      depthLimit: DEFAULT_DEPTH_LIMIT,
      sampleLimit: DEFAULT_SAMPLE_LIMIT,
    });
  });

  it('parses monitor overrides for samples and depth', () => {
    expect(
      parseCliArgs([
        'monitor',
        'http://machine.local:8080',
        '--samples',
        '7',
        '--depth',
        '5',
      ]),
    ).toStrictEqual({
      baseUrl: 'http://machine.local:8080',
      command: 'monitor',
      depthLimit: 5,
      sampleLimit: 7,
    });
  });

  it('parses the record subcommand with optional output flags', () => {
    expect(
      parseCliArgs([
        'record',
        'http://machine.local:8080',
        '--label',
        'Morning Brew',
        '--out',
        '/tmp/shot',
      ]),
    ).toStrictEqual({
      baseUrl: 'http://machine.local:8080',
      command: 'record',
      depthLimit: DEFAULT_DEPTH_LIMIT,
      label: 'Morning Brew',
      out: '/tmp/shot',
      sampleLimit: DEFAULT_SAMPLE_LIMIT,
    });
  });

  it('parses the summarize subcommand', () => {
    expect(parseCliArgs(['summarize', '/tmp/shot/session-1'])).toStrictEqual({
      command: 'summarize',
      recordingPath: '/tmp/shot/session-1',
    });
  });

  it('parses the console subcommand', () => {
    expect(
      parseCliArgs(['console', 'http://machine.local:8080']),
    ).toStrictEqual({
      baseUrl: 'http://machine.local:8080',
      command: 'console',
      depthLimit: DEFAULT_DEPTH_LIMIT,
      sampleLimit: DEFAULT_SAMPLE_LIMIT,
    });
  });
});

describe('normalizeMachineBaseUrl', () => {
  it('strips an api path suffix', () => {
    expect(normalizeMachineBaseUrl('http://machine.local:8080/api/v1')).toBe(
      'http://machine.local:8080',
    );
  });

  it('rejects query strings and fragments', () => {
    expect(() =>
      normalizeMachineBaseUrl('http://machine.local:8080?debug=1'),
    ).toThrow('baseUrl must not include a query string or fragment');

    expect(() =>
      normalizeMachineBaseUrl('http://machine.local:8080/#hash'),
    ).toThrow('baseUrl must not include a query string or fragment');
  });
});

describe('resolveRecordingPath', () => {
  it('returns a cwd-relative match first', async () => {
    const exists = vi.fn(async (path: string) => {
      return path === '/tmp/session-1';
    });

    await expect(
      resolveRecordingPath('session-1', {
        cwd: '/tmp',
        exists,
        recordingsRoot: '/repo/packages/meticulous-client/recordings',
        repoRoot: '/repo',
      }),
    ).resolves.toBe('/tmp/session-1');
  });

  it('resolves repo-root-relative recording paths outside the repo root cwd', async () => {
    const exists = vi.fn(async (path: string) => {
      return path === '/repo/packages/meticulous-client/recordings/session-1';
    });

    await expect(
      resolveRecordingPath('packages/meticulous-client/recordings/session-1', {
        cwd: '/tmp',
        exists,
        recordingsRoot: '/repo/packages/meticulous-client/recordings',
        repoRoot: '/repo',
      }),
    ).resolves.toBe('/repo/packages/meticulous-client/recordings/session-1');
  });

  it('falls back to the recordings root basename match', async () => {
    const exists = vi.fn(async (path: string) => {
      return path === '/repo/packages/meticulous-client/recordings/session-1';
    });

    await expect(
      resolveRecordingPath('nested/path/session-1', {
        cwd: '/tmp',
        exists,
        recordingsRoot: '/repo/packages/meticulous-client/recordings',
        repoRoot: '/repo',
      }),
    ).resolves.toBe('/repo/packages/meticulous-client/recordings/session-1');
  });

  it('returns absolute paths unchanged when they exist', async () => {
    const exists = vi.fn(async (path: string) => {
      return path === '/abs/session-1';
    });

    await expect(
      resolveRecordingPath('/abs/session-1', {
        exists,
      }),
    ).resolves.toBe('/abs/session-1');
  });

  it('defaults to the cwd-relative path when no candidates exist', async () => {
    const exists = vi.fn(async () => false);

    await expect(
      resolveRecordingPath('session-1', {
        cwd: '/tmp',
        exists,
        recordingsRoot: '/repo/packages/meticulous-client/recordings',
        repoRoot: '/repo',
      }),
    ).resolves.toBe('/tmp/session-1');
  });
});

describe('runCli', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints a saved recording summary', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await runCli(['summarize', '/tmp/shot/session-1'], {
      summarizeRecordingDirectory: vi.fn().mockResolvedValue({
        eventCounts: { status: 2 },
        eventNames: ['status'],
        firstReceivedAt: '2026-07-01T07:00:01.000Z',
        lastReceivedAt: '2026-07-01T07:00:04.000Z',
        totalEntries: 2,
      }),
    });

    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          eventCounts: { status: 2 },
          eventNames: ['status'],
          firstReceivedAt: '2026-07-01T07:00:01.000Z',
          lastReceivedAt: '2026-07-01T07:00:04.000Z',
          totalEntries: 2,
        },
        null,
        2,
      ),
    );
  });

  it('logs a clean monitor connection error instead of throwing', async () => {
    const logger = {
      info: vi.fn(),
    };

    await expect(
      runCli(['monitor', 'http://machine.local:8080'], {
        connectSocketIo: vi.fn().mockRejectedValue(new Error('offline')),
        createLogger: vi.fn().mockReturnValue(logger),
        createTerminal: vi.fn().mockReturnValue(createFakeTerminal()),
      }),
    ).resolves.toBeUndefined();

    expect(logger.info).toHaveBeenCalledWith(
      {
        command: 'monitor',
        error: 'offline',
      },
      'monitor connect error',
    );
  });

  it('logs structured state and event records during a record session', async () => {
    const logger = {
      info: vi.fn(),
    };
    const createLogger = vi.fn().mockReturnValue(logger);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const terminal = createFakeTerminal();

    let onAnyListener:
      | ((eventName: string, ...payload: unknown[]) => void)
      | undefined;
    let onStateChangeListener:
      | ((state: {
          connected: boolean;
          error?: string;
          socketId?: string;
          transport?: string;
        }) => void)
      | undefined;

    await runCli(['record', 'http://machine.local:8080'], {
      connectSocketIo: vi.fn().mockImplementation(async (options) => {
        onStateChangeListener = options.onStateChange;

        return {
          close: vi.fn(),
          getState: vi.fn(),
          onAny: (
            listener: (eventName: string, ...payload: unknown[]) => void,
          ) => {
            onAnyListener = listener;
          },
        };
      }),
      createLogger,
      createRecordingSessionDir: vi
        .fn()
        .mockResolvedValue('/tmp/shot/session-1'),
      createTerminal: vi.fn().mockReturnValue(terminal),
      writeRecordingArtifacts: vi.fn().mockResolvedValue(undefined),
    });

    onStateChangeListener?.({
      connected: true,
      socketId: 'socket-1',
      transport: 'websocket',
    });
    onAnyListener?.('status', { sensors: { p: 7.9 }, time: 22.4 });

    terminal.emitKey('q');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createLogger).toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      {
        baseUrl: 'http://machine.local:8080',
        command: 'record',
        sessionDir: '/tmp/shot/session-1',
      },
      'recording started',
    );
    expect(logger.info).toHaveBeenCalledWith(
      {
        command: 'record',
        kind: 'state',
        state: {
          connected: true,
          socketId: 'socket-1',
          transport: 'websocket',
        },
      },
      'socket state',
    );
    expect(logger.info).toHaveBeenCalledWith(
      {
        command: 'record',
        event: 'status',
        kind: 'event',
        payload: [{ sensors: { p: 7.9 }, time: 22.4 }],
      },
      'socket event',
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('logs a clean record connection error instead of throwing', async () => {
    const logger = {
      info: vi.fn(),
    };

    await expect(
      runCli(['record', 'http://machine.local:8080'], {
        connectSocketIo: vi.fn().mockRejectedValue(new Error('offline')),
        createLogger: vi.fn().mockReturnValue(logger),
        createRecordingSessionDir: vi
          .fn()
          .mockResolvedValue('/tmp/shot/session-1'),
        createTerminal: vi.fn().mockReturnValue(createFakeTerminal()),
      }),
    ).resolves.toBeUndefined();

    expect(logger.info).toHaveBeenCalledWith(
      {
        command: 'record',
        error: 'offline',
        sessionDir: '/tmp/shot/session-1',
      },
      'record connect error',
    );
  });

  it('writes recording artifacts when a record session is interrupted', async () => {
    const logger = {
      info: vi.fn(),
    };
    const createLogger = vi.fn().mockReturnValue(logger);
    const writeRecordingArtifacts = vi.fn().mockResolvedValue(undefined);
    const createRecordingSessionDir = vi
      .fn()
      .mockResolvedValue('/tmp/shot/session-1');
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const terminal = createFakeTerminal();

    let onAnyListener:
      | ((eventName: string, ...payload: unknown[]) => void)
      | undefined;
    let onStateChangeListener:
      | ((state: {
          connected: boolean;
          error?: string;
          socketId?: string;
          transport?: string;
        }) => void)
      | undefined;

    await runCli(['record', 'http://machine.local:8080'], {
      connectSocketIo: vi.fn().mockImplementation(async (options) => {
        onStateChangeListener = options.onStateChange;

        return {
          close: vi.fn(),
          getState: vi.fn(),
          onAny: (
            listener: (eventName: string, ...payload: unknown[]) => void,
          ) => {
            onAnyListener = listener;
          },
        };
      }),
      createLogger,
      createRecordingSessionDir,
      createTerminal: vi.fn().mockReturnValue(terminal),
      writeRecordingArtifacts,
    });

    onStateChangeListener?.({
      connected: true,
      socketId: 'socket-1',
      transport: 'websocket',
    });
    onAnyListener?.('status', {
      profile_time: 9.2,
      sensors: { p: 7.9, t: 91.4, w: 15.3 },
      time: 22.4,
    });

    terminal.emitKey('q');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(createRecordingSessionDir).toHaveBeenCalled();
    expect(writeRecordingArtifacts).toHaveBeenCalledTimes(1);
    expect(writeRecordingArtifacts.mock.calls[0]?.[0]).toMatchObject({
      entries: [
        {
          kind: 'state',
          state: {
            connected: true,
            socketId: 'socket-1',
            transport: 'websocket',
          },
        },
        {
          event: 'status',
          kind: 'event',
          payload: [
            {
              profile_time: 9.2,
              sensors: { p: 7.9, t: 91.4, w: 15.3 },
              time: 22.4,
            },
          ],
        },
      ],
      sessionDir: '/tmp/shot/session-1',
    });
    expect(logger.info).toHaveBeenCalledWith(
      {
        command: 'record',
        entries: 2,
        sessionDir: '/tmp/shot/session-1',
      },
      'recording saved',
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('runs the console mode with help and stub action feedback', async () => {
    const logger = {
      info: vi.fn(),
    };
    const createLogger = vi.fn().mockReturnValue(logger);
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const terminal = createFakeRenderTerminal();

    let onAnyListener:
      | ((eventName: string, ...payload: unknown[]) => void)
      | undefined;
    let onStateChangeListener:
      | ((state: {
          connected: boolean;
          error?: string;
          socketId?: string;
          transport?: string;
        }) => void)
      | undefined;

    await runCli(['console', 'http://machine.local:8080'], {
      connectSocketIo: vi.fn().mockImplementation(async (options) => {
        onStateChangeListener = options.onStateChange;

        return {
          close: vi.fn(),
          getState: vi.fn(),
          onAny: (
            listener: (eventName: string, ...payload: unknown[]) => void,
          ) => {
            onAnyListener = listener;
          },
        };
      }),
      createLogger,
      createRecordingSessionDir: vi
        .fn()
        .mockResolvedValue('/tmp/shot/session-1'),
      createTerminal: vi.fn().mockReturnValue(terminal),
      writeRecordingArtifacts: vi.fn().mockResolvedValue(undefined),
    });

    onStateChangeListener?.({
      connected: true,
      socketId: 'socket-1',
      transport: 'websocket',
    });
    onAnyListener?.('status', { sensors: { p: 7.9 }, time: 22.4 });
    onAnyListener?.('sensors', { p: 8.1, t_tube: 92.0, weight_pred: 16.4 });

    terminal.emitKey('h');
    await new Promise((resolve) => setTimeout(resolve, 20));
    let output = stripAnsi(terminal.renderedOutput());
    expect(output).toContain('Console Help');
    expect(output).toContain('Stub machine commands (not yet implemented)');

    terminal.emitKey('ESCAPE');
    await new Promise((resolve) => setTimeout(resolve, 20));
    output = stripAnsi(terminal.renderedOutput());
    expect(output).not.toContain('Console Help');
    expect(output).toContain('Press : for commands');

    terminal.emitKey(':');
    terminal.emitKey('t');
    terminal.emitKey('a');
    terminal.emitKey('r');
    terminal.emitKey('e');
    terminal.emitKey('ENTER');
    await new Promise((resolve) => setTimeout(resolve, 20));
    terminal.emitKey('q');
    await new Promise((resolve) => setTimeout(resolve, 20));

    output = stripAnsi(terminal.renderedOutput());
    expect(output).toContain('tare: not yet implemented');
    expect(output).toContain('Connected');
    expect(output).toContain('Connection: connected');
    expect(output).toContain('Last event: sensors');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

function createFakeTerminal() {
  let keyListener: ((name: string) => void) | undefined;

  return {
    emitKey: (name: string) => {
      keyListener?.(name);
    },
    grabInput: vi.fn(),
    off: vi.fn((event: string, listener: (name: string) => void) => {
      if (event === 'key' && keyListener === listener) {
        keyListener = undefined;
      }
    }),
    on: vi.fn((event: string, listener: (name: string) => void) => {
      if (event === 'key') {
        keyListener = listener;
      }

      return undefined;
    }),
  };
}

function createFakeRenderTerminal() {
  let keyListener: ((name: string) => void) | undefined;
  const writes: string[] = [];

  return {
    emitKey: (name: string) => {
      keyListener?.(name);
    },
    eraseDisplayBelow: vi.fn(() => {
      writes.length = 0;
    }),
    grabInput: vi.fn(),
    height: 30,
    moveTo: vi.fn((x: number, y: number, text?: string) => {
      if (text) {
        writes.push(text);
      }
    }),
    off: vi.fn((event: string, listener: (name: string) => void) => {
      if (event === 'key' && keyListener === listener) {
        keyListener = undefined;
      }
    }),
    on: vi.fn((event: string, listener: (name: string) => void) => {
      if (event === 'key') {
        keyListener = listener;
      }

      return undefined;
    }),
    renderedOutput: () => writes.join('\n'),
    width: 100,
  };
}
