import type { Server } from 'socket.io';
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { GameStatus } from '../types/GameSession.types';
import { PlayerStatus } from '../types/Player.types';
import type {
  S2C_GamePaused,
  S2C_LobbyStateUpdated,
  S2C_PlayerDisconnected,
} from '../types/Events.types';
import { getCurrentPlayerId } from '../state/GameSession';
import {
  getSession,
  hasConnectedSocket,
  removeLobbyPlayer,
} from '../state/RoomManager';
import { serializePublicPlayers } from '../serialization/GameStateSerializer';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { scheduleTimer, TimerNS } from '../utils/timerUtils';
import { logger } from '../utils/logger';
import { triggerWhaleFall } from './BankruptcyResolver';
import { voidTradesInvolvingPlayer } from './TradeLifecycle';
import { TradeVoidReason } from '../types/Trade.types';

export function broadcastLobbyState(session: GameSession, io: Server): void {
  if (session.status !== GameStatus.LOBBY) return;

  const payload: S2C_LobbyStateUpdated = {
    hostId: session.hostId,
    players: serializePublicPlayers(session),
  };
  broadcastToRoom(io, session.id, 'LOBBY_STATE_UPDATED', payload);
}

export function scheduleLobbyReservation(
  session: GameSession,
  playerId: PlayerId,
  io: Server,
): void {
  scheduleTimer(
    TimerNS.lobbyReconnect(session.id, playerId),
    session.config.lobbyReconnectWindowMs,
    () => {
      const liveSession = getSession(session.id);
      if (
        !liveSession ||
        liveSession.status !== GameStatus.LOBBY ||
        hasConnectedSocket(session.id, playerId)
      ) {
        return;
      }

      const player = liveSession.players.get(playerId);
      if (!player || player.isConnected) return;

      const result = removeLobbyPlayer(session.id, playerId);
      if (result.removed && !result.roomDeleted) {
        broadcastLobbyState(liveSession, io);
      }
    },
    `Lobby reservation for player ${playerId}`,
  );
}

export function handleLastSocketDisconnect(
  session: GameSession,
  playerId: PlayerId,
  io: Server,
): void {
  const player = session.players.get(playerId);
  if (!player) return;

  const disconnectedAt = Date.now();
  player.isConnected = false;
  player.lastSeenAt = disconnectedAt;
  if (player.status === PlayerStatus.ACTIVE) {
    player.status = PlayerStatus.DISCONNECTED;
  }

  if (session.status === GameStatus.LOBBY) {
    const disconnectedPayload: S2C_PlayerDisconnected = {
      playerId,
      afkWarningMs: session.config.lobbyReconnectWindowMs,
      status: player.status,
    };
    broadcastToRoom(io, session.id, 'PLAYER_DISCONNECTED', disconnectedPayload);
    broadcastLobbyState(session, io);
    scheduleLobbyReservation(session, playerId, io);
    logger.info({ roomId: session.id, playerId }, 'Lobby player disconnected');
    return;
  }

  if (session.status !== GameStatus.IN_PROGRESS && session.status !== GameStatus.PAUSED) return;

  const disconnectedPayload: S2C_PlayerDisconnected = {
    playerId,
    afkWarningMs: session.config.reconnectWindowMs,
    status: player.status,
  };
  broadcastToRoom(io, session.id, 'PLAYER_DISCONNECTED', disconnectedPayload);

  // Bankrupt spectators may disconnect without entering whale-fall again.
  if (player.status === PlayerStatus.BANKRUPT) return;

  voidTradesInvolvingPlayer(session, playerId, TradeVoidReason.PLAYER_DISCONNECTED, io);

  const isCurrentPlayer = getCurrentPlayerId(session) === playerId;
  if (isCurrentPlayer && session.status === GameStatus.IN_PROGRESS) {
    session.status = GameStatus.PAUSED;
    session.pausedAt = disconnectedAt;
    session.disconnectedCurrentPlayerId = playerId;

    const pausePayload: S2C_GamePaused = {
      disconnectedPlayerId: playerId,
      reconnectWindowSeconds: Math.ceil(session.config.reconnectWindowMs / 1000),
      reconnectDeadlineAt: disconnectedAt + session.config.reconnectWindowMs,
    };
    broadcastToRoom(io, session.id, 'GAME_PAUSED', pausePayload);
  }

  scheduleTimer(
    TimerNS.reconnect(session.id, playerId),
    Math.max(0, disconnectedAt + session.config.reconnectWindowMs - Date.now()),
    () => {
      const livePlayer = session.players.get(playerId);
      if (
        livePlayer &&
        !livePlayer.isConnected &&
        livePlayer.status !== PlayerStatus.BANKRUPT &&
        session.status !== GameStatus.FINISHED &&
        session.status !== GameStatus.LOBBY
      ) {
        triggerWhaleFall(session, playerId, 'DISCONNECT_TIMEOUT', io);
      }
    },
    `Reconnect timer for player ${playerId}`,
  );

  logger.info({ roomId: session.id, playerId, isCurrentPlayer }, 'Player disconnected');
}
