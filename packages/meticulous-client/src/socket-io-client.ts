import { io, type Socket } from 'socket.io-client';

export interface SocketIoEventListener {
  (event: string, ...payload: unknown[]): void;
}

export interface SocketIoState {
  connected: boolean;
  error?: string;
  socketId?: string;
  transport?: string;
}

export interface SocketIoConnection {
  close(): void;
  getState(): SocketIoState;
  onAny(listener: SocketIoEventListener): void;
}

export interface ConnectSocketIoOptions {
  baseUrl: string;
  onStateChange?: (state: SocketIoState) => void;
}

export async function connectSocketIo(
  options: ConnectSocketIoOptions,
): Promise<SocketIoConnection> {
  const socket = io(options.baseUrl, {
    path: '/socket.io/',
    reconnection: false,
    transports: ['polling', 'websocket'],
  });
  const state: SocketIoState = {
    connected: false,
    transport: socket.io.engine.transport.name,
  };
  const emitState = () => {
    options.onStateChange?.({ ...state });
  };

  socket.on('connect', () => {
    state.connected = true;
    state.error = undefined;
    state.socketId = socket.id;
    state.transport = socket.io.engine.transport.name;
    emitState();
  });
  socket.on('disconnect', () => {
    state.connected = false;
    state.error = undefined;
    state.transport = socket.io.engine.transport.name;
    emitState();
  });
  socket.on('connect_error', (error: Error) => {
    state.connected = false;
    state.error = error.message;
    state.transport = socket.io.engine.transport.name;
    emitState();
  });
  socket.io.engine.on('upgrade', (transport: { name: string }) => {
    state.error = undefined;
    state.transport = transport.name;
    emitState();
  });

  await waitForConnect(socket);

  return {
    close: () => {
      socket.close();
    },
    getState: () => ({ ...state }),
    onAny: (listener) => {
      socket.onAny(listener);
    },
  };
}

function waitForConnect(socket: Socket): Promise<void> {
  if (socket.connected) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      socket.close();
      reject(error);
    };
    const cleanup = () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onError);
  });
}
