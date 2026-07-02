import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { basename, isAbsolute, resolve } from 'node:path';
import process from 'node:process';
import pino from 'pino';
import terminalKit from 'terminal-kit';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { connectSocketIo } from '../src/socket-io-client.ts';
import {
  addOutputLine,
  appendCommandCharacter,
  appendStreamEvent,
  appendStreamState,
  applySocketState,
  buildConsolePanels,
  computeConsoleLayout,
  clearStreamLines,
  createSocketConsoleState,
  parseConsoleCommand,
  popCommandCharacter,
  setConnectionStatus,
  setCommandMode,
  setHelpOverlay,
  setPaused,
  setRecordingState,
  type SocketConsoleState,
} from './socket-console.ts';
import {
  createRecordingSessionDir,
  summarizeRecordingDirectory,
  writeRecordingArtifacts,
  type RecordedSocketEntry,
} from './socket-recording.ts';

export const DEFAULT_SAMPLE_LIMIT = 3;
export const DEFAULT_DEPTH_LIMIT = 3;
const ANSI_ESCAPE_GLOBAL = new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g');
const ANSI_ESCAPE_START = new RegExp(String.raw`^\u001B\[[0-9;]*m`);
const DEFAULT_RECORDINGS_ROOT = fileURLToPath(
  new URL('../recordings/', import.meta.url),
);
const DEFAULT_REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export type SocketCliCommand = 'console' | 'monitor' | 'record' | 'summarize';

export type MonitorCliArgs = {
  baseUrl: string;
  command: 'monitor';
  depthLimit: number;
  sampleLimit: number;
};

type ConsoleCliArgs = {
  baseUrl: string;
  command: 'console';
  depthLimit: number;
  sampleLimit: number;
};

type RecordCliArgs = {
  baseUrl: string;
  command: 'record';
  depthLimit: number;
  label?: string;
  out?: string;
  sampleLimit: number;
};

type SummarizeCliArgs = {
  command: 'summarize';
  recordingPath: string;
};

export type SocketCliArgs =
  | ConsoleCliArgs
  | MonitorCliArgs
  | RecordCliArgs
  | SummarizeCliArgs;

type SocketCliDependencies = {
  connectSocketIo: typeof connectSocketIo;
  createLogger: typeof createSocketLogger;
  createRecordingSessionDir: typeof createRecordingSessionDir;
  createTerminal: typeof createSocketTerminal;
  summarizeRecordingDirectory: typeof summarizeRecordingDirectory;
  writeRecordingArtifacts: typeof writeRecordingArtifacts;
};

type SocketLogger = {
  info: (object: Record<string, unknown>, message: string) => void;
};

type SocketTerminal = {
  eraseDisplayBelow?: () => void;
  height?: number;
  grabInput: (options?: boolean | Record<string, unknown>) => void;
  moveTo?: (x: number, y: number, text?: string) => void;
  off: (event: 'key', listener: (name: string) => void) => void;
  on: (event: 'key', listener: (name: string) => void) => void;
  width?: number;
};

export function normalizeMachineBaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (url.search || url.hash) {
    throw new Error('baseUrl must not include a query string or fragment');
  }
  const pathname = url.pathname.replace(/\/+$/, '');

  if (pathname.endsWith('/api/v1')) {
    url.pathname = pathname.slice(0, -'/api/v1'.length) || '/';
  } else {
    url.pathname = pathname || '/';
  }

  return url.toString().replace(/\/+$/, '');
}

