import type {
  MeticulousSocketEvent,
  MeticulousSocketState,
} from '@shotlab/meticulous-client';

const DEBUG_SOCKET_RATE_WINDOW_MS = 5000;
const MAX_DEBUG_EVENTS_PER_GROUP = 40;

export interface DebugSocketPacket {
  id: string;
  payload: unknown[];
  rawMachineTime?: string;
  receivedAt: string;
  receivedAtMs: number;
}

export interface DebugSocketEventGroupSnapshot {
  event: string;
  latestPacket?: DebugSocketPacket;
  payloadPreview: string;
  recentPackets: DebugSocketPacket[];
  recentRatePerSecond: number;
  totalCount: number;
}

export interface DebugSocketMutableGroup {
  event: string;
  latestPacket?: DebugSocketPacket;
  recentPackets: DebugSocketPacket[];
  recentReceivedAtMs: number[];
  totalCount: number;
}

export interface DebugSocketSessionSnapshot {
  groups: DebugSocketEventGroupSnapshot[];
  totalEvents: number;
}

export interface DebugSocketSessionStore {
  groups: Map<string, DebugSocketMutableGroup>;
  totalEvents: number;
}

export interface DebugSocketSnapshot {
  error?: string;
  socketId?: string;
  status: 'connected' | 'connecting' | 'disabled' | 'disconnected' | 'error';
  transport?: string;
}

export const emptyDebugSocketSession: DebugSocketSessionSnapshot = {
  groups: [],
  totalEvents: 0,
};

export function createDebugSocketSessionStore(): DebugSocketSessionStore {
  return {
    groups: new Map<string, DebugSocketMutableGroup>(),
    totalEvents: 0,
  };
}

export function appendDebugSocketPacket(
  session: DebugSocketSessionStore,
  eventName: string,
  packet: DebugSocketPacket,
): void {
  const existingGroup = session.groups.get(eventName);
  const nextGroup: DebugSocketMutableGroup = existingGroup ?? {
    event: eventName,
    recentPackets: [],
    recentReceivedAtMs: [],
    totalCount: 0,
  };

  nextGroup.latestPacket = packet;
  nextGroup.totalCount += 1;
  nextGroup.recentPackets = [packet, ...nextGroup.recentPackets].slice(
    0,
    MAX_DEBUG_EVENTS_PER_GROUP,
  );
  nextGroup.recentReceivedAtMs = [
    packet.receivedAtMs,
    ...nextGroup.recentReceivedAtMs.filter(
      (timestamp) =>
        timestamp >= packet.receivedAtMs - DEBUG_SOCKET_RATE_WINDOW_MS,
    ),
  ];

  session.groups.set(eventName, nextGroup);
  session.totalEvents += 1;
}

export function buildDebugSocketSessionSnapshot(
  session: DebugSocketSessionStore,
): DebugSocketSessionSnapshot {
  return {
    groups: Array.from(session.groups.values())
      .toSorted((left, right) => left.event.localeCompare(right.event))
      .map((group) => ({
        event: group.event,
        latestPacket: group.latestPacket,
        payloadPreview: formatDebugPayloadPreview(group.latestPacket?.payload),
        recentPackets: group.recentPackets,
        recentRatePerSecond:
          group.recentReceivedAtMs.length /
          (DEBUG_SOCKET_RATE_WINDOW_MS / 1000),
        totalCount: group.totalCount,
      })),
    totalEvents: session.totalEvents,
  };
}

export function createDebugSocketPacket(
  event: MeticulousSocketEvent,
  index: number,
): DebugSocketPacket {
  const receivedAt = new Date();

  return {
    id: `${receivedAt.getTime()}-${index}`,
    payload: event.payload,
    rawMachineTime: readRawMachineTime(event.payload),
    receivedAt: receivedAt.toLocaleString(),
    receivedAtMs: receivedAt.getTime(),
  };
}

export function readDebugSocketSnapshot(
  state: MeticulousSocketState,
): DebugSocketSnapshot {
  if (state.connected) {
    return {
      socketId: state.socketId,
      status: 'connected',
      transport: state.transport,
    };
  }

  if (state.error) {
    return {
      error: state.error,
      socketId: state.socketId,
      status: 'error',
      transport: state.transport,
    };
  }

  return {
    socketId: state.socketId,
    status: 'disconnected',
    transport: state.transport,
  };
}

export function formatDebugPayloadJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? 'Unreadable payload';
  } catch {
    return 'Unreadable payload';
  }
}

export function formatDebugSocketRate(value: number): string {
  if (value >= 10) {
    return `${value.toFixed(0)} events/s over last 5s`;
  }

  if (value >= 1) {
    return `${value.toFixed(1)} events/s over last 5s`;
  }

  return `${value.toFixed(2)} events/s over last 5s`;
}

function formatDebugPayloadPreview(payload: unknown[] | undefined): string {
  if (!payload || payload.length === 0) {
    return 'No payload';
  }

  const preview = formatDebugPayloadJson(payload[0]);
  if (!preview) {
    return 'Unreadable payload';
  }

  return preview.length > 120 ? `${preview.slice(0, 117)}...` : preview;
}

function readRawMachineTime(payload: unknown[]): string | undefined {
  for (const entry of payload) {
    const rawTime = readRawMachineTimeFromValue(entry);
    if (rawTime) {
      return rawTime;
    }
  }

  return undefined;
}

function readRawMachineTimeFromValue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidateObject = value as Record<string, unknown>;
  for (const key of ['timestamp', 'created_at', 'brewed_at', 'time']) {
    const candidate = candidateObject[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return String(candidate);
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}
