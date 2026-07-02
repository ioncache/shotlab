import { describe, expect, it } from 'vitest';

import {
  addOutputLine,
  appendStreamEvent,
  appendStreamState,
  buildConsoleHelpLines,
  buildConsolePanels,
  clearStreamLines,
  computeConsoleLayout,
  createSocketConsoleState,
  parseConsoleCommand,
  setConnectionStatus,
  setHelpOverlay,
  setPaused,
  setRecordingState,
} from './socket-console.ts';

const ANSI_ESCAPE_GLOBAL = new RegExp(String.raw`\u001B\[[0-9;]*m`, 'g');

function stripAnsi(value: string) {
  return value.replace(ANSI_ESCAPE_GLOBAL, '');
}

describe('parseConsoleCommand', () => {
  it('parses the supported console commands', () => {
    expect(parseConsoleCommand('help')).toStrictEqual({ kind: 'help' });
    expect(parseConsoleCommand('clear')).toStrictEqual({ kind: 'clear' });
    expect(parseConsoleCommand('pause')).toStrictEqual({ kind: 'pause' });
    expect(parseConsoleCommand('resume')).toStrictEqual({ kind: 'resume' });
    expect(parseConsoleCommand('reconnect')).toStrictEqual({
      kind: 'reconnect',
    });
    expect(parseConsoleCommand('disconnect')).toStrictEqual({
      kind: 'disconnect',
    });
    expect(parseConsoleCommand('quit')).toStrictEqual({ kind: 'quit' });
    expect(parseConsoleCommand('record start morning brew')).toStrictEqual({
      kind: 'record-start',
      label: 'morning brew',
    });
    expect(parseConsoleCommand('record stop')).toStrictEqual({
      kind: 'record-stop',
    });
  });

  it('parses the stub action commands', () => {
    expect(parseConsoleCommand('tare')).toStrictEqual({
      kind: 'stub-action',
      name: 'tare',
    });
    expect(parseConsoleCommand('preheat')).toStrictEqual({
      kind: 'stub-action',
      name: 'preheat',
    });
    expect(parseConsoleCommand('raise')).toStrictEqual({
      kind: 'stub-action',
      name: 'raise',
    });
    expect(parseConsoleCommand('purge')).toStrictEqual({
      kind: 'stub-action',
      name: 'purge',
    });
    expect(parseConsoleCommand('stop')).toStrictEqual({
      kind: 'stub-action',
      name: 'stop',
    });
  });

  it('marks unknown commands explicitly', () => {
    expect(parseConsoleCommand('brew start')).toStrictEqual({
      input: 'brew start',
      kind: 'unknown',
    });
  });
});

describe('buildConsoleHelpLines', () => {
  it('calls out stub action commands as not yet implemented', () => {
    expect(
      buildConsoleHelpLines().some((line) =>
        stripAnsi(line).includes('Stub machine commands'),
      ),
    ).toBe(true);
  });

  it('styles command labels in cyan and hotkeys in green', () => {
    const lines = buildConsoleHelpLines();

    const hotkeysLine = lines.find((line) => stripAnsi(line) === 'Hotkeys:');
    const qLine = lines.find((line) => stripAnsi(line).trim().startsWith('q'));
    const commandsLine = lines.find((line) => stripAnsi(line) === 'Commands:');

    expect(hotkeysLine).toContain('\u001B[96m');
    expect(commandsLine).toContain('\u001B[96m');
    expect(qLine).toContain('\u001B[92m');
  });
});

