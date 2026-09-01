import type { Server } from 'socket.io';
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { TradeStatus, TradeVoidReason } from '../types/Trade.types';
import { broadcastToRoom } from '../socket/emitters/broadcast';

function voidPendingTrade(
  session: GameSession,
  tradeId: string,
  reason: TradeVoidReason,
  io: Server,
): void {
  const trade = session.activeTrades.get(tradeId);
  if (!trade || trade.status !== TradeStatus.PENDING) return;

  trade.status = TradeStatus.VOIDED;
  trade.voidReason = reason;
  trade.resolvedAt = Date.now();
  session.activeTrades.delete(tradeId);

  broadcastToRoom(io, session.id, 'TRADE_VOIDED', { tradeId, reason });
}

/** Void every pending trade where the player is either party. */
export function voidTradesInvolvingPlayer(
  session: GameSession,
  playerId: PlayerId,
  reason: TradeVoidReason,
  io: Server,
): void {
  const tradeIds = [...session.activeTrades.values()]
    .filter(trade => trade.proposerId === playerId || trade.responderId === playerId)
    .map(trade => trade.id);

  for (const tradeId of tradeIds) {
    voidPendingTrade(session, tradeId, reason, io);
  }
}

/** Void all pending trades, used when the match reaches a terminal state. */
export function voidAllPendingTrades(
  session: GameSession,
  reason: TradeVoidReason,
  io: Server,
): void {
  for (const tradeId of [...session.activeTrades.keys()]) {
    voidPendingTrade(session, tradeId, reason, io);
  }
}
