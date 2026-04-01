import { io } from 'socket.io-client';

import type { ReconnectActionPayload, SocketSessionAuth } from '@/types/socket';

import { registerSocketListeners } from './listeners';
import { readStoredSocketSession } from './storage';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3000';
const RECONNECT_DELAY_MS = 5000;

export const gameSocket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: false,
  auth: {},
});

let lifecycleBound = false;
let eventListenersBound = false;
let reconnectTimer: number | null = null;

const buildSocketAuth = (
  overrides: Partial<SocketSessionAuth> = {},
): SocketSessionAuth | null => {
  const stored = readStoredSocketSession();
  const roomId = overrides.roomId ?? stored.roomId;

  if (!roomId) {
    return null;
  }

  return {
    roomId,
    sessionToken: overrides.sessionToken ?? stored.sessionToken,
    nickname: overrides.nickname ?? stored.nickname,
  };
};

const syncSocketAuth = (
  overrides: Partial<SocketSessionAuth> = {},
): SocketSessionAuth | null => {
  const auth = buildSocketAuth(overrides);
  gameSocket.auth = auth ?? {};
  return auth;
};

const clearReconnectTimer = (): void => {
  if (reconnectTimer === null) {
    return;
  }

  window.clearTimeout(reconnectTimer);
  reconnectTimer = null;
};

const emitReconnectHandshake = (): void => {
  const auth = buildSocketAuth();

  if (!auth?.sessionToken || !auth.roomId || !gameSocket.connected) {
    return;
  }

  const payload: ReconnectActionPayload = {
    sessionToken: auth.sessionToken,
    roomId: auth.roomId,
  };

  gameSocket.emit('action:RECONNECT', payload);
};

const scheduleReconnect = (): void => {
  const auth = buildSocketAuth();

  if (!auth?.sessionToken || !auth.roomId || reconnectTimer !== null) {
    return;
  }

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    syncSocketAuth();

    if (!gameSocket.connected && !gameSocket.active) {
      gameSocket.connect();
    }
  }, RECONNECT_DELAY_MS);
};

const bindLifecycleHandlers = (): void => {
  if (lifecycleBound) {
    return;
  }

  lifecycleBound = true;

  gameSocket.on('connect', () => {
    clearReconnectTimer();
    emitReconnectHandshake();
  });

  gameSocket.on('disconnect', (_reason) => {
    scheduleReconnect();
  });

  gameSocket.on('connect_error', (_error) => {
    scheduleReconnect();
  });
};

const bindGameEventHandlers = (): void => {
  if (eventListenersBound) {
    return;
  }

  eventListenersBound = true;
  registerSocketListeners(gameSocket);
};

export const bootstrapSocketClient = (): void => {
  bindLifecycleHandlers();
  bindGameEventHandlers();

  if (buildSocketAuth()?.roomId) {
    connectGameSocket();
  }
};

export const connectGameSocket = (
  overrides: Partial<SocketSessionAuth> = {},
): void => {
  bindLifecycleHandlers();
  bindGameEventHandlers();

  const auth = syncSocketAuth(overrides);
  if (!auth?.roomId || gameSocket.connected || gameSocket.active) {
    return;
  }

  gameSocket.connect();
};

export const disconnectGameSocket = (): void => {
  clearReconnectTimer();

  if (gameSocket.connected || gameSocket.active) {
    gameSocket.disconnect();
  }
};

export const getSocketAuthSnapshot = (): SocketSessionAuth | null => buildSocketAuth();
