"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voidTradesInvolvingPlayer = voidTradesInvolvingPlayer;
exports.voidAllPendingTrades = voidAllPendingTrades;
const Trade_types_1 = require("../types/Trade.types");
const broadcast_1 = require("../socket/emitters/broadcast");
function voidPendingTrade(session, tradeId, reason, io) {
    const trade = session.activeTrades.get(tradeId);
    if (!trade || trade.status !== Trade_types_1.TradeStatus.PENDING)
        return;
    trade.status = Trade_types_1.TradeStatus.VOIDED;
    trade.voidReason = reason;
    trade.resolvedAt = Date.now();
    session.activeTrades.delete(tradeId);
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'TRADE_VOIDED', { tradeId, reason });
}
/** Void every pending trade where the player is either party. */
function voidTradesInvolvingPlayer(session, playerId, reason, io) {
    const tradeIds = [...session.activeTrades.values()]
        .filter(trade => trade.proposerId === playerId || trade.responderId === playerId)
        .map(trade => trade.id);
    for (const tradeId of tradeIds) {
        voidPendingTrade(session, tradeId, reason, io);
    }
}
/** Void all pending trades, used when the match reaches a terminal state. */
function voidAllPendingTrades(session, reason, io) {
    for (const tradeId of [...session.activeTrades.keys()]) {
        voidPendingTrade(session, tradeId, reason, io);
    }
}
//# sourceMappingURL=TradeLifecycle.js.map