import { Chalk } from 'chalk';
import type { SocketIoState } from '../src/socket-io-client.ts';
import { parseSocketPayloadMetrics } from './socket-payload.ts';

type ConsoleCommand =
  | { kind: 'clear' }
  | { kind: 'disconnect' }
  | { kind: 'help' }
  | { kind: 'pause' }
  | { kind: 'quit' }
  | { kind: 'reconnect' }
  | { kind: 'record-start'; label?: string }
  | { kind: 'record-stop' }
  | { kind: 'resume' }
  | {
      kind: 'stub-action';
      name: 'preheat' | 'purge' | 'raise' | 'stop' | 'tare';
    }
  | { kind: 'unknown'; input: string };

type ConsoleMetrics = {
  pressure?: number;
  profileTime?: number;
  temperature?: number;
  weight?: number;
};

export type SocketConsoleStreamEntry = {
  detail: string;
  eventName: string;
  line: string;
};

export type SocketConsoleState = {
  baseUrl: string;
  commandBuffer: string;
  commandMode: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  connectionState?: SocketIoState;
  eventCounts: Record<string, number>;
  helpOverlay: boolean;
  lastEventName?: string;
  metrics: ConsoleMetrics;
  outputLines: string[];
  paused: boolean;
  pausedStreamLength?: number;
  recording: {
    active: boolean;
    sessionDir?: string;
  };
  streamEntries: SocketConsoleStreamEntry[];
};

type ConsolePanels = {
  commandLines: string[];
  helpLines?: string[];
  streamTitleRight?: string;
  streamLines: string[];
  summaryLines: string[];
};

type ConsoleSize = {
  height: number;
  width: number;
};

export type ConsoleLayout = {
  bottomHeight: number;
  bottomY: number;
  leftWidth: number;
  rightWidth: number;
  topHeight: number;
};

const chalk = new Chalk({ level: 3 });

const MAX_OUTPUT_LINES = 1;
const MAX_STREAM_LINES = 400;
const EVENT_NAME_COLUMN_WIDTH = 14;
const METRIC_FIELD_WIDTH = 12;
const ANSI_ESCAPE_GLOBAL = new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g');
const ANSI_ESCAPE_START = new RegExp(String.raw`^\u001B\[[0-9;]*m`);
const CONSOLE_THEME = {
  hotkey: chalk.greenBright,
  label: chalk.cyanBright,
  metricEquals: chalk.dim,
  metricKey: chalk.cyanBright,
  metricValue: chalk.yellowBright,
  statusConnected: chalk.greenBright,
  statusConnecting: chalk.yellowBright,
  statusDisconnected: chalk.hex('#f5a623'),
} as const;

export function createSocketConsoleState(baseUrl: string): SocketConsoleState {
  return {
    baseUrl,
    commandBuffer: '',
    commandMode: false,
    connectionStatus: 'disconnected',
    eventCounts: {},
    helpOverlay: false,
    metrics: {},
    outputLines: [],
    paused: false,
    pausedStreamLength: undefined,
    recording: {
      active: false,
    },
    streamEntries: [],
  };
}

export function parseConsoleCommand(input: string): ConsoleCommand {
  const trimmed = input.trim();
  if (!trimmed) {
    return { kind: 'help' };
  }

  const parts = trimmed.split(/\s+/);
  const [command, ...rest] = parts;

  switch (command) {
    case 'clear':
      return { kind: 'clear' };
    case 'disconnect':
      return { kind: 'disconnect' };
    case 'help':
      return { kind: 'help' };
    case 'pause':
      return { kind: 'pause' };
    case 'preheat':
    case 'purge':
    case 'raise':
    case 'stop':
    case 'tare':
      return { kind: 'stub-action', name: command };
    case 'quit':
      return { kind: 'quit' };
    case 'reconnect':
      return { kind: 'reconnect' };
    case 'record':
      if (rest[0] === 'start') {
        return {
          kind: 'record-start',
          label: rest.slice(1).join(' ') || undefined,
        };
      }

      if (rest[0] === 'stop') {
        return { kind: 'record-stop' };
      }

      return { input: trimmed, kind: 'unknown' };
    case 'resume':
      return { kind: 'resume' };
    default:
      return { input: trimmed, kind: 'unknown' };
  }
}

