import type { Server } from 'socket.io';
import type { RoomId } from '../../types/Common.types';
/**
 * Emit a typed event to every socket in a room.
 * Always use this instead of io.to(roomId).emit() directly
 * so broadcasts are traceable.
 */
export declare function broadcastToRoom<T>(io: Server, roomId: RoomId, event: string, payload: T): void;
//# sourceMappingURL=broadcast.d.ts.map