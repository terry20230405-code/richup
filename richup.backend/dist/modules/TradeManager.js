"use strict";
/**
 * Free-trade system.
 *
 * Rules (per PRD):
 *  - Either party can propose a trade at almost any phase
 *  - Entering DYING_RESCUE voids all existing trades involving the dying player
 *  - New rescue trades must involve the dying player
 *  - Cash amounts in TRADE_PROPOSED are private (directed to both parties only)
 *  - TRADE_COMPLETED reveals cash amount publicly
 *  - Forced-trade card cannot target tiles with buildings (enforced in PropCardHandler)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.voidTradesInvolvingPlayer = void 0;
exports.proposeTrade = proposeTrade;
exports.acceptTrade = acceptTrade;
exports.rejectTrade = rejectTrade;
exports.cancelTrade = cancelTrade;
const uuid_1 = require("uuid");
const GameSession_types_1 = require("../types/GameSession.types");
const Player_types_1 = require("../types/Player.types");
const Trade_types_1 = require("../types/Trade.types");
const GameSession_1 = require("../state/GameSession");
const AuctionManager_1 = require("./AuctionManager");
const broadcast_1 = require("../socket/emitters/broadcast");
const direct_1 = require("../socket/emitters/direct");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const BankruptcyResolver_1 = require("./BankruptcyResolver");
const TurnFlow_1 = require("./TurnFlow");
var TradeLifecycle_1 = require("./TradeLifecycle");
Object.defineProperty(exports, "voidTradesInvolvingPlayer", { enumerable: true, get: function () { return TradeLifecycle_1.voidTradesInvolvingPlayer; } });
// ─── Propose ──────────────────────────────────────────────────────────────────
function proposeTrade(session, proposerId, responderId, proposerOffer, responderOffer, io) {
    if (proposerId === responderId) {
        throw new errors_1.RuleViolationError('Cannot trade with yourself');
    }
    assertTradeExecutionAvailable(session);
    assertTradeParticipant(session, proposerId);
    assertTradeParticipant(session, responderId);
    if (isEmptyOffer(proposerOffer) && isEmptyOffer(responderOffer)) {
        throw new errors_1.RuleViolationError('A trade must exchange at least one asset');
    }
    if (session.currentPhase === GameSession_types_1.TurnPhase.DYING_RESCUE) {
        const dyingPlayerId = session.dyingRescue?.playerId;
        if (!dyingPlayerId || (proposerId !== dyingPlayerId && responderId !== dyingPlayerId)) {
            throw new errors_1.RuleViolationError('A rescue trade must involve the dying player');
        }
        (0, BankruptcyResolver_1.refreshDyingRescueActivity)(session, dyingPlayerId);
    }
    validateOffer(session, proposerId, proposerOffer);
    validateOffer(session, responderId, responderOffer);
    const tradeId = (0, uuid_1.v4)();
    const trade = {
        id: tradeId,
        proposerId,
        responderId,
        proposerOffer,
        responderOffer,
        status: Trade_types_1.TradeStatus.PENDING,
        proposedAt: Date.now(),
        resolvedAt: null,
        voidReason: null,
    };
    session.activeTrades.set(tradeId, trade);
    // Broadcast public view (no cash amounts)
    const publicView = {
        tradeId,
        proposerId,
        responderId,
        proposerTileIds: proposerOffer.tileIds,
        responderTileIds: responderOffer.tileIds,
        status: Trade_types_1.TradeStatus.PENDING,
        proposedAt: trade.proposedAt,
    };
    const broadcastPayload = publicView;
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'TRADE_PROPOSED', broadcastPayload);
    // Send full details (with cash) to both parties only
    const detail = { tradeId, proposerOffer, responderOffer };
    (0, direct_1.emitToPlayer)(io, proposerId, 'TRADE_DETAIL', detail);
    (0, direct_1.emitToPlayer)(io, responderId, 'TRADE_DETAIL', detail);
    logger_1.logger.debug({ roomId: session.id, tradeId, proposerId, responderId }, 'Trade proposed');
    return tradeId;
}
// ─── Accept ───────────────────────────────────────────────────────────────────
function acceptTrade(session, tradeId, responderId, io) {
    const trade = requireTrade(session, tradeId);
    if (trade.responderId !== responderId)
        throw new errors_1.RuleViolationError('Not the trade responder');
    if (trade.status !== Trade_types_1.TradeStatus.PENDING)
        throw new errors_1.RuleViolationError('Trade is no longer pending');
    assertTradeExecutionAvailable(session);
    assertTradeParticipant(session, trade.proposerId);
    assertTradeParticipant(session, trade.responderId);
    const dyingPlayerId = session.currentPhase === GameSession_types_1.TurnPhase.DYING_RESCUE
        ? session.dyingRescue?.playerId ?? null
        : null;
    if (dyingPlayerId &&
        trade.proposerId !== dyingPlayerId &&
        trade.responderId !== dyingPlayerId) {
        throw new errors_1.RuleViolationError('A rescue trade must involve the dying player');
    }
    // Final validation (re-check ownership and funds)
    validateOffer(session, trade.proposerId, trade.proposerOffer);
    validateOffer(session, trade.responderId, trade.responderOffer);
    // Execute transfers
    executeTrade(session, trade, io);
    trade.status = Trade_types_1.TradeStatus.COMPLETED;
    trade.resolvedAt = Date.now();
    session.activeTrades.delete(tradeId);
    const acceptPayload = { tradeId };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'TRADE_ACCEPTED', acceptPayload);
    // Determine net cash flow
    const netCash = (trade.responderOffer.cash ?? 0) - (trade.proposerOffer.cash ?? 0);
    const tileTransfers = [
        ...trade.proposerOffer.tileIds.map(t => ({ tileId: t, newOwnerId: trade.responderId })),
        ...trade.responderOffer.tileIds.map(t => ({ tileId: t, newOwnerId: trade.proposerId })),
    ];
    const completedPayload = {
        tradeId,
        tileTransfers,
        cashAmount: Math.abs(netCash),
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'TRADE_COMPLETED', completedPayload);
    if (dyingPlayerId) {
        (0, BankruptcyResolver_1.refreshDyingRescueActivity)(session, dyingPlayerId);
        if ((0, BankruptcyResolver_1.rescueDyingPlayer)(session, dyingPlayerId, io)) {
            (0, TurnFlow_1.advanceToNextTurn)(session, io);
        }
    }
    logger_1.logger.info({ roomId: session.id, tradeId }, 'Trade completed');
}
// ─── Reject ───────────────────────────────────────────────────────────────────
function rejectTrade(session, tradeId, responderId, io) {
    const trade = requireTrade(session, tradeId);
    if (trade.responderId !== responderId)
        throw new errors_1.RuleViolationError('Not the trade responder');
    if (trade.status !== Trade_types_1.TradeStatus.PENDING)
        throw new errors_1.RuleViolationError('Trade is no longer pending');
    trade.status = Trade_types_1.TradeStatus.REJECTED;
    trade.resolvedAt = Date.now();
    session.activeTrades.delete(tradeId);
    const payload = { tradeId };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'TRADE_REJECTED', payload);
}
// ─── Cancel ───────────────────────────────────────────────────────────────────
function cancelTrade(session, tradeId, proposerId, io) {
    const trade = requireTrade(session, tradeId);
    if (trade.proposerId !== proposerId)
        throw new errors_1.RuleViolationError('Not the trade proposer');
    if (trade.status !== Trade_types_1.TradeStatus.PENDING)
        throw new errors_1.RuleViolationError('Trade is no longer pending');
    trade.status = Trade_types_1.TradeStatus.CANCELLED;
    trade.resolvedAt = Date.now();
    session.activeTrades.delete(tradeId);
    const payload = { tradeId };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'TRADE_CANCELLED', payload);
}
// ─── Execution ────────────────────────────────────────────────────────────────
function executeTrade(session, trade, io) {
    const { proposerId, responderId, proposerOffer, responderOffer } = trade;
    // Transfer proposer tiles → responder
    for (const tileId of proposerOffer.tileIds) {
        transferTile(session, tileId, proposerId, responderId);
    }
    // Transfer responder tiles → proposer
    for (const tileId of responderOffer.tileIds) {
        transferTile(session, tileId, responderId, proposerId);
    }
    // Transfer prop cards
    for (const cardId of (proposerOffer.propCardIds ?? [])) {
        transferPropCard(session, cardId, proposerId, responderId);
    }
    for (const cardId of (responderOffer.propCardIds ?? [])) {
        transferPropCard(session, cardId, responderId, proposerId);
    }
    if ((proposerOffer.propCardIds?.length ?? 0) > 0 || (responderOffer.propCardIds?.length ?? 0) > 0) {
        (0, GameSession_1.syncPropCards)(session, proposerId, io);
        (0, GameSession_1.syncPropCards)(session, responderId, io);
    }
    // Cash transfers (net zero in terms of game economy)
    const proposerPays = proposerOffer.cash ?? 0;
    const responderPays = responderOffer.cash ?? 0;
    if (proposerPays > 0) {
        (0, GameSession_1.cashChange)(session, proposerId, -proposerPays, 'TRADE_CASH', io);
        (0, GameSession_1.cashChange)(session, responderId, proposerPays, 'TRADE_CASH', io);
    }
    if (responderPays > 0) {
        (0, GameSession_1.cashChange)(session, responderId, -responderPays, 'TRADE_CASH', io);
        (0, GameSession_1.cashChange)(session, proposerId, responderPays, 'TRADE_CASH', io);
    }
}
function transferTile(session, tileId, fromId, toId) {
    const tile = session.board[tileId];
    if (!tile || !('ownerId' in tile))
        throw new errors_1.RuleViolationError(`Tile ${tileId} is not transferable`);
    if (tile.ownerId !== fromId) {
        throw new errors_1.RuleViolationError(`Player ${fromId} does not own tile ${tileId}`);
    }
    tile.ownerId = toId;
}
function transferPropCard(session, cardId, fromId, toId) {
    const from = (0, GameSession_1.requirePlayer)(session, fromId);
    const to = (0, GameSession_1.requirePlayer)(session, toId);
    const idx = from.propCards.findIndex(c => c.id === cardId);
    if (idx === -1)
        throw new errors_1.RuleViolationError(`Player ${fromId} does not have card ${cardId}`);
    const [card] = from.propCards.splice(idx, 1);
    if (card)
        to.propCards.push(card);
}
// ─── Validation ───────────────────────────────────────────────────────────────
function validateOffer(session, playerId, offer) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    if (offer.cash !== undefined && (!Number.isInteger(offer.cash) || offer.cash < 0)) {
        throw new errors_1.RuleViolationError('Trade cash must be a non-negative integer');
    }
    if (new Set(offer.tileIds).size !== offer.tileIds.length) {
        throw new errors_1.RuleViolationError('A trade cannot offer the same tile more than once');
    }
    const cardIds = offer.propCardIds ?? [];
    if (new Set(cardIds).size !== cardIds.length) {
        throw new errors_1.RuleViolationError('A trade cannot offer the same prop card more than once');
    }
    // Cash check
    if ((offer.cash ?? 0) > 0 && player.cash < (offer.cash ?? 0)) {
        throw new errors_1.InsufficientFundsError(playerId, offer.cash ?? 0, player.cash);
    }
    if ((offer.cash ?? 0) > 0) {
        (0, AuctionManager_1.assertNotBidLocked)(session, playerId, offer.cash);
    }
    // Tile ownership + no buildings check
    for (const tileId of offer.tileIds) {
        const tile = session.board[tileId];
        if (!tile || !('ownerId' in tile))
            throw new errors_1.NotFoundError('Tile', tileId);
        if (tile.ownerId !== playerId) {
            throw new errors_1.RuleViolationError(`Player ${playerId} does not own tile ${tileId}`);
        }
        if ('buildingLevel' in tile && tile.buildingLevel > 0) {
            throw new errors_1.RuleViolationError(`Tile ${tileId} must have no buildings before trading`);
        }
    }
    // Prop card ownership
    for (const cardId of (offer.propCardIds ?? [])) {
        if (!player.propCards.find(c => c.id === cardId)) {
            throw new errors_1.RuleViolationError(`Player ${playerId} does not have card ${cardId}`);
        }
    }
}
function assertTradeExecutionAvailable(session) {
    if (session.status !== GameSession_types_1.GameStatus.IN_PROGRESS) {
        throw new errors_1.RuleViolationError('Trades cannot be proposed or accepted while the game is not running');
    }
}
function assertTradeParticipant(session, playerId) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    if (!player.isConnected || player.status === Player_types_1.PlayerStatus.DISCONNECTED) {
        throw new errors_1.RuleViolationError(`Player ${playerId} is disconnected`);
    }
    if (player.status === Player_types_1.PlayerStatus.BANKRUPT) {
        throw new errors_1.RuleViolationError(`Player ${playerId} is bankrupt`);
    }
    if (player.status === Player_types_1.PlayerStatus.DYING &&
        (session.currentPhase !== GameSession_types_1.TurnPhase.DYING_RESCUE || session.dyingRescue?.playerId !== playerId)) {
        throw new errors_1.RuleViolationError(`Player ${playerId} is not in an active rescue window`);
    }
}
function isEmptyOffer(offer) {
    return (offer.cash ?? 0) === 0 && offer.tileIds.length === 0 && (offer.propCardIds?.length ?? 0) === 0;
}
function requireTrade(session, tradeId) {
    const trade = session.activeTrades.get(tradeId);
    if (!trade)
        throw new errors_1.NotFoundError('Trade', tradeId);
    return trade;
}
//# sourceMappingURL=TradeManager.js.map