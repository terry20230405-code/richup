"use strict";
/**
 * Free-trade system.
 *
 * Rules (per PRD):
 *  - Either party can propose a trade at almost any phase
 *  - Entering DYING_RESCUE voids existing outgoing trades for the dying player
 *  - The dying player can still INITIATE new trades
 *  - Cash amounts in TRADE_PROPOSED are private (directed to both parties only)
 *  - TRADE_COMPLETED reveals cash amount publicly
 *  - Forced-trade card cannot target tiles with buildings (enforced in PropCardHandler)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.proposeTrade = proposeTrade;
exports.acceptTrade = acceptTrade;
exports.rejectTrade = rejectTrade;
exports.cancelTrade = cancelTrade;
exports.voidOutgoingTrades = voidOutgoingTrades;
const uuid_1 = require("uuid");
const Trade_types_1 = require("../types/Trade.types");
const GameSession_1 = require("../state/GameSession");
const broadcast_1 = require("../socket/emitters/broadcast");
const direct_1 = require("../socket/emitters/direct");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
// ─── Propose ──────────────────────────────────────────────────────────────────
function proposeTrade(session, proposerId, responderId, proposerOffer, responderOffer, io) {
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
    const broadcastPayload = { trade: publicView };
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
    // Final validation (re-check ownership and funds)
    validateOffer(session, trade.proposerId, trade.proposerOffer);
    validateOffer(session, trade.responderId, trade.responderOffer);
    // Execute transfers
    executeTrade(session, trade, io);
    trade.status = Trade_types_1.TradeStatus.ACCEPTED;
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
/**
 * Void all outgoing pending trades from a specific proposer.
 * Called when a player enters DYING_RESCUE.
 */
function voidOutgoingTrades(session, proposerId, reason, io) {
    for (const [tradeId, trade] of session.activeTrades) {
        if (trade.proposerId === proposerId && trade.status === Trade_types_1.TradeStatus.PENDING) {
            trade.status = Trade_types_1.TradeStatus.VOIDED;
            trade.voidReason = reason;
            trade.resolvedAt = Date.now();
            session.activeTrades.delete(tradeId);
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'TRADE_VOIDED', {
                tradeId,
                reason,
            });
        }
    }
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
    // Cash check
    if ((offer.cash ?? 0) > 0 && player.cash < (offer.cash ?? 0)) {
        throw new errors_1.InsufficientFundsError(playerId, offer.cash ?? 0, player.cash);
    }
    // Tile ownership + no buildings check
    for (const tileId of offer.tileIds) {
        const tile = session.board[tileId];
        if (!tile || !('ownerId' in tile))
            throw new errors_1.NotFoundError('Tile', tileId);
        if (tile.ownerId !== playerId) {
            throw new errors_1.RuleViolationError(`Player ${playerId} does not own tile ${tileId}`);
        }
    }
    // Prop card ownership
    for (const cardId of (offer.propCardIds ?? [])) {
        if (!player.propCards.find(c => c.id === cardId)) {
            throw new errors_1.RuleViolationError(`Player ${playerId} does not have card ${cardId}`);
        }
    }
}
function requireTrade(session, tradeId) {
    const trade = session.activeTrades.get(tradeId);
    if (!trade)
        throw new errors_1.NotFoundError('Trade', tradeId);
    return trade;
}
//# sourceMappingURL=TradeManager.js.map