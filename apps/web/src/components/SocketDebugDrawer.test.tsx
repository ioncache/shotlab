// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SocketDebugDrawer } from './SocketDebugDrawer';

const socketSession = {
  groups: [
    {
      event: 'status',
      latestPacket: {
        id: 'packet-1',
        payload: [{ state: 'Idle' }],
        receivedAt: '2026-07-05 08:00',
        receivedAtMs: 1,
      },
      payloadPreview: '{\n  "state": "Idle"\n}',
      recentPackets: [
        {
          id: 'packet-1',
          payload: [{ state: 'Idle' }],
          receivedAt: '2026-07-05 08:00',
          receivedAtMs: 1,
        },
      ],
      recentRatePerSecond: 0.2,
      totalCount: 1,
    },
  ],
  totalEvents: 1,
};

describe('SocketDebugDrawer', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens the drawer and shows socket event details', () => {
    render(
      <SocketDebugDrawer
        socketDebug={{
          socketId: 'socket-1',
          status: 'connected',
          transport: 'websocket',
        }}
        socketSession={socketSession}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show debug' }));

    expect(screen.getByText('Socket debug')).toBeDefined();
    expect(screen.getByText('Socket ID: socket-1')).toBeDefined();
    expect(screen.getByText('status')).toBeDefined();
    expect(screen.getAllByText(/"state": "Idle"/).length).toBeGreaterThan(0);
  });
});
