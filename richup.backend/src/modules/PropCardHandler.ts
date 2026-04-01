/**
 * Prop-card effect dispatcher — 6 card types.
 *
 *  FORCED_TRADE  — buy any non-built tile from any player at its basePrice
 *  REMOTE_DICE   — choose steps (5/6/7), overrides next roll
 *  PLUNDER       — steal max(0, floor(target.cash / 2)) from a target player
 *  IMMUNITY      — next time you must pay rent, it's waived (one use)
 *  AUDIT         — private: see all players' current cash balances
 *  PRICE_HIKE    — your rent is ×1.5 until the start of your next turn
 */

import type { Server } from 'socket.io';
import type { PlayerId, TileId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { PropCardType } from '../types/PropCard.types';
import type {
  S2C_PropCardUsed,
  S2C_ForcedTradeExecuted,
  S2C_PlunderExecuted,
  S2C_AuditResult,
} from '../types/Events.types';
import { requirePlayer, cashChange } from '../state/GameSession';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { emitToPlayer } from '../socket/emitters/direct';
import { applyRemoteDice } from './DiceEngine';
import { NotFoundError, RuleViolationError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface PropCardParams {
  targetPlayerId?: PlayerId;
  targetTileId?: TileId;
  steps?: 5 | 6 | 7;
}

/**
 * Execute a prop card effect.
 * Removes the card from the player's hand if successful.
 */
export function usePropCard(
  session: GameSession,
  playerId: PlayerId,
  cardId: string,
  cardType: PropCardType,
  params: PropCardParams,
  io: Server,
): void {
  const player = requirePlayer(session, playerId);

  // Verify card ownership
  const cardIndex = player.propCards.findIndex(c => c.id === cardId && c.type === cardType);
  if (cardIndex === -1) {
    throw new RuleViolationError(`Player does not hold card ${cardId} of type ${cardType}`);
  }

  // Dispatch by type
  switch (cardType) {
    case PropCardType.FORCED_TRADE:
      handleForcedTrade(session, playerId, params, io);
      break;
    case PropCardType.REMOTE_DICE:
      handleRemoteDice(session, playerId, params, io);
      break;
    case PropCardType.PLUNDER:
      handlePlunder(session, playerId, params, io);
      break;
    case PropCardType.IMMUNITY:
      handleImmunity(session, playerId, io);
      break;
    case PropCardType.AUDIT:
      handleAudit(session, playerId, io);
      break;
    case PropCardType.PRICE_HIKE:
      handlePriceHike(session, playerId, io);
      break;
    default:
      throw new RuleViolationError(`Unknown prop card type: ${cardType}`);
  }

  // Remove used card
  player.propCards.splice(cardIndex, 1);

  // Broadcast usage (type revealed, target may be revealed)
  const payload: S2C_PropCardUsed = {
    playerId,
    cardType,
    targetPlayerId: params.targetPlayerId,
    targetTileId: params.targetTileId,
  };
  broadcastToRoom(io, session.id, 'PROP_CARD_USED', payload);

  logger.debug({ roomId: session.id, playerId, cardType }, 'Prop card used');
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

function handleForcedTrade(
  session: GameSession,
  buyerId: PlayerId,
  params: PropCardParams,
  io: Server,
): void {
  const { targetPlayerId, targetTileId } = params;
  if (!targetPlayerId || targetTileId === undefined) {
    throw new RuleViolationError('FORCED_TRADE requires targetPlayerId and targetTileId');
  }

  const tile = session.board[targetTileId];
  if (!tile) throw new NotFoundError('Tile', targetTileId);
  if (!('ownerId' in tile)) throw new RuleViolationError('Tile cannot be traded');

  const typedTile = tile as { ownerId: PlayerId | null; buildingLevel?: number; basePrice: number; isMortgaged: boolean };

  if (typedTile.ownerId !== targetPlayerId) {
    throw new RuleViolationError(`Player ${targetPlayerId} does not own tile ${targetTileId}`);
  }
  if ((typedTile.buildingLevel ?? 0) > 0) {
    throw new RuleViolationError('Cannot force-trade a tile with buildings');
  }
  if (typedTile.isMortgaged) {
    throw new RuleViolationError('Cannot force-trade a mortgaged tile');
  }

  const price = typedTile.basePrice as Money;
  const buyer = requirePlayer(session, buyerId);
  if (buyer.cash < price) {
    throw new RuleViolationError('Insufficient funds for forced trade');
  }

  // Transfer ownership
  typedTile.ownerId = buyerId;

  // Cash exchange
  cashChange(session, buyerId, -price, 'FORCED_TRADE_BUY', io);
  cashChange(session, targetPlayerId, price, 'FORCED_TRADE_SELL', io);

  const payload: S2C_ForcedTradeExecuted = {
    fromPlayerId: buyerId,
    toPlayerId: targetPlayerId,
    tileId: targetTileId,
    price,
  };
  broadcastToRoom(io, session.id, 'FORCED_TRADE_EXECUTED', payload);
}

function handleRemoteDice(
  session: GameSession,
  playerId: PlayerId,
  params: PropCardParams,
  io: Server,
): void {
  const { steps } = params;
  if (!steps || ![5, 6, 7].includes(steps)) {
    throw new RuleViolationError('REMOTE_DICE requires steps of 5, 6, or 7');
  }
  applyRemoteDice(session, playerId, steps, io);
}

function handlePlunder(
  session: GameSession,
  plunderer: PlayerId,
  params: PropCardParams,
  io: Server,
): void {
  const { targetPlayerId } = params;
  if (!targetPlayerId) throw new RuleViolationError('PLUNDER requires targetPlayerId');

  const target = requirePlayer(session, targetPlayerId);

  // max(0, floor(target.cash / 2)) — 0 if target has no cash
  const stealAmount = Math.max(0, Math.floor(target.cash / 2)) as Money;

  if (stealAmount > 0) {
    cashChange(session, targetPlayerId, -stealAmount, 'PLUNDER_VICTIM', io);
    cashChange(session, plunderer, stealAmount, 'PLUNDER_GAIN', io);
  }

  const payload: S2C_PlunderExecuted = {
    fromPlayerId: plunderer,
    toPlayerId: targetPlayerId,
    amount: stealAmount,
  };
  broadcastToRoom(io, session.id, 'PLUNDER_EXECUTED', payload);
}

function handleImmunity(session: GameSession, playerId: PlayerId, _io: Server): void {
  const player = requirePlayer(session, playerId);
  player.hasImmunity = true;
  // Broadcast happens via PROP_CARD_USED (type revealed) — actual use revealed via IMMUNITY_USED
}

function handleAudit(session: GameSession, auditorId: PlayerId, io: Server): void {
  const cashMap: Record<PlayerId, Money> = {};
  for (const [id, p] of session.players) {
    cashMap[id] = p.cash;
  }

  const payload: S2C_AuditResult = {
    requestedByPlayerId: auditorId,
    playerCashMap: cashMap,
  };
  // ⚠ Directed only — never broadcast
  emitToPlayer(io, auditorId, 'AUDIT_RESULT', payload);
}

function handlePriceHike(session: GameSession, playerId: PlayerId, _io: Server): void {
  const player = requirePlayer(session, playerId);
  player.priceHikeActive = true;
  player.priceHikeExpiresOnTurn = session.turnNumber + session.playerOrder.length;
  // Expiry handled in SocketEventRouter at TURN_STARTED
}
