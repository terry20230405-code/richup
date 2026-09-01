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

import { v4 as uuidv4 } from 'uuid';
import type { Server } from 'socket.io';
import type { PlayerId, TileId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { GameStatus, TurnPhase } from '../types/GameSession.types';
import { PlayerStatus } from '../types/Player.types';
import type { Trade, TradeOffer, TradePublicView } from '../types/Trade.types';
import { TradeStatus } from '../types/Trade.types';
import type {
  S2C_TradeProposed,
  S2C_TradeAccepted,
  S2C_TradeRejected,
  S2C_TradeCancelled,
  S2C_TradeCompleted,
  S2C_TradeDetail,
} from '../types/Events.types';
import { requirePlayer, cashChange, syncPropCards } from '../state/GameSession';
import { assertNotBidLocked } from './AuctionManager';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { emitToPlayer } from '../socket/emitters/direct';
import { NotFoundError, RuleViolationError, InsufficientFundsError } from '../utils/errors';
import { logger } from '../utils/logger';
import { rescueDyingPlayer, refreshDyingRescueActivity } from './BankruptcyResolver';
import { advanceToNextTurn } from './TurnFlow';

export { voidTradesInvolvingPlayer } from './TradeLifecycle';

// ─── Propose ──────────────────────────────────────────────────────────────────

export function proposeTrade(
  session: GameSession,
  proposerId: PlayerId,
  responderId: PlayerId,
  proposerOffer: TradeOffer,
  responderOffer: TradeOffer,
  io: Server,
): string {
  if (proposerId === responderId) {
    throw new RuleViolationError('Cannot trade with yourself');
  }

  assertTradeExecutionAvailable(session);
  assertTradeParticipant(session, proposerId);
  assertTradeParticipant(session, responderId);

  if (isEmptyOffer(proposerOffer) && isEmptyOffer(responderOffer)) {
    throw new RuleViolationError('A trade must exchange at least one asset');
  }

  if (session.currentPhase === TurnPhase.DYING_RESCUE) {
    const dyingPlayerId = session.dyingRescue?.playerId;
    if (!dyingPlayerId || (proposerId !== dyingPlayerId && responderId !== dyingPlayerId)) {
      throw new RuleViolationError('A rescue trade must involve the dying player');
    }
    refreshDyingRescueActivity(session, dyingPlayerId);
  }

  validateOffer(session, proposerId, proposerOffer);
  validateOffer(session, responderId, responderOffer);

  const tradeId = uuidv4();
  const trade: Trade = {
    id: tradeId,
    proposerId,
    responderId,
    proposerOffer,
    responderOffer,
    status: TradeStatus.PENDING,
    proposedAt: Date.now(),
    resolvedAt: null,
    voidReason: null,
  };

  session.activeTrades.set(tradeId, trade);

  // Broadcast public view (no cash amounts)
  const publicView: TradePublicView = {
    tradeId,
    proposerId,
    responderId,
    proposerTileIds: proposerOffer.tileIds,
    responderTileIds: responderOffer.tileIds,
    status: TradeStatus.PENDING,
    proposedAt: trade.proposedAt,
  };
  const broadcastPayload: S2C_TradeProposed = publicView;
  broadcastToRoom(io, session.id, 'TRADE_PROPOSED', broadcastPayload);

  // Send full details (with cash) to both parties only
  const detail: S2C_TradeDetail = { tradeId, proposerOffer, responderOffer };
  emitToPlayer(io, proposerId, 'TRADE_DETAIL', detail);
  emitToPlayer(io, responderId, 'TRADE_DETAIL', detail);

  logger.debug({ roomId: session.id, tradeId, proposerId, responderId }, 'Trade proposed');
  return tradeId;
}

// ─── Accept ───────────────────────────────────────────────────────────────────

export function acceptTrade(
  session: GameSession,
  tradeId: string,
  responderId: PlayerId,
  io: Server,
): void {
  const trade = requireTrade(session, tradeId);
  if (trade.responderId !== responderId) throw new RuleViolationError('Not the trade responder');
  if (trade.status !== TradeStatus.PENDING) throw new RuleViolationError('Trade is no longer pending');

  assertTradeExecutionAvailable(session);
  assertTradeParticipant(session, trade.proposerId);
  assertTradeParticipant(session, trade.responderId);

  const dyingPlayerId = session.currentPhase === TurnPhase.DYING_RESCUE
    ? session.dyingRescue?.playerId ?? null
    : null;
  if (
    dyingPlayerId &&
    trade.proposerId !== dyingPlayerId &&
    trade.responderId !== dyingPlayerId
  ) {
    throw new RuleViolationError('A rescue trade must involve the dying player');
  }

  // Final validation (re-check ownership and funds)
  validateOffer(session, trade.proposerId, trade.proposerOffer);
  validateOffer(session, trade.responderId, trade.responderOffer);

  // Execute transfers
  executeTrade(session, trade, io);
  trade.status = TradeStatus.COMPLETED;
  trade.resolvedAt = Date.now();
  session.activeTrades.delete(tradeId);

  const acceptPayload: S2C_TradeAccepted = { tradeId };
  broadcastToRoom(io, session.id, 'TRADE_ACCEPTED', acceptPayload);

  // Determine net cash flow
  const netCash = (trade.responderOffer.cash ?? 0) - (trade.proposerOffer.cash ?? 0);

  const tileTransfers: Array<{ tileId: TileId; newOwnerId: PlayerId }> = [
    ...trade.proposerOffer.tileIds.map(t => ({ tileId: t, newOwnerId: trade.responderId })),
    ...trade.responderOffer.tileIds.map(t => ({ tileId: t, newOwnerId: trade.proposerId })),
  ];

  const completedPayload: S2C_TradeCompleted = {
    tradeId,
    tileTransfers,
    cashAmount: Math.abs(netCash) as Money,
  };
  broadcastToRoom(io, session.id, 'TRADE_COMPLETED', completedPayload);

  if (dyingPlayerId) {
    refreshDyingRescueActivity(session, dyingPlayerId);
    if (rescueDyingPlayer(session, dyingPlayerId, io)) {
      advanceToNextTurn(session, io);
    }
  }

  logger.info({ roomId: session.id, tradeId }, 'Trade completed');
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export function rejectTrade(
  session: GameSession,
  tradeId: string,
  responderId: PlayerId,
  io: Server,
): void {
  const trade = requireTrade(session, tradeId);
  if (trade.responderId !== responderId) throw new RuleViolationError('Not the trade responder');
  if (trade.status !== TradeStatus.PENDING) throw new RuleViolationError('Trade is no longer pending');

  trade.status = TradeStatus.REJECTED;
  trade.resolvedAt = Date.now();
  session.activeTrades.delete(tradeId);

  const payload: S2C_TradeRejected = { tradeId };
  broadcastToRoom(io, session.id, 'TRADE_REJECTED', payload);
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export function cancelTrade(
  session: GameSession,
  tradeId: string,
  proposerId: PlayerId,
  io: Server,
): void {
  const trade = requireTrade(session, tradeId);
  if (trade.proposerId !== proposerId) throw new RuleViolationError('Not the trade proposer');
  if (trade.status !== TradeStatus.PENDING) throw new RuleViolationError('Trade is no longer pending');

  trade.status = TradeStatus.CANCELLED;
  trade.resolvedAt = Date.now();
  session.activeTrades.delete(tradeId);

  const payload: S2C_TradeCancelled = { tradeId };
  broadcastToRoom(io, session.id, 'TRADE_CANCELLED', payload);
}

// ─── Execution ────────────────────────────────────────────────────────────────

function executeTrade(session: GameSession, trade: Trade, io: Server): void {
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
    syncPropCards(session, proposerId, io);
    syncPropCards(session, responderId, io);
  }

  // Cash transfers (net zero in terms of game economy)
  const proposerPays = proposerOffer.cash ?? 0;
  const responderPays = responderOffer.cash ?? 0;

  if (proposerPays > 0) {
    cashChange(session, proposerId, -(proposerPays as Money), 'TRADE_CASH', io);
    cashChange(session, responderId, proposerPays as Money, 'TRADE_CASH', io);
  }
  if (responderPays > 0) {
    cashChange(session, responderId, -(responderPays as Money), 'TRADE_CASH', io);
    cashChange(session, proposerId, responderPays as Money, 'TRADE_CASH', io);
  }
}

function transferTile(session: GameSession, tileId: TileId, fromId: PlayerId, toId: PlayerId): void {
  const tile = session.board[tileId];
  if (!tile || !('ownerId' in tile)) throw new RuleViolationError(`Tile ${tileId} is not transferable`);
  if ((tile as { ownerId: PlayerId | null }).ownerId !== fromId) {
    throw new RuleViolationError(`Player ${fromId} does not own tile ${tileId}`);
  }
  (tile as { ownerId: PlayerId | null }).ownerId = toId;
}

function transferPropCard(session: GameSession, cardId: string, fromId: PlayerId, toId: PlayerId): void {
  const from = requirePlayer(session, fromId);
  const to = requirePlayer(session, toId);

  const idx = from.propCards.findIndex(c => c.id === cardId);
  if (idx === -1) throw new RuleViolationError(`Player ${fromId} does not have card ${cardId}`);

  const [card] = from.propCards.splice(idx, 1);
  if (card) to.propCards.push(card);
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateOffer(session: GameSession, playerId: PlayerId, offer: TradeOffer): void {
  const player = requirePlayer(session, playerId);

  if (offer.cash !== undefined && (!Number.isInteger(offer.cash) || offer.cash < 0)) {
    throw new RuleViolationError('Trade cash must be a non-negative integer');
  }

  if (new Set(offer.tileIds).size !== offer.tileIds.length) {
    throw new RuleViolationError('A trade cannot offer the same tile more than once');
  }
  const cardIds = offer.propCardIds ?? [];
  if (new Set(cardIds).size !== cardIds.length) {
    throw new RuleViolationError('A trade cannot offer the same prop card more than once');
  }

  // Cash check
  if ((offer.cash ?? 0) > 0 && player.cash < (offer.cash ?? 0)) {
    throw new InsufficientFundsError(playerId, offer.cash ?? 0, player.cash);
  }
  if ((offer.cash ?? 0) > 0) {
    assertNotBidLocked(session, playerId, offer.cash as Money);
  }

  // Tile ownership + no buildings check
  for (const tileId of offer.tileIds) {
    const tile = session.board[tileId];
    if (!tile || !('ownerId' in tile)) throw new NotFoundError('Tile', tileId);
    if ((tile as { ownerId: PlayerId | null }).ownerId !== playerId) {
      throw new RuleViolationError(`Player ${playerId} does not own tile ${tileId}`);
    }
    if ('buildingLevel' in tile && tile.buildingLevel > 0) {
      throw new RuleViolationError(`Tile ${tileId} must have no buildings before trading`);
    }
  }

  // Prop card ownership
  for (const cardId of (offer.propCardIds ?? [])) {
    if (!player.propCards.find(c => c.id === cardId)) {
      throw new RuleViolationError(`Player ${playerId} does not have card ${cardId}`);
    }
  }
}

function assertTradeExecutionAvailable(session: GameSession): void {
  if (session.status !== GameStatus.IN_PROGRESS) {
    throw new RuleViolationError('Trades cannot be proposed or accepted while the game is not running');
  }
}

function assertTradeParticipant(session: GameSession, playerId: PlayerId): void {
  const player = requirePlayer(session, playerId);
  if (!player.isConnected || player.status === PlayerStatus.DISCONNECTED) {
    throw new RuleViolationError(`Player ${playerId} is disconnected`);
  }
  if (player.status === PlayerStatus.BANKRUPT) {
    throw new RuleViolationError(`Player ${playerId} is bankrupt`);
  }
  if (
    player.status === PlayerStatus.DYING &&
    (session.currentPhase !== TurnPhase.DYING_RESCUE || session.dyingRescue?.playerId !== playerId)
  ) {
    throw new RuleViolationError(`Player ${playerId} is not in an active rescue window`);
  }
}

function isEmptyOffer(offer: TradeOffer): boolean {
  return (offer.cash ?? 0) === 0 && offer.tileIds.length === 0 && (offer.propCardIds?.length ?? 0) === 0;
}

function requireTrade(session: GameSession, tradeId: string): Trade {
  const trade = session.activeTrades.get(tradeId);
  if (!trade) throw new NotFoundError('Trade', tradeId);
  return trade;
}
