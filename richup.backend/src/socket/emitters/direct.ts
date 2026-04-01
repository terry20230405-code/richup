import type { Server } from 'socket.io';
import type { PlayerId } from '../../types/Common.types';

/**
 * Emit a private event to a specific player.
 *
 * Each player socket joins a private room keyed `player:<playerId>` on connect.
 * This means io.to(`player:${playerId}`) always reaches exactly that player,
 * even after reconnection.
 */
export function emitToPlayer<T>(io: Server, playerId: PlayerId, event: string, payload: T): void {
  io.to(`player:${playerId}`).emit(event, payload);
}

/** The private room name a player socket should join. */
export function playerRoom(playerId: PlayerId): string {
  return `player:${playerId}`;
}