export function parseCliArgs(argv: string[]): SocketCliArgs {
  const result = yargs(argv)
    .scriptName('utils:socket')
    .command(
      'console <baseUrl>',
      'Run the interactive terminal console',
      (command) =>
        withSharedEventFlags(
          command.positional('baseUrl', {
            demandOption: true,
            describe: 'Machine base URL, for example http://<machine-ip>:8080',
            type: 'string',
          }),
        ),
    )
    .command(
      'monitor <baseUrl>',
      'Print a live stream of socket events',
      (command) =>
        withSharedEventFlags(
          command.positional('baseUrl', {
            demandOption: true,
            describe: 'Machine base URL, for example http://<machine-ip>:8080',
            type: 'string',
          }),
        ),
    )
    .command(
      'record <baseUrl>',
      'Capture raw and normalized socket recordings',
      (command) =>
        withSharedEventFlags(
          command
            .positional('baseUrl', {
              demandOption: true,
              describe:
                'Machine base URL, for example http://<machine-ip>:8080',
              type: 'string',
            })
            .option('label', {
              describe: 'Optional recording label',
              type: 'string',
            })
            .option('out', {
              describe: 'Optional output directory override',
              type: 'string',
            }),
        ),
    )
    .command(
      'summarize <recordingPath>',
      'Summarize a saved recording directory',
      (command) =>
        command.positional('recordingPath', {
          demandOption: true,
          describe: 'Path to a saved recording directory',
          type: 'string',
        }),
    )
    .demandCommand(1)
    .help(false)
    .parseSync();

  const command = result._[0];
  if (command === 'console') {
    return {
      baseUrl: result.baseUrl as string,
      command,
      depthLimit: result.depth as number,
      sampleLimit: result.samples as number,
    };
  }

  if (command === 'monitor') {
    return {
      baseUrl: result.baseUrl as string,
      command,
      depthLimit: result.depth as number,
      sampleLimit: result.samples as number,
    };
  }

  if (command === 'record') {
    return {
      baseUrl: result.baseUrl as string,
      command,
      depthLimit: result.depth as number,
      label: result.label as string | undefined,
      out: result.out as string | undefined,
      sampleLimit: result.samples as number,
    };
  }

  return {
    command: 'summarize',
    recordingPath: result.recordingPath as string,
  };
}

type ResolveRecordingPathOptions = {
  cwd?: string;
  exists?: (path: string) => Promise<boolean>;
  recordingsRoot?: string;
  repoRoot?: string;
};

export async function resolveRecordingPath(
  recordingPath: string,
  options: ResolveRecordingPathOptions = {},
) {
  const cwd = options.cwd ?? process.cwd();
  const exists = options.exists ?? pathExists;
  const recordingsRoot = options.recordingsRoot ?? DEFAULT_RECORDINGS_ROOT;
  const repoRoot = options.repoRoot ?? DEFAULT_REPO_ROOT;
  const candidates = isAbsolute(recordingPath)
    ? [recordingPath]
    : [
        resolve(cwd, recordingPath),
        resolve(repoRoot, recordingPath),
        resolve(recordingsRoot, basename(recordingPath)),
      ];

  for (const candidate of new Set(candidates)) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return isAbsolute(recordingPath)
    ? recordingPath
    : resolve(cwd, recordingPath);
}

function withSharedEventFlags<TBuilder extends ReturnType<typeof yargs>>(
  command: TBuilder,
): TBuilder {
  return command
    .option('samples', {
      default: DEFAULT_SAMPLE_LIMIT,
      describe: 'Maximum sample payloads to retain per event name',
      type: 'number',
    })
    .option('depth', {
      default: DEFAULT_DEPTH_LIMIT,
      describe: 'Maximum nested depth when describing payload shapes',
      type: 'number',
    }) as TBuilder;
}

