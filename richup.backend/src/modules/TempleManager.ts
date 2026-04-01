/**
 * Temple tile logic.
 *
 * Rules (per PRD):
 *  - Owner lands on own lit temple → draws 1 PropCard (no fee)
 *  - Owner lands on own unlit temple → pays prayFee, litCount++; if litCount >= litThreshold → temple lights up
 *  - Non-owner lands → pays passThruToll to owner
 *  - Temple can only be "lit" once per game
 */

import type { Server } from 'socket.io';
import type { PlayerId, TileId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import type { TempleTile } from '../types/Tile.types';
import { TileType } from '../types/Tile.types';
import type { S2C_TempleLit, S2C_PropCardDrawn, S2C_RentCharged } from '../types/Events.types';
import { PropCardType } from '../types/PropCard.types';
import { requirePlayer, cashChange } from '../state/GameSession';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { computeRent } from './RentCalculator';
import { NotFoundError, RuleViolationError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';
import { BANK_ID } from '../types/Common.types';
import { logger } from '../utils/logger';

// Prop card pool for temple draws (same distribution as surprise cards)
const TEMPLE_PROP_POOL: PropCardType[] = [
  PropCardType.FORCED_TRADE,
  PropCardType.REMOTE_DICE,
  PropCardType.PLUNDER,
  PropCardType.IMMUNITY,
  PropCardType.AUDIT,
  PropCardType.PRICE_HIKE,
];

function randomPropType(): PropCardType {
  const idx = Math.floor(Math.random() * TEMPLE_PROP_POOL.length);
  return TEMPLE_PROP_POOL[idx]!;
}

// ─── Landing handler ──────────────────────────────────────────────────────────

export interface TempleEventResult {
  ownerPrayed: boolean;    // Owner paid to pray
  propCardDrawn: boolean;  // Owner drew a card from lit temple
  rentCharged: boolean;    // Non-owner paid toll
}

/**
 * Handle a player landing on a temple tile.
 * Returns a description of what happened.
 */
export function handleTempleLanding(
  session: GameSession,
  landingPlayerId: PlayerId,
  tileId: TileId,
  io: Server,
): TempleEventResult {
  const tile = session.board[tileId];
  if (!tile || tile.type !== TileType.TEMPLE) throw new NotFoundError('TempleTile', tileId);

  const temple = tile as TempleTile;
  const result: TempleEventResult = { ownerPrayed: false, propCardDrawn: false, rentCharged: false };

  if (!temple.ownerId) {
    // Unowned — no effect (player can buy in EVENT_TRIGGER phase)
    return result;
  }

  if (temple.ownerId === landingPlayerId) {
    // Owner landed on own temple
    if (temple.isLit) {
      // Lit temple: draw a prop card
      const player = requirePlayer(session, landingPlayerId);
      const propType = randomPropType();
      player.propCards.push({ id: uuidv4(), type: propType, acquiredAt: Date.now() });

      const drawnPayload: S2C_PropCardDrawn = { playerId: landingPlayerId };
      broadcastToRoom(io, session.id, 'PROP_CARD_DRAWN', drawnPayload);

      result.propCardDrawn = true;
      logger.debug({ roomId: session.id, tileId, playerId: landingPlayerId }, 'Temple prop card drawn');
    } else {
      // Unlit temple: owner prays — handled via ACTION:TEMPLE_PRAY in router
      // Just signal the result; actual fee deducted when player explicitly prays
      result.ownerPrayed = false;
    }
  } else {
    // Non-owner: charge pass-through toll
    const rentResult = computeRent(session, tileId, landingPlayerId);
    if (rentResult.amount > 0) {
      cashChange(session, landingPlayerId, -(rentResult.amount as Money), 'TEMPLE_TOLL', io);

      if (rentResult.recipient !== BANK_ID) {
        cashChange(session, rentResult.recipient, rentResult.amount, 'TEMPLE_TOLL_RECEIVE', io);
      }

      const payload: S2C_RentCharged = {
        from: landingPlayerId,
        to: rentResult.recipient,
        tileId,
        amount: rentResult.amount,
      };
      broadcastToRoom(io, session.id, 'RENT_CHARGED', payload);
      result.rentCharged = true;
    }
  }

  return result;
}

// ─── Owner prays ──────────────────────────────────────────────────────────────

/**
 * Called when the owner explicitly clicks "TEMPLE_PRAY" (in EVENT_TRIGGER phase).
 * Deducts prayFee, increments litCount, lights up temple if threshold reached.
 */
export function ownerPrays(
  session: GameSession,
  playerId: PlayerId,
  tileId: TileId,
  io: Server,
): void {
  const tile = session.board[tileId];
  if (!tile || tile.type !== TileType.TEMPLE) throw new NotFoundError('TempleTile', tileId);

  const temple = tile as TempleTile;
  if (temple.ownerId !== playerId) throw new RuleViolationError('Only the owner can pray');
  if (temple.isLit) throw new RuleViolationError('Temple is already lit');

  const player = requirePlayer(session, playerId);
  const prayFee = temple.prayFee;
  if (player.cash < prayFee) {
    throw new RuleViolationError('Insufficient funds to pray');
  }

  cashChange(session, playerId, -prayFee, 'TEMPLE_PRAY', io);

  temple.litCount++;
  if (temple.litCount >= temple.litThreshold) {
    temple.isLit = true;
    const litPayload: S2C_TempleLit = { tileId, isLit: true };
    broadcastToRoom(io, session.id, 'TEMPLE_LIT', litPayload);
    logger.info({ roomId: session.id, tileId }, 'Temple lit up');
  }
}
