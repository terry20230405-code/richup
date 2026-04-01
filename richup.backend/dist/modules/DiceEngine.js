"use strict";
/**
 * Dice engine.
 *
 * Tracks consecutive doubles for the current turn (rolled 3 doubles → go to jail).
 * The roll result is stored in session.lastDiceRoll.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JAIL_POSITION = void 0;
exports.resetDoublesTracker = resetDoublesTracker;
exports.performRoll = performRoll;
exports.applyRemoteDice = applyRemoteDice;
exports.rollForJailDouble = rollForJailDouble;
exports.getConsecutiveDoubles = getConsecutiveDoubles;
const GameConfig_1 = require("../config/GameConfig");
const randomUtils_1 = require("../utils/randomUtils");
const broadcast_1 = require("../socket/emitters/broadcast");
const logger_1 = require("../utils/logger");
const MAX_CONSECUTIVE_DOUBLES = 3;
/** Track consecutive doubles per player per turn. Cleared on END_TURN. */
const doublesTracker = new Map(); // key: `${roomId}:${playerId}`
function doublesKey(roomId, playerId) {
    return `${roomId}:${playerId}`;
}
function resetDoublesTracker(roomId, playerId) {
    doublesTracker.delete(doublesKey(roomId, playerId));
}
/** Roll dice for the current player. Emits DICE_ROLLED. Returns the result. */
function performRoll(session, playerId, io) {
    const result = (0, randomUtils_1.rollDice)();
    session.lastDiceRoll = result;
    const payload = {
        playerId,
        die1: result.die1,
        die2: result.die2,
        isDouble: result.isDouble,
        totalSteps: result.total,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'DICE_ROLLED', payload);
    logger_1.logger.debug({ roomId: session.id, playerId, ...result }, 'Dice rolled');
    // Track doubles
    const key = doublesKey(session.id, playerId);
    const consecutiveDoubles = (doublesTracker.get(key) ?? 0) + (result.isDouble ? 1 : 0);
    if (result.isDouble) {
        doublesTracker.set(key, consecutiveDoubles);
    }
    else {
        doublesTracker.delete(key);
    }
    const jailTriggered = consecutiveDoubles >= MAX_CONSECUTIVE_DOUBLES;
    if (jailTriggered) {
        doublesTracker.delete(key);
    }
    return { ...result, total: result.total, jailTriggered };
}
/**
 * Apply a Remote Dice card override.
 * Emits DICE_OVERRIDE broadcast.
 */
function applyRemoteDice(session, playerId, steps, io) {
    session.lastDiceRoll = { die1: steps, die2: 0, isDouble: false, total: steps };
    const payload = { playerId, steps, source: 'REMOTE_DICE' };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'DICE_OVERRIDE', payload);
}
/** Roll a single die for jail double attempt. Returns the roll result. */
function rollForJailDouble(session, playerId, io) {
    const result = (0, randomUtils_1.rollDice)();
    session.lastDiceRoll = result;
    const payload = {
        playerId,
        die1: result.die1,
        die2: result.die2,
        isDouble: result.isDouble,
        totalSteps: result.total,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'DICE_ROLLED', payload);
    return { ...result, total: result.total, jailTriggered: false };
}
/** How many consecutive doubles the current player has rolled this turn. */
function getConsecutiveDoubles(roomId, playerId) {
    return doublesTracker.get(doublesKey(roomId, playerId)) ?? 0;
}
/** Position of the jail tile. */
exports.JAIL_POSITION = GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.JAIL;
//# sourceMappingURL=DiceEngine.js.map