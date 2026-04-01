"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playerTurnGuard = playerTurnGuard;
const GameSession_1 = require("../../state/GameSession");
/**
 * Verify the socket sender is the current turn player.
 * If not, emits ACTION_REJECTED and returns false.
 */
function playerTurnGuard(socket, session, senderId, action) {
    const currentId = (0, GameSession_1.getCurrentPlayerId)(session);
    if (currentId !== senderId) {
        const payload = {
            action,
            reason: `It is not your turn`,
            code: 'NOT_YOUR_TURN',
        };
        socket.emit('ACTION_REJECTED', payload);
        return false;
    }
    return true;
}
//# sourceMappingURL=playerTurnGuard.js.map