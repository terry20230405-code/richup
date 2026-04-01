"use strict";
/**
 * Dual-track bankruptcy resolution.
 *
 * TYPE_A (tax / system debt / whale-fall):
 *   - All cash destroyed (removed from game)
 *   - All properties stripped of buildings, returned to unowned
 *   - Prop cards destroyed
 *
 * TYPE_B (rent owed to another player):
 *   - Pay creditor: min(all liquidatable assets, amountOwed)
 *   - Remaining cash DESTROYED (not given to creditor — inflation prevention)
 *   - All properties stripped and returned to unowned
 *   - Prop cards destroyed
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.enterDyingRescue = enterDyingRescue;
exports.refreshDyingRescueActivity = refreshDyingRescueActivity;
exports.declareBankruptcy = declareBankruptcy;
exports.triggerWhaleFall = triggerWhaleFall;
const GameSession_types_1 = require("../types/GameSession.types");
const Player_types_1 = require("../types/Player.types");
const Tile_types_1 = require("../types/Tile.types");
const GameSession_1 = require("../state/GameSession");
const StateMachine_1 = require("../state/StateMachine");
const broadcast_1 = require("../socket/emitters/broadcast");
const timerUtils_1 = require("../utils/timerUtils");
const logger_1 = require("../utils/logger");
// ─── Enter DYING_RESCUE ───────────────────────────────────────────────────────
/**
 * Transition a player to DYING_RESCUE state.
 * Starts the rescue window timer and AFK warning timer.
 */