export function buildConsoleHelpLines() {
  return [
    'Console Help',
    '',
    formatCommandLabel('Hotkeys'),
    formatHelpHotkeyLine('q', 'quit'),
    formatHelpHotkeyLine('h', 'toggle help'),
    formatHelpHotkeyLine('c', 'clear the stream panel'),
    formatHelpHotkeyLine('p', 'pause/resume live scrolling'),
    formatHelpHotkeyLine('r', 'start/stop recording'),
    formatHelpHotkeyLine(':', 'enter command mode'),
    formatHelpHotkeyLine('esc', 'close help or exit command mode'),
    '',
    formatCommandLabel('Commands'),
    formatCommandListLine('help'),
    formatCommandListLine('clear'),
    formatCommandListLine('pause'),
    formatCommandListLine('resume'),
    formatCommandListLine('reconnect'),
    formatCommandListLine('disconnect'),
    formatCommandListLine('record start [label]'),
    formatCommandListLine('record stop'),
    formatCommandListLine('quit'),
    '',
    `${formatCommandLabel('Stub machine commands (not yet implemented)')} ${[
      formatHotkey('tare'),
      formatHotkey('preheat'),
      formatHotkey('raise'),
      formatHotkey('purge'),
      formatHotkey('stop'),
    ].join(', ')}`,
  ];
}

export function applySocketState(
  state: SocketConsoleState,
  connectionState: SocketIoState,
) {
  state.connectionStatus = connectionState.connected
    ? 'connected'
    : 'disconnected';
  state.connectionState = connectionState;
}

export function appendStreamEvent(
  state: SocketConsoleState,
  eventName: string,
  payload: unknown[],
) {
  state.eventCounts[eventName] = (state.eventCounts[eventName] ?? 0) + 1;
  state.lastEventName = eventName;
  state.metrics = {
    ...state.metrics,
    ...parseSocketPayloadMetrics(payload),
  };

  pushStreamEntry(state, {
    detail: JSON.stringify(payload, null, 2),
    eventName,
    line: formatEventRow(eventName, payload),
  });
}

export function appendStreamState(
  state: SocketConsoleState,
  connectionState: SocketIoState,
) {
  applySocketState(state, connectionState);
  pushStreamEntry(state, {
    detail: JSON.stringify(connectionState, null, 2),
    eventName: 'state',
    line: formatStateRow(connectionState),
  });
}

export function setCommandMode(state: SocketConsoleState, nextValue: boolean) {
  state.commandMode = nextValue;
  if (!nextValue) {
    state.commandBuffer = '';
  }
}

export function appendCommandCharacter(
  state: SocketConsoleState,
  character: string,
) {
  state.commandBuffer += character;
}

export function popCommandCharacter(state: SocketConsoleState) {
  state.commandBuffer = state.commandBuffer.slice(0, -1);
}

export function setOutputLines(state: SocketConsoleState, lines: string[]) {
  state.outputLines = lines.slice(-MAX_OUTPUT_LINES);
}

export function addOutputLine(state: SocketConsoleState, line: string) {
  state.outputLines = [...state.outputLines, line].slice(-MAX_OUTPUT_LINES);
}

export function setConnectionStatus(
  state: SocketConsoleState,
  nextStatus: SocketConsoleState['connectionStatus'],
) {
  state.connectionStatus = nextStatus;
}

export function clearStreamLines(state: SocketConsoleState) {
  state.streamEntries = [];
  state.pausedStreamLength = state.paused ? 0 : undefined;
}

export function setPaused(state: SocketConsoleState, paused: boolean) {
  state.paused = paused;
  state.pausedStreamLength = paused ? state.streamEntries.length : undefined;
}

export function setRecordingState(
  state: SocketConsoleState,
  nextRecordingState: { active: boolean; sessionDir?: string },
) {
  state.recording = nextRecordingState;
}