describe('socket console state helpers', () => {
  it('updates summary state from stream events and state changes', () => {
    const state = createSocketConsoleState('http://machine.local:8080');

    appendStreamState(state, {
      connected: true,
      socketId: 'socket-1',
      transport: 'websocket',
    });
    appendStreamEvent(state, 'status', [
      {
        profile_time: 12.5,
        sensors: { p: 8.2, t: 92.4, w: 18.8 },
      },
    ]);
    setRecordingState(state, {
      active: true,
      sessionDir: '/tmp/shot/session-1',
    });
    addOutputLine(state, 'recording started');

    const panels = buildConsolePanels(state, {
      height: 30,
      width: 90,
    });
    const visibleSummaryLines = panels.summaryLines.map(stripAnsi);

    expect(visibleSummaryLines).toEqual(
      expect.arrayContaining([
        'Connection: connected',
        'Transport: websocket',
        'Recording: yes',
        'Last event: status',
        'Pressure: 8.2',
      ]),
    );
    expect(panels.streamLines.at(-1)).toContain('status');
    expect(stripAnsi(panels.streamTitleRight ?? '')).toBe('Connected');
    expect(
      panels.commandLines.some((line) => stripAnsi(line).includes('Selected:')),
    ).toBe(false);
  });

  it('freezes the visible stream while paused and clears it on command', () => {
    const state = createSocketConsoleState('http://machine.local:8080');

    appendStreamEvent(state, 'status', [{ sensors: { p: 8.2 } }]);
    setPaused(state, true);
    appendStreamEvent(state, 'sensors', [{ p: 7.1 }]);

    const pausedPanels = buildConsolePanels(state, {
      height: 30,
      width: 90,
    });

    expect(
      pausedPanels.streamLines.some((line) => line.startsWith('  status')),
    ).toBe(true);
    expect(
      pausedPanels.streamLines.some((line) => line.startsWith('  sensors')),
    ).toBe(false);

    setPaused(state, false);
    const resumedPanels = buildConsolePanels(state, {
      height: 30,
      width: 90,
    });

    expect(
      resumedPanels.streamLines.some((line) => line.startsWith('  sensors')),
    ).toBe(true);

    clearStreamLines(state);

    const clearedPanels = buildConsolePanels(state, {
      height: 30,
      width: 90,
    });

    expect(clearedPanels.streamLines).toEqual([]);
  });

  it('uses a fullscreen help overlay when help is active', () => {
    const state = createSocketConsoleState('http://machine.local:8080');

    setHelpOverlay(state, true);

    const panels = buildConsolePanels(state, {
      height: 20,
      width: 80,
    });

    expect(panels.helpLines).toBeDefined();
    expect(panels.helpLines?.[0]).toBe('Console Help');
    expect(panels.helpLines?.some((line) => line.includes('toggle help'))).toBe(
      true,
    );
  });

  it('shows a plain trailing stream without selection markers', () => {
    const state = createSocketConsoleState('http://machine.local:8080');

    appendStreamEvent(state, 'status', [{ time: 1 }]);
    appendStreamEvent(state, 'sensors', [{ time: 2 }]);
    appendStreamEvent(state, 'button', [{ time: 3 }]);

    const panels = buildConsolePanels(state, {
      height: 12,
      width: 70,
    });

    expect(panels.streamLines.some((line) => line.startsWith('  button'))).toBe(
      true,
    );
    expect(panels.streamLines.some((line) => line.startsWith('> '))).toBe(
      false,
    );
  });

  it('keeps metric columns aligned across stream rows', () => {
    const state = createSocketConsoleState('http://machine.local:8080');

    appendStreamEvent(state, 'status', [
      {
        profile_time: 12.5,
        sensors: { p: 8.2, t: 92.4, w: 18.8 },
      },
    ]);
    appendStreamEvent(state, 'sensors', [
      {
        p: 7.1,
        t_tube: 91.1,
        weight_pred: 16.3,
      },
    ]);

    const panels = buildConsolePanels(state, {
      height: 20,
      width: 90,
    });

    const visibleRows = panels.streamLines.map(stripAnsi);
    const statusRow = visibleRows.find((line) => line.includes('status')) ?? '';
    const sensorsRow =
      visibleRows.find((line) => line.includes('sensors')) ?? '';

    expect(statusRow.indexOf('p=')).toBe(sensorsRow.indexOf('p='));
    expect(statusRow.indexOf('t=')).toBe(sensorsRow.indexOf('t='));
    expect(statusRow.indexOf('w=')).toBe(sensorsRow.indexOf('w='));
    expect(statusRow.indexOf('pt=')).toBe(sensorsRow.indexOf('pt='));
  });

  it('renders summary labels with the same cyan label styling as stream keys', () => {
    const state = createSocketConsoleState('http://machine.local:8080');

    appendStreamEvent(state, 'status', [
      {
        sensors: { p: 8.2 },
      },
    ]);

    const panels = buildConsolePanels(state, {
      height: 20,
      width: 90,
    });

    const connectionLine = panels.summaryLines.find((line) =>
      stripAnsi(line).startsWith('Connection:'),
    );
    expect(connectionLine).toContain('\u001B[96m');
  });

  it('styles command panel hotkeys', () => {
    const state = createSocketConsoleState('http://machine.local:8080');

    const initialPanels = buildConsolePanels(state, {
      height: 20,
      width: 90,
    });

    expect(initialPanels.commandLines[0]).toContain('\u001B[92m');
  });

  it('keeps the command hint pinned and only shows the last command result', () => {
    const state = createSocketConsoleState('http://machine.local:8080');

    addOutputLine(state, 'first');
    addOutputLine(state, 'second');

    const panels = buildConsolePanels(state, {
      height: 20,
      width: 90,
    });

    expect(stripAnsi(panels.commandLines[0])).toContain('Press : for commands');
    expect(
      panels.commandLines.some((line) => stripAnsi(line) === 'second'),
    ).toBe(true);
    expect(
      panels.commandLines.some((line) => stripAnsi(line) === 'first'),
    ).toBe(false);
  });

  it('formats stream header connection states separately from command output', () => {
    const state = createSocketConsoleState('http://machine.local:8080');

    setConnectionStatus(state, 'connecting');
    let panels = buildConsolePanels(state, {
      height: 20,
      width: 90,
    });
    expect(stripAnsi(panels.streamTitleRight ?? '')).toBe('Connecting...');

    setConnectionStatus(state, 'connected');
    panels = buildConsolePanels(state, {
      height: 20,
      width: 90,
    });
    expect(stripAnsi(panels.streamTitleRight ?? '')).toBe('Connected');

    setConnectionStatus(state, 'disconnected');
    panels = buildConsolePanels(state, {
      height: 20,
      width: 90,
    });
    expect(stripAnsi(panels.streamTitleRight ?? '')).toBe('Disconnected');
  });

  it('uses one shared console layout calculation', () => {
    const state = createSocketConsoleState('http://machine.local:8080');

    expect(computeConsoleLayout(state, { height: 30, width: 100 })).toEqual({
      bottomHeight: 4,
      bottomY: 26,
      leftWidth: 33,
      rightWidth: 66,
      topHeight: 25,
    });
  });
});