function enterDyingRescue(session, playerId, bankruptcyType, creditorId, amountOwed, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    player.status = Player_types_1.PlayerStatus.DYING;
    session.dyingRescue = {
        playerId,
        startedAt: Date.now(),
        lastActionAt: Date.now(),
        afkWarningSentAt: null,
    };
    session.pendingBankruptcy = { playerId, type: bankruptcyType, creditorId, amountOwed };
    StateMachine_1.StateMachine.forcePhase(session, GameSession_types_1.TurnPhase.DYING_RESCUE);
    const payload = {
        playerId,
        rescueWindowMs: session.config.dyingRescueTotalMs,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLAYER_DYING', payload);
    // AFK warning timer (fires 2 minutes before kick)
    (0, timerUtils_1.scheduleTimer)(timerUtils_1.TimerNS.dyingAfk(session.id, playerId), session.config.dyingRescueAfkWarningMs, () => {
        if (session.dyingRescue?.playerId === playerId) {
            session.dyingRescue.afkWarningSentAt = Date.now();
            const remaining = Math.ceil((session.config.dyingRescueTotalMs - session.config.dyingRescueAfkWarningMs) / 1000);
            const warnPayload = { playerId, remainingSeconds: remaining };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'DYING_RESCUE_AFK_WARNING', warnPayload);
        }
    }, `AFK warning for dying player ${playerId}`);
    // Total rescue window timer
    (0, timerUtils_1.scheduleTimer)(timerUtils_1.TimerNS.dyingRescue(session.id, playerId), session.config.dyingRescueTotalMs, () => {
        if (session.dyingRescue?.playerId === playerId) {
            triggerWhaleFall(session, playerId, 'AFK_IN_RESCUE', io);
        }
    }, `Rescue timeout for player ${playerId}`);
    logger_1.logger.info({ roomId: session.id, playerId, bankruptcyType }, 'Player entered dying rescue');
}
// ─── Rescue actions reset the AFK timer ───────────────────────────────────────
/** Call this whenever the dying player takes a valid action in DYING_RESCUE. */
function refreshDyingRescueActivity(session, playerId) {
    if (session.dyingRescue?.playerId === playerId) {
        session.dyingRescue.lastActionAt = Date.now();
    }
}
// ─── Declare bankruptcy (voluntary) ─────────────────────────────────────────
function declareBankruptcy(session, playerId, io) {
    const pending = session.pendingBankruptcy;
    if (!pending || pending.playerId !== playerId)
        return;
    cancelDyingTimers(session, playerId);
    resolveBankruptcy(session, pending.type, pending.creditorId, io);
}
// ─── Whale-fall (involuntary) ─────────────────────────────────────────────────
function triggerWhaleFall(session, playerId, reason, io) {
    cancelDyingTimers(session, playerId);
    const payload = { playerId, reason };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'WHALE_FALL', payload);
    // Whale-fall is always TYPE_A
    resolveBankruptcy(session, GameSession_types_1.BankruptcyType.TYPE_A, null, io);
}
// ─── Resolution ──────────────────────────────────────────────────────────────
function resolveBankruptcy(session, type, creditorId, io) {
    const pending = session.pendingBankruptcy;
    if (!pending)
        return;
    const playerId = pending.playerId;
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    if (type === GameSession_types_1.BankruptcyType.TYPE_B && creditorId) {
        // Transfer min(assets, amountOwed) to creditor
        const totalAssets = liquidatableValue(session, playerId);
        const transferAmount = Math.min(totalAssets, pending.amountOwed);
        if (transferAmount > 0) {
            // Destroy player cash first
            player.cash = 0;
            // Then give creditor the calculated amount
            (0, GameSession_1.cashChange)(session, creditorId, transferAmount, `BANKRUPTCY_TRANSFER_FROM_${playerId}`, io);
        }
    }
    // Strip all properties
    for (const tile of session.board) {
        if ('ownerId' in tile && tile.ownerId === playerId) {
            if (tile.type === Tile_types_1.TileType.PROPERTY) {
                tile.buildingLevel = 0;
            }
            tile.ownerId = null;
            if ('isMortgaged' in tile) {
                tile.isMortgaged = false;
            }
            const freePayload = {
                tileId: tile.id,
                previousOwnerId: playerId,
                newOwnerId: null,
            };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'PROPERTY_FREED', freePayload);
        }
    }
    // Destroy remaining cash
    player.cash = 0;
    // Destroy prop cards
    player.propCards = [];
    // Mark bankrupt
    player.status = Player_types_1.PlayerStatus.BANKRUPT;
    session.dyingRescue = null;
    session.pendingBankruptcy = null;
    const bankruptPayload = {
        playerId,
        bankruptType: type,
        creditorId: creditorId ?? null,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLAYER_BANKRUPT', bankruptPayload);
    // Remove from player order
    session.playerOrder = session.playerOrder.filter(id => id !== playerId);
    logger_1.logger.info({ roomId: session.id, playerId, type }, 'Bankruptcy resolved');
    // Check if game is over
    const winnerId = (0, GameSession_1.checkVictory)(session);
    if (winnerId) {
        endGame(session, [winnerId], io);
        return;
    }
    // Advance to next turn
    StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.TURN_TRANSITIONING);
}
// ─── Game over ────────────────────────────────────────────────────────────────
function endGame(session, winnerIds, io) {
    const { GameStatus } = require('../types/GameSession.types');
    session.status = GameStatus.FINISHED;
    session.finishedAt = Date.now();
    session.winnerIds = winnerIds;
    (0, timerUtils_1.cancelAllTimers)(session.id);
    const standings = session.playerOrder.map((pid, i) => ({ playerId: pid, rank: i + 1 }));
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'GAME_OVER', { winnerIds, standings });
    logger_1.logger.info({ roomId: session.id, winnerIds }, 'Game over');
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function cancelDyingTimers(session, playerId) {
    (0, timerUtils_1.cancelAllTimers)(`${session.id}:${playerId}`);
}
/** Sum all convertible assets: cash + mortgage values of unbuilt properties. */
function liquidatableValue(session, playerId) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    let total = player.cash;
    for (const tile of session.board) {
        if ('ownerId' in tile && tile.ownerId === playerId && 'mortgageValue' in tile) {
            if (!tile.isMortgaged) {
                total += tile.mortgageValue;
            }
        }
    }
    return total;
}
//# sourceMappingURL=BankruptcyResolver.js.map