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
exports.DYING_RESCUE_AVAILABLE_ACTIONS = void 0;
exports.enterDyingRescue = enterDyingRescue;
exports.refreshDyingRescueActivity = refreshDyingRescueActivity;
exports.buildDyingRescueDetail = buildDyingRescueDetail;
exports.rescueDyingPlayer = rescueDyingPlayer;
exports.declareBankruptcy = declareBankruptcy;
exports.triggerWhaleFall = triggerWhaleFall;
const GameSession_types_1 = require("../types/GameSession.types");
const Player_types_1 = require("../types/Player.types");
const Tile_types_1 = require("../types/Tile.types");
const GameSession_1 = require("../state/GameSession");
const StateMachine_1 = require("../state/StateMachine");
const broadcast_1 = require("../socket/emitters/broadcast");
const direct_1 = require("../socket/emitters/direct");
const timerUtils_1 = require("../utils/timerUtils");
const logger_1 = require("../utils/logger");
const TurnFlow_1 = require("./TurnFlow");
const TradeLifecycle_1 = require("./TradeLifecycle");
const Trade_types_1 = require("../types/Trade.types");
exports.DYING_RESCUE_AVAILABLE_ACTIONS = [
    'SELL_BUILDING',
    'MORTGAGE',
    'PROPOSE_TRADE',
    'ACCEPT_TRADE',
    'REJECT_TRADE',
    'CANCEL_TRADE',
    'DECLARE_BANKRUPTCY',
];
// ─── Enter DYING_RESCUE ───────────────────────────────────────────────────────
/**
 * Transition a player to DYING_RESCUE state.
 * Starts the rescue window timer and AFK warning timer.
 */
