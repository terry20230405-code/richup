"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToPlayer = emitToPlayer;
exports.emitToSocket = emitToSocket;
exports.playerRoom = playerRoom;
/**
 * Emit a private event to a specific player.
 *
 * Each player socket joins a private room keyed `player:<playerId>` on connect.
 * This means io.to(`player:${playerId}`) always reaches exactly that player,
 * even after reconnection.
 */
function emitToPlayer(io, playerId, event, payload) {
    io.to(`player:${playerId}`).emit(event, payload);
}
/** Emit a protocol-checked event only to the current physical socket. */
function emitToSocket(socket, event, payload) {
    socket.emit(event, payload);
}
/** The private room name a player socket should join. */
function playerRoom(playerId) {
    return `player:${playerId}`;
}
//# sourceMappingURL=direct.js.map