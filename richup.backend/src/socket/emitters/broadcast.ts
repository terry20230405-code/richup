import type { Server } from 'socket.io';
import type { RoomId } from '../../types/Common.types';
import type { ServerEventPayloads } from '../../types/Events.types';

/**
 * Emit a typed event to every socket in a room.
 * Always use this instead of io.to(roomId).emit() directly
 * so broadcasts are traceable.
 */
export function broadcastToRoom<TEvent extends keyof ServerEventPayloads>(
  io: Server,
  roomId: RoomId,
  event: TEvent,
  payload: ServerEventPayloads[TEvent],
): void {
  io.to(roomId).emit(event, payload);
}