function createSocketLogger(): SocketLogger {
  return pino({
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

function createSocketTerminal(): SocketTerminal {
  return terminalKit.terminal;
}

async function pathExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function registerQuitKeyHandler(
  terminal: SocketTerminal,
  onQuit: () => void | Promise<void>,
) {
  const onKey = (name: string) => {
    if (name.toLowerCase() !== 'q') {
      return;
    }

    void onQuit();
  };

  terminal.grabInput(true);
  terminal.on('key', onKey);

  return () => {
    terminal.off('key', onKey);
    terminal.grabInput(false);
  };
}

function renderConsole(terminal: SocketTerminal, state: SocketConsoleState) {
  const width = terminal.width ?? 100;
  const height = terminal.height ?? 30;
  const panels = buildConsolePanels(state, { height, width });

  if (panels.helpLines) {
    terminal.moveTo?.(1, 1);
    terminal.eraseDisplayBelow?.();
    drawPanel(terminal, 1, 1, width, height, 'Help', panels.helpLines);
    return;
  }

  const { bottomHeight, bottomY, leftWidth, rightWidth, topHeight } =
    computeConsoleLayout(state, { height, width });

  terminal.moveTo?.(1, 1);
  terminal.eraseDisplayBelow?.();
  drawPanel(
    terminal,
    1,
    1,
    leftWidth,
    topHeight,
    'Summary',
    panels.summaryLines,
  );
  drawPanel(
    terminal,
    leftWidth + 2,
    1,
    rightWidth,
    topHeight,
    'Stream',
    panels.streamLines,
    panels.streamTitleRight,
  );
  drawPanel(
    terminal,
    1,
    bottomY,
    width,
    bottomHeight,
    'Commands',
    panels.commandLines,
  );
}

function drawPanel(
  terminal: SocketTerminal,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  lines: string[],
  titleRight?: string,
) {
  const innerWidth = Math.max(0, width - 2);
  const bottom = styleBorder(`└${'─'.repeat(innerWidth)}┘`);
  const leftTitle = truncateText(` ${title} `, innerWidth);
  const rightTitle = titleRight
    ? truncateText(` ${titleRight} `, innerWidth)
    : '';
  const visibleTitleWidth =
    visibleLength(leftTitle) + visibleLength(rightTitle);
  const titleFill = Math.max(0, innerWidth - visibleTitleWidth);
  const titleContent = rightTitle
    ? `${leftTitle}${'─'.repeat(titleFill)}${rightTitle}`
    : padVisibleText(leftTitle, innerWidth, '─');
  const titleLine = styleBorder(`┌${titleContent}┐`);

  terminal.moveTo?.(x, y, titleLine);

  for (let row = 0; row < height - 2; row += 1) {
    const line = lines[row] ?? '';
    terminal.moveTo?.(
      x,
      y + row + 1,
      `${styleBorder('│')}${padVisibleText(truncateText(line, innerWidth), innerWidth)}${styleBorder('│')}`,
    );
  }

  terminal.moveTo?.(x, y + height - 1, bottom);
}

function truncateText(value: string, width: number) {
  if (visibleLength(value) <= width) {
    return value;
  }

  const targetWidth = Math.max(0, width - 3);
  let visible = 0;
  let output = '';

  for (let index = 0; index < value.length; index += 1) {
    const escapeMatch = ANSI_ESCAPE_START.exec(value.slice(index));
    if (escapeMatch) {
      output += escapeMatch[0];
      index += escapeMatch[0].length - 1;
      continue;
    }

    if (visible >= targetWidth) {
      break;
    }

    output += value[index];
    visible += 1;
  }

  return `${output}...`;
}

function padVisibleText(value: string, width: number, fill = ' ') {
  const padding = Math.max(0, width - visibleLength(value));
  return `${value}${fill.repeat(padding)}`;
}

function visibleLength(value: string) {
  return value.replace(ANSI_ESCAPE_GLOBAL, '').length;
}

function styleBorder(value: string) {
  return `\u001B[38;5;244m${value}\u001B[0m`;
}

async function runMonitorCommand(
  args: MonitorCliArgs,
  dependencies: SocketCliDependencies,
) {
  const logger = dependencies.createLogger();
  const terminal = dependencies.createTerminal();

  logger.info(
    {
      baseUrl: args.baseUrl,
      command: 'monitor',
    },
    'monitoring started',
  );

  let connection: Awaited<ReturnType<typeof dependencies.connectSocketIo>>;

  try {
    connection = await dependencies.connectSocketIo({
      baseUrl: normalizeMachineBaseUrl(args.baseUrl),
      onStateChange: (state) => {
        logger.info(
          {
            command: 'monitor',
            kind: 'state',
            state,
          },
          'socket state',
        );
      },
    });
  } catch (error) {
    logger.info(
      {
        command: 'monitor',
        error: error instanceof Error ? error.message : String(error),
      },
      'monitor connect error',
    );
    return;
  }

  connection.onAny((eventName, ...payload) => {
    logger.info(
      {
        command: 'monitor',
        event: eventName,
        kind: 'event',
        payload,
      },
      'socket event',
    );
  });

  const cleanupQuitHandler = registerQuitKeyHandler(terminal, () => {
    cleanupQuitHandler();
    connection.close();
    process.exit(0);
  });
}

async function runConsoleCommand(
  args: ConsoleCliArgs,
  dependencies: SocketCliDependencies,
) {
  const logger = dependencies.createLogger();
  const terminal = dependencies.createTerminal();
  const state = createSocketConsoleState(args.baseUrl);
  const entries: RecordedSocketEntry[] = [];
  const rootDir = DEFAULT_RECORDINGS_ROOT;
  let connection:
    | Awaited<ReturnType<typeof dependencies.connectSocketIo>>
    | undefined;
  let renderScheduled = false;

  const render = () => {
    renderScheduled = false;
    renderConsole(terminal, state);
  };

  const scheduleRender = () => {
    if (renderScheduled) {
      return;
    }

    renderScheduled = true;
    setTimeout(render, 16);
  };

  const startRecording = async (label?: string) => {
    if (state.recording.active) {
      addOutputLine(state, 'recording already active');
      scheduleRender();
      return;
    }

    const sessionDir = await dependencies.createRecordingSessionDir({
      label,
      rootDir,
    });

    entries.length = 0;
    setRecordingState(state, {
      active: true,
      sessionDir,
    });
    addOutputLine(state, `recording started: ${sessionDir}`);
    scheduleRender();
  };

  const stopRecording = async () => {
    if (!state.recording.active || !state.recording.sessionDir) {
      addOutputLine(state, 'recording is not active');
      scheduleRender();
      return;
    }

    await dependencies.writeRecordingArtifacts({
      entries: [...entries],
      sessionDir: state.recording.sessionDir,
    });
    addOutputLine(state, `recording saved: ${state.recording.sessionDir}`);
    setRecordingState(state, { active: false });
    entries.length = 0;
    scheduleRender();
  };

  const disconnect = async () => {
    if (!connection) {
      addOutputLine(state, 'already disconnected');
      scheduleRender();
      return;
    }

    connection.close();
    connection = undefined;
    applySocketState(state, {
      connected: false,
      socketId: undefined,
      transport: undefined,
    });
    setConnectionStatus(state, 'disconnected');
    scheduleRender();
  };

  const connect = async () => {
    setConnectionStatus(state, 'connecting');
    scheduleRender();

    try {
      connection = await dependencies.connectSocketIo({
        baseUrl: normalizeMachineBaseUrl(args.baseUrl),
        onStateChange: (socketState) => {
          applySocketState(state, socketState);
          appendStreamState(state, socketState);
          if (state.recording.active) {
            const receivedAt = new Date().toISOString();
            entries.push({
              kind: 'state',
              receivedAt,
              receivedAtMs: Date.parse(receivedAt),
              state: socketState,
            });
          }
          scheduleRender();
        },
      });

      connection.onAny((eventName, ...payload) => {
        appendStreamEvent(state, eventName, payload);
        if (state.recording.active) {
          const receivedAt = new Date().toISOString();
          entries.push({
            event: eventName,
            kind: 'event',
            payload,
            receivedAt,
            receivedAtMs: Date.parse(receivedAt),
          });
        }
        scheduleRender();
      });

      setConnectionStatus(state, 'connected');
      scheduleRender();
    } catch (error) {
      logger.info(
        {
          command: 'console',
          error: error instanceof Error ? error.message : String(error),
        },
        'console connect error',
      );
      addOutputLine(
        state,
        `connect failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      scheduleRender();
    }
  };

  const executeCommand = async (input: string) => {
    const command = parseConsoleCommand(input);
    switch (command.kind) {
      case 'help':
        setHelpOverlay(state, true);
        break;
      case 'clear':
        clearStreamLines(state);
        addOutputLine(state, 'stream cleared');
        break;
      case 'pause':
        setPaused(state, true);
        addOutputLine(state, 'stream paused');
        break;
      case 'resume':
        setPaused(state, false);
        addOutputLine(state, 'stream resumed');
        break;
      case 'reconnect':
        await disconnect();
        await connect();
        return;
      case 'disconnect':
        await disconnect();
        return;
      case 'record-start':
        await startRecording(command.label);
        return;
      case 'record-stop':
        await stopRecording();
        return;
      case 'quit':
        await quit();
        return;
      case 'stub-action':
        addOutputLine(state, `${command.name}: not yet implemented`);
        break;
      case 'unknown':
        addOutputLine(state, `unknown command: ${command.input}`);
        break;
    }

    scheduleRender();
  };

  const onKey = async (name: string) => {
    if (state.helpOverlay) {
      if (name === 'ESCAPE' || name === 'h') {
        setHelpOverlay(state, false);
        scheduleRender();
      }
      return;
    }

    if (state.commandMode) {
      if (name === 'ENTER') {
        const input = state.commandBuffer;
        setCommandMode(state, false);
        await executeCommand(input);
        return;
      }

      if (name === 'BACKSPACE') {
        popCommandCharacter(state);
        scheduleRender();
        return;
      }

      if (name === 'ESCAPE') {
        setCommandMode(state, false);
        scheduleRender();
        return;
      }

      if (name.length === 1) {
        appendCommandCharacter(state, name);
        scheduleRender();
      }
      return;
    }

    switch (name) {
      case ':':
        setCommandMode(state, true);
        scheduleRender();
        return;
      case 'c':
        await executeCommand('clear');
        return;
      case 'h':
        setHelpOverlay(state, true);
        scheduleRender();
        return;
      case 'p':
        await executeCommand(state.paused ? 'resume' : 'pause');
        return;
      case 'q':
        await quit();
        return;
      case 'r':
        await executeCommand(
          state.recording.active ? 'record stop' : 'record start',
        );
        return;
      default:
        return;
    }
  };

  const quit = async () => {
    terminal.off('key', onKey);
    terminal.grabInput(false);
    if (state.recording.active) {
      await stopRecording();
    }
    if (connection) {
      connection.close();
    }
    process.exit(0);
  };

  terminal.grabInput(true);
  terminal.on('key', onKey);
  render();
  await connect();
}

async function runRecordCommand(
  args: RecordCliArgs,
  dependencies: SocketCliDependencies,
) {
  const entries: RecordedSocketEntry[] = [];
  const rootDir = args.out ?? DEFAULT_RECORDINGS_ROOT;
  const sessionDir = await dependencies.createRecordingSessionDir({
    label: args.label,
    rootDir,
  });
  const logger = dependencies.createLogger();
  const terminal = dependencies.createTerminal();

  logger.info(
    {
      baseUrl: args.baseUrl,
      command: 'record',
      sessionDir,
    },
    'recording started',
  );

  let connection: Awaited<ReturnType<typeof dependencies.connectSocketIo>>;

  try {
    connection = await dependencies.connectSocketIo({
      baseUrl: normalizeMachineBaseUrl(args.baseUrl),
      onStateChange: (state) => {
        const receivedAt = new Date().toISOString();
        const entry: RecordedSocketEntry = {
          kind: 'state',
          receivedAt,
          receivedAtMs: Date.parse(receivedAt),
          state,
        };

        entries.push(entry);
        logger.info(
          {
            command: 'record',
            kind: 'state',
            state,
          },
          'socket state',
        );
      },
    });
  } catch (error) {
    logger.info(
      {
        command: 'record',
        error: error instanceof Error ? error.message : String(error),
        sessionDir,
      },
      'record connect error',
    );
    return;
  }

  connection.onAny((eventName, ...payload) => {
    const receivedAt = new Date().toISOString();
    const entry: RecordedSocketEntry = {
      event: eventName,
      kind: 'event',
      payload,
      receivedAt,
      receivedAtMs: Date.parse(receivedAt),
    };

    entries.push(entry);
    logger.info(
      {
        command: 'record',
        event: eventName,
        kind: 'event',
        payload,
      },
      'socket event',
    );
  });

  const cleanupQuitHandler = registerQuitKeyHandler(terminal, async () => {
    cleanupQuitHandler();
    connection.close();
    await dependencies.writeRecordingArtifacts({ entries, sessionDir });
    logger.info(
      {
        command: 'record',
        entries: entries.length,
        sessionDir,
      },
      'recording saved',
    );
    process.exit(0);
  });
}

async function runSummarizeCommand(
  args: SummarizeCliArgs,
  dependencies: SocketCliDependencies,
) {
  const summary = await dependencies.summarizeRecordingDirectory(
    await resolveRecordingPath(args.recordingPath),
  );

  console.log(JSON.stringify(summary, null, 2));
}

export async function runCli(
  argv: string[],
  dependencies: Partial<SocketCliDependencies> = {},
) {
  const args = parseCliArgs(argv);
  const resolvedDependencies: SocketCliDependencies = {
    connectSocketIo: dependencies.connectSocketIo ?? connectSocketIo,
    createLogger: dependencies.createLogger ?? createSocketLogger,
    createRecordingSessionDir:
      dependencies.createRecordingSessionDir ?? createRecordingSessionDir,
    createTerminal: dependencies.createTerminal ?? createSocketTerminal,
    summarizeRecordingDirectory:
      dependencies.summarizeRecordingDirectory ?? summarizeRecordingDirectory,
    writeRecordingArtifacts:
      dependencies.writeRecordingArtifacts ?? writeRecordingArtifacts,
  };

  if (args.command === 'console') {
    await runConsoleCommand(args, resolvedDependencies);
    return;
  }

  if (args.command === 'monitor') {
    await runMonitorCommand(args, resolvedDependencies);
    return;
  }

  if (args.command === 'record') {
    await runRecordCommand(args, resolvedDependencies);
    return;
  }

  await runSummarizeCommand(args, resolvedDependencies);
}

if (import.meta.main) {
  await runCli(hideBin(process.argv));
}