export function setHelpOverlay(state: SocketConsoleState, nextValue: boolean) {
  state.helpOverlay = nextValue;
}

export function buildConsolePanels(
  state: SocketConsoleState,
  size: ConsoleSize,
): ConsolePanels {
  const { bottomHeight, leftWidth, rightWidth, topHeight } =
    computeConsoleLayout(state, size);

  if (state.helpOverlay) {
    return {
      commandLines: [],
      helpLines: fitLines(buildConsoleHelpLines(), size.width, size.height),
      streamLines: [],
      streamTitleRight: undefined,
      summaryLines: [],
    };
  }

  const lastOutputLine = state.outputLines.at(-1) ?? '';
  const commandPanelLines = state.commandMode
    ? [
        formatCommandHintLine(),
        lastOutputLine,
        '',
        `${formatHotkey(':')}${state.commandBuffer}`,
      ]
    : [formatCommandHintLine(), lastOutputLine];

  return {
    commandLines: fitLines(commandPanelLines, size.width, bottomHeight),
    streamLines: fitLines(
      buildVisibleStreamLines(state, topHeight - 2),
      rightWidth,
      topHeight,
    ),
    streamTitleRight: formatConnectionStatus(state.connectionStatus),
    summaryLines: fitLines(buildSummaryLines(state), leftWidth, topHeight),
  };
}

export function computeConsoleLayout(
  state: SocketConsoleState,
  size: ConsoleSize,
): ConsoleLayout {
  const bottomHeight = getConsoleBottomHeight(state);
  const leftWidth = Math.max(24, Math.floor(size.width * 0.33));
  const rightWidth = Math.max(24, size.width - leftWidth - 1);
  const topHeight = Math.max(8, size.height - bottomHeight - 1);

  return {
    bottomHeight,
    bottomY: topHeight + 1,
    leftWidth,
    rightWidth,
    topHeight,
  };
}

function buildVisibleStreamLines(state: SocketConsoleState, rowCount: number) {
  if (state.streamEntries.length === 0) {
    return [];
  }

  return state.streamEntries
    .slice(0, state.paused ? state.pausedStreamLength : undefined)
    .slice(-rowCount)
    .map((entry) => `  ${entry.line}`);
}

export function getConsoleBottomHeight(state: SocketConsoleState) {
  return state.commandMode ? 6 : 4;
}

function buildSummaryLines(state: SocketConsoleState) {
  const eventCountLines = Object.entries(state.eventCounts)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .slice(0, 12)
    .map(([eventName, count]) => `${formatSummaryLabel(eventName)} ${count}`);

  return [
    `${formatSummaryLabel('Base URL')} ${state.baseUrl}`,
    `${formatSummaryLabel('Connection')} ${state.connectionState?.connected ? 'connected' : 'disconnected'}`,
    `${formatSummaryLabel('Transport')} ${state.connectionState?.transport ?? 'unknown'}`,
    `${formatSummaryLabel('Socket ID')} ${state.connectionState?.socketId ?? 'n/a'}`,
    `${formatSummaryLabel('Paused')} ${state.paused ? 'yes' : 'no'}`,
    `${formatSummaryLabel('Recording')} ${state.recording.active ? 'yes' : 'no'}`,
    `${formatSummaryLabel('Recording dir')} ${state.recording.sessionDir ?? 'n/a'}`,
    `${formatSummaryLabel('Last event')} ${state.lastEventName ?? 'n/a'}`,
    `${formatSummaryLabel('Pressure')} ${formatMetric(state.metrics.pressure)}`,
    `${formatSummaryLabel('Temperature')} ${formatMetric(state.metrics.temperature)}`,
    `${formatSummaryLabel('Weight')} ${formatMetric(state.metrics.weight)}`,
    `${formatSummaryLabel('Profile time')} ${formatMetric(state.metrics.profileTime)}`,
    '',
    formatSummaryLabel('Event counts'),
    ...eventCountLines,
  ];
}

function fitLines(lines: string[], width: number, height: number) {
  return lines
    .slice(0, Math.max(0, height - 2))
    .map((line) => truncateLine(line, Math.max(0, width - 2)));
}

