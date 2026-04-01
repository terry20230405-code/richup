"use strict";
/**
 * Jail management.
 *
 * Handles:
 *  - Sending a player to jail (doubles overflow, Go-To-Jail tile)
 *  - Jail decision resolution: pay bail, roll for double
 *  - Auto-release after jailAutoReleaseAfterTurns full waited turns
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendToJail = sendToJail;
exports.payBail = payBail;
exports.resolveJailRoll = resolveJailRoll;
const GameConfig_1 = require("../config/GameConfig");
const GameSession_1 = require("../state/GameSession");
const MovementEngine_1 = require("./MovementEngine");
const StateMachine_1 = require("../state/StateMachine");
const GameSession_types_1 = require("../types/GameSession.types");
const broadcast_1 = require("../socket/emitters/broadcast");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const JAIL_POSITION = GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.JAIL;
// ─── Send to jail ─────────────────────────────────────────────────────────────
/**
 * Send a player to jail (teleport + set flags).
 * Does NOT emit PLAYER_MOVED — callers should use teleportPlayer for the move event.
 */
function sendToJail(session, playerId, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    (0, MovementEngine_1.teleportPlayer)(session, playerId, JAIL_POSITION, io);
    player.inJail = true;
    player.jailTurnsWaited = 0;
    logger_1.logger.info({ roomId: session.id, playerId }, 'Player sent to jail');
}
// ─── Pay bail ─────────────────────────────────────────────────────────────────
/**
 * Player pays bail to leave jail immediately.
 * Deducts bail cost and clears jail flags.
 * Transitions to ROLLING_DICE so the player can still move this turn.
 */
function payBail(session, playerId, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    if (!player.inJail)
        throw new errors_1.RuleViolationError('Player is not in jail');
    const bailCost = session.config.bailCost;
    if (player.cash < bailCost) {
        throw new errors_1.InsufficientFundsError(playerId, bailCost, player.cash);
    }
    (0, GameSession_1.cashChange)(session, playerId, -bailCost, 'BAIL_PAID', io);
    releaseFromJail(player);
    StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.ROLLING_DICE);
    logger_1.logger.info({ roomId: session.id, playerId }, 'Player paid bail');
}
// ─── Roll for double in jail ──────────────────────────────────────────────────
/**
 * Player rolled for a double to escape jail.
 * - Success: release, player moves the rolled steps.
 * - Failure: increment jailTurnsWaited; auto-release if threshold reached.
 *
 * @returns Whether the player was released.
 */
function resolveJailRoll(session, playerId, isDouble, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    if (!player.inJail)
        throw new errors_1.RuleViolationError('Player is not in jail');
    if (isDouble) {
        releaseFromJail(player);
        logger_1.logger.info({ roomId: session.id, playerId }, 'Jail escape: rolled double');
        return true;
    }
    // Failed: increment wait counter
    player.jailTurnsWaited++;
    // Auto-release check
    if (player.jailTurnsWaited >= session.config.jailAutoReleaseAfterTurns) {
        releaseFromJail(player);
        const payload = { playerId };
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'JAIL_AUTO_RELEASED', payload);
        logger_1.logger.info({ roomId: session.id, playerId }, 'Jail auto-released');
        return true;
    }
    logger_1.logger.debug({ roomId: session.id, playerId, jailTurnsWaited: player.jailTurnsWaited }, 'Jail roll failed');
    return false;
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function releaseFromJail(player) {
    player.inJail = false;
    player.jailTurnsWaited = 0;
}
//# sourceMappingURL=JailManager.js.map