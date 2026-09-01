"use strict";
/**
 * Dice engine.
 *
 * Tracks consecutive doubles for the current turn (rolled 3 doubles → go to jail).
 * The roll result is stored in session.lastDiceRoll.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetDoublesTracker = resetDoublesTracker;
exports.performRoll = performRoll;
exports.applyRemoteDice = applyRemoteDice;
exports.rollForJailDouble = rollForJailDouble;
const randomUtils_1 = require("../utils/randomUtils");
const broadcast_1 = require("../socket/emitters/broadcast");
const logger_1 = require("../utils/logger");
const TradeLifecycle_1 = require("./TradeLifecycle");
const Trade_types_1 = require("../types/Trade.types");
const MAX_CONSECUTIVE_DOUBLES = 3;
const REMOTE_DICE_PAIRS = {
    5: [2, 3],
    6: [1, 5],
    7: [3, 4],
};
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
    const override = session.remoteDiceOverride?.playerId === playerId
        ? session.remoteDiceOverride
        : null;
    session.remoteDiceOverride = null;
    const result = override
        ? { die1: REMOTE_DICE_PAIRS[override.steps][0], die2: REMOTE_DICE_PAIRS[override.steps][1], isDouble: false, total: override.steps }
        : (0, randomUtils_1.rollDice)();
    session.lastDiceRoll = result;
    const payload = {
        playerId,
        die1: result.die1,
        die2: result.die2,
        isDouble: result.isDouble,
        totalSteps: result.total,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'DICE_ROLLED', payload);
    (0, TradeLifecycle_1.voidTradesInvolvingPlayer)(session, playerId, Trade_types_1.TradeVoidReason.PLAYER_ROLLED, io);
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
    session.remoteDiceOverride = { playerId, steps };
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
    (0, TradeLifecycle_1.voidTradesInvolvingPlayer)(session, playerId, Trade_types_1.TradeVoidReason.PLAYER_ROLLED, io);
    return { ...result, total: result.total, jailTriggered: false };
}
//# sourceMappingURL=DiceEngine.js.map