function truncateLine(line: string, width: number) {
  if (visibleLength(line) <= width) {
    return line;
  }

  const targetWidth = Math.max(0, width - 3);
  let visible = 0;
  let output = '';

  for (let index = 0; index < line.length; index += 1) {
    const escapeMatch = ANSI_ESCAPE_START.exec(line.slice(index));
    if (escapeMatch) {
      output += escapeMatch[0];
      index += escapeMatch[0].length - 1;
      continue;
    }

    if (visible >= targetWidth) {
      break;
    }

    output += line[index];
    visible += 1;
  }

  return `${output}...`;
}

function padVisibleText(value: string, width: number, fill = ' ') {
  const padding = Math.max(0, width - visibleLength(value));
  return `${value}${fill.repeat(padding)}`;
}

function pushStreamEntry(
  state: SocketConsoleState,
  entry: SocketConsoleStreamEntry,
) {
  state.streamEntries = [...state.streamEntries, entry].slice(
    -MAX_STREAM_LINES,
  );
}

function formatEventRow(eventName: string, payload: unknown[]) {
  const metrics = parseSocketPayloadMetrics(payload);
  const parts = [
    formatEventNameColumn(eventName),
    formatMetricField('p', metrics.pressure),
    formatMetricField('t', metrics.temperature),
    formatMetricField('w', metrics.weight),
    formatMetricField('pt', metrics.profileTime),
  ];

  return parts.join(' | ');
}

function formatStateRow(connectionState: SocketIoState) {
  const parts = [formatEventNameColumn('state')];
  parts.push(connectionState.connected ? 'connected' : 'disconnected');

  if (connectionState.transport) {
    parts.push(`transport=${connectionState.transport}`);
  }
  if (connectionState.socketId) {
    parts.push(`socket=${connectionState.socketId}`);
  }
  if (connectionState.error) {
    parts.push(`error=${connectionState.error}`);
  }

  return parts.join(' | ');
}

function formatEventNameColumn(eventName: string) {
  return eventName.padEnd(EVENT_NAME_COLUMN_WIDTH, ' ');
}

function formatMetricTriplet(key: string, value: number) {
  return [
    applyTheme('metricKey', key),
    applyTheme('metricEquals', '='),
    applyTheme('metricValue', String(value)),
  ].join('');
}

function formatMetricField(key: string, value: number | undefined) {
  if (value === undefined) {
    return ' '.repeat(METRIC_FIELD_WIDTH);
  }

  return padVisibleText(formatMetricTriplet(key, value), METRIC_FIELD_WIDTH);
}

function formatSummaryLabel(label: string) {
  return `${applyTheme('label', label)}:`;
}

function formatCommandLabel(label: string) {
  return `${applyTheme('label', label)}:`;
}

function formatHotkey(value: string) {
  return applyTheme('hotkey', value);
}

function formatHelpHotkeyLine(hotkey: string, description: string) {
  return `  ${padVisibleText(formatHotkey(hotkey), 10)} ${description}`;
}

function formatCommandListLine(command: string) {
  return `  ${formatHotkey(command)}`;
}

function formatCommandHintLine() {
  return `Press ${formatHotkey(':')} for commands, ${formatHotkey('q')} to quit, ${formatHotkey('h')} for help.`;
}

function formatConnectionStatus(
  status: SocketConsoleState['connectionStatus'],
) {
  if (status === 'connected') {
    return applyTheme('statusConnected', 'Connected');
  }

  if (status === 'connecting') {
    return applyTheme('statusConnecting', 'Connecting...');
  }

  return applyTheme('statusDisconnected', 'Disconnected');
}

function applyTheme(token: keyof typeof CONSOLE_THEME, value: string) {
  return CONSOLE_THEME[token](value);
}

function visibleLength(value: string) {
  return value.replace(ANSI_ESCAPE_GLOBAL, '').length;
}

function formatMetric(value: number | undefined) {
  return value === undefined ? 'n/a' : String(value);
}