function enterDyingRescue(session, playerId, bankruptcyType, creditorId, amountOwed, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    player.status = Player_types_1.PlayerStatus.DYING;
    const startedAt = Date.now();
    const rescueDeadlineAt = startedAt + session.config.dyingRescueTotalMs;
    session.dyingRescue = {
        playerId,
        startedAt,
        lastActionAt: startedAt,
        afkWarningSentAt: null,
    };
    session.pendingBankruptcy = { playerId, type: bankruptcyType, creditorId, amountOwed };
    StateMachine_1.StateMachine.forcePhase(session, GameSession_types_1.TurnPhase.DYING_RESCUE);
    const payload = {
        playerId,
        rescueWindowMs: session.config.dyingRescueTotalMs,
        rescueDeadlineAt,
        phase: GameSession_types_1.TurnPhase.DYING_RESCUE,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLAYER_DYING', payload);
    const detail = buildDyingRescueDetail(session, playerId);
    if (detail) {
        (0, direct_1.emitToPlayer)(io, playerId, 'DYING_RESCUE_DETAIL', detail);
    }
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
// ─── Rescue activity tracking ─────────────────────────────────────────────────
/** Track valid activity without extending the fixed rescue deadline. */
function refreshDyingRescueActivity(session, playerId) {
    if (session.dyingRescue?.playerId === playerId) {
        session.dyingRescue.lastActionAt = Date.now();
    }
}
function buildDyingRescueDetail(session, playerId) {
    const rescue = session.dyingRescue;
    const pending = session.pendingBankruptcy;
    if (!rescue || !pending || rescue.playerId !== playerId || pending.playerId !== playerId) {
        return null;
    }
    return {
        amountOwed: pending.amountOwed,
        creditorId: pending.creditorId,
        bankruptcyType: pending.type,
        rescueDeadlineAt: rescue.startedAt + session.config.dyingRescueTotalMs,
        availableActions: [...exports.DYING_RESCUE_AVAILABLE_ACTIONS],
    };
}
/** Settle a rescue debt after the player raises enough cash. */
function rescueDyingPlayer(session, playerId, io) {
    const pending = session.pendingBankruptcy;
    if (!pending || pending.playerId !== playerId)
        return false;
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    if (player.cash < pending.amountOwed)
        return false;
    cancelDyingTimers(session, playerId);
    const amount = pending.amountOwed;
    if (amount > 0) {
        (0, GameSession_1.cashChange)(session, playerId, -amount, 'DYING_RESCUE_PAYMENT', io);
        if (pending.creditorId) {
            (0, GameSession_1.cashChange)(session, pending.creditorId, amount, `DYING_RESCUE_PAYMENT_FROM_${playerId}`, io);
        }
    }
    player.status = Player_types_1.PlayerStatus.ACTIVE;
    session.dyingRescue = null;
    session.pendingBankruptcy = null;
    const payload = { playerId };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLAYER_RESCUED', payload);
    return true;
}
// ─── Declare bankruptcy (voluntary) ─────────────────────────────────────────
function declareBankruptcy(session, playerId, io) {
    const pending = session.pendingBankruptcy;
    if (!pending || pending.playerId !== playerId)
        return;
    cancelDyingTimers(session, playerId);
    resolveBankruptcy(session, playerId, pending.type, pending.creditorId, pending.amountOwed, io);
}
// ─── Whale-fall (involuntary) ─────────────────────────────────────────────────
function triggerWhaleFall(session, playerId, reason, io) {
    cancelDyingTimers(session, playerId);
    const payload = { playerId, reason };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'WHALE_FALL', payload);
    // Whale-fall is always TYPE_A
    resolveBankruptcy(session, playerId, GameSession_types_1.BankruptcyType.TYPE_A, null, 0, io);
}
// ─── Resolution ──────────────────────────────────────────────────────────────
function resolveBankruptcy(session, playerId, type, creditorId, amountOwed, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    const wasCurrentTurn = session.playerOrder[session.currentPlayerIndex] === playerId;
    const wasDyingRescuePlayer = session.dyingRescue?.playerId === playerId;
    const hadMatchingPendingBankruptcy = session.pendingBankruptcy?.playerId === playerId;
    (0, TradeLifecycle_1.voidTradesInvolvingPlayer)(session, playerId, Trade_types_1.TradeVoidReason.PLAYER_BANKRUPT, io);
    // TYPE_B debts are paid from real cash plus the proceeds of liquidating
    // buildings and unmortgaged land. TYPE_A assets are returned to the bank
    // without creating cash because those debts have no player creditor.
    liquidateOwnedAssets(session, playerId, type === GameSession_types_1.BankruptcyType.TYPE_B && creditorId !== null, io);
    if (type === GameSession_types_1.BankruptcyType.TYPE_B && creditorId) {
        const transferAmount = Math.min(player.cash, amountOwed);
        if (transferAmount > 0) {
            (0, GameSession_1.cashChange)(session, playerId, -transferAmount, 'BANKRUPTCY_LIQUIDATION', io);
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
    // Destroy remaining cash through the authoritative mutation path.
    if (player.cash !== 0) {
        (0, GameSession_1.cashChange)(session, playerId, -player.cash, 'BANKRUPTCY_CASH_DESTROYED', io);
    }
    // Destroy prop cards
    player.propCards = [];
    (0, GameSession_1.syncPropCards)(session, playerId, io);
    // Mark bankrupt
    player.status = Player_types_1.PlayerStatus.BANKRUPT;
    if (wasDyingRescuePlayer) {
        session.dyingRescue = null;
    }
    if (hadMatchingPendingBankruptcy) {
        session.pendingBankruptcy = null;
    }
    const bankruptPayload = {
        playerId,
        bankruptType: type,
        creditorId: creditorId ?? null,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLAYER_BANKRUPT', bankruptPayload);
    removePlayerFromOrder(session, playerId, wasCurrentTurn);
    logger_1.logger.info({ roomId: session.id, playerId, type }, 'Bankruptcy resolved');
    // Check if game is over
    const winnerId = (0, GameSession_1.checkVictory)(session);
    if (winnerId) {
        endGame(session, [winnerId], io);
        return;
    }
    // A non-current player can whale-fall without interrupting the active turn.
    if (wasCurrentTurn || wasDyingRescuePlayer) {
        session.status = GameSession_types_1.GameStatus.IN_PROGRESS;
        session.pausedAt = null;
        session.disconnectedCurrentPlayerId = null;
        (0, TurnFlow_1.advanceToNextTurn)(session, io);
    }
}
// ─── Game over ────────────────────────────────────────────────────────────────
function endGame(session, winnerIds, io) {
    const { GameStatus } = require('../types/GameSession.types');
    session.status = GameStatus.FINISHED;
    session.finishedAt = Date.now();
    session.winnerIds = winnerIds;
    (0, timerUtils_1.cancelAllTimers)(session.id);
    (0, TradeLifecycle_1.voidAllPendingTrades)(session, Trade_types_1.TradeVoidReason.GAME_ENDED, io);
    const standings = session.playerOrder.map((pid, i) => ({ playerId: pid, rank: i + 1 }));
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'GAME_OVER', { winnerIds, standings });
    logger_1.logger.info({ roomId: session.id, winnerIds }, 'Game over');
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function cancelDyingTimers(session, playerId) {
    (0, timerUtils_1.cancelAllTimers)(`${session.id}:${playerId}`);
}
function removePlayerFromOrder(session, playerId, wasCurrentTurn) {
    const removedIndex = session.playerOrder.indexOf(playerId);
    if (removedIndex < 0)
        return;
    session.playerOrder.splice(removedIndex, 1);
    if (session.playerOrder.length === 0) {
        session.currentPlayerIndex = 0;
    }
    else if (wasCurrentTurn) {
        session.currentPlayerIndex = (removedIndex - 1 + session.playerOrder.length) % session.playerOrder.length;
    }
    else if (removedIndex < session.currentPlayerIndex) {
        session.currentPlayerIndex--;
    }
}
function liquidateOwnedAssets(session, playerId, realizeProceeds, io) {
    let proceeds = 0;
    for (const tile of session.board) {
        if (!('ownerId' in tile) || tile.ownerId !== playerId)
            continue;
        if (tile.type === Tile_types_1.TileType.PROPERTY) {
            if (realizeProceeds && tile.buildingLevel > 0) {
                proceeds += Math.floor(tile.buildCost * tile.buildingLevel * session.config.buildingRefundRate);
            }
            tile.buildingLevel = 0;
        }
        if ('isMortgaged' in tile) {
            if (realizeProceeds && !tile.isMortgaged && 'mortgageValue' in tile) {
                proceeds += tile.mortgageValue;
            }
            tile.isMortgaged = true;
        }
    }
    if (realizeProceeds && proceeds > 0) {
        (0, GameSession_1.cashChange)(session, playerId, proceeds, 'BANKRUPTCY_ASSET_LIQUIDATION', io);
    }
}
//# sourceMappingURL=BankruptcyResolver.js.map