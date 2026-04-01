"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastToRoom = broadcastToRoom;
/**
 * Emit a typed event to every socket in a room.
 * Always use this instead of io.to(roomId).emit() directly
 * so broadcasts are traceable.
 */
function broadcastToRoom(io, roomId, event, payload) {
    io.to(roomId).emit(event, payload);
}
//# sourceMappingURL=broadcast.js.map