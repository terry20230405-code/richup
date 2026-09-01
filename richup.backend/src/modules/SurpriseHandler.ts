/**
 * Surprise card deck management and effect application.
 *
 * Deck is a shuffled stack; when empty the discard pile is reshuffled.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Server } from 'socket.io';
import type { PlayerId, Money } from '../types/Common.types';
import type { GameSession, SurpriseCard } from '../types/GameSession.types';
import { SurpriseCardType } from '../types/GameSession.types';
import type { S2C_SurpriseResult, S2C_SurpriseRampage, S2C_PropCardDrawn } from '../types/Events.types';
import { PropCardType } from '../types/PropCard.types';
import { cashChange, requirePlayer, syncPropCards } from '../state/GameSession';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { fisherYatesShuffle } from '../utils/randomUtils';
import { logger } from '../utils/logger';

// ─── Deck definitions ─────────────────────────────────────────────────────────

/**
 * Master card pool — all placeholder amounts.
 * PRD Phase 2 will balance these values.
 */
function buildCardPool(): SurpriseCard[] {
  return [
    // Cash gains (placeholder amounts)
    { id: uuidv4(), type: SurpriseCardType.CASH_GAIN, amount: 1000, description: 'Receive a $1000 bonus' },
    { id: uuidv4(), type: SurpriseCardType.CASH_GAIN, amount: 2000, description: 'Receive a $2000 bonus' },
    { id: uuidv4(), type: SurpriseCardType.CASH_GAIN, amount: 500,  description: 'Receive a $500 bonus' },
    { id: uuidv4(), type: SurpriseCardType.CASH_GAIN, amount: 3000, description: 'Receive a $3000 bonus' },
    // Cash losses (placeholder amounts)
    { id: uuidv4(), type: SurpriseCardType.CASH_LOSS, amount: 500,  description: 'Pay a $500 fine' },
    { id: uuidv4(), type: SurpriseCardType.CASH_LOSS, amount: 1000, description: 'Pay a $1000 fine' },
    { id: uuidv4(), type: SurpriseCardType.CASH_LOSS, amount: 2000, description: 'Pay $2000 in repair costs' },
    // Prop card draws
    { id: uuidv4(), type: SurpriseCardType.PROP_CARD, amount: 0, description: 'Draw a prop card' },
    { id: uuidv4(), type: SurpriseCardType.PROP_CARD, amount: 0, description: 'Draw a prop card' },
    // Rampage (extra roll)
    { id: uuidv4(), type: SurpriseCardType.RAMPAGE, amount: 0, description: 'Rampage! Roll the dice again' },
    { id: uuidv4(), type: SurpriseCardType.RAMPAGE, amount: 0, description: 'Rampage! Roll the dice again' },
  ];
}

/** Create a freshly shuffled surprise deck for a new game. */
export function initSurpriseDeck(): SurpriseCard[] {
  return fisherYatesShuffle(buildCardPool());
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

function drawCard(session: GameSession): SurpriseCard {
  if (session.surpriseDeck.length === 0) {
    // Reshuffle discard pile
    session.surpriseDeck = fisherYatesShuffle(session.surpriseDiscardPile);
    session.surpriseDiscardPile = [];
  }
  const card = session.surpriseDeck.pop();
  if (!card) throw new Error('Surprise deck is empty even after reshuffle');
  return card;
}

// ─── Prop card pool ───────────────────────────────────────────────────────────

const PROP_CARD_TYPES: PropCardType[] = [
  PropCardType.FORCED_TRADE,
  PropCardType.REMOTE_DICE,
  PropCardType.PLUNDER,
  PropCardType.IMMUNITY,
  PropCardType.AUDIT,
  PropCardType.PRICE_HIKE,
];

function randomPropCardType(): PropCardType {
  const idx = Math.floor(Math.random() * PROP_CARD_TYPES.length);
  return PROP_CARD_TYPES[idx]!;
}

// ─── Apply card effect ────────────────────────────────────────────────────────

export interface SurpriseEffectResult {
  rampage: boolean;   // If true, caller must trigger another dice roll
  propCardDrawn: boolean;
  requiresRescue: boolean;
  amountOwed: Money;
}

/**
 * Draw and apply a surprise card for the given player.
 * Emits SURPRISE_RESULT (and SURPRISE_RAMPAGE / PROP_CARD_DRAWN if applicable).
 */
export function applySurpriseCard(
  session: GameSession,
  playerId: PlayerId,
  io: Server,
): SurpriseEffectResult {
  const card = drawCard(session);
  session.surpriseDiscardPile.push(card);

  const result: SurpriseEffectResult = {
    rampage: false,
    propCardDrawn: false,
    requiresRescue: false,
    amountOwed: 0 as Money,
  };

  switch (card.type) {
    case SurpriseCardType.CASH_GAIN: {
      cashChange(session, playerId, card.amount as Money, 'SURPRISE_GAIN', io);
      const payload: S2C_SurpriseResult = {
        playerId,
        cashDelta: card.amount,
        cardDescription: card.description,
      };
      broadcastToRoom(io, session.id, 'SURPRISE_RESULT', payload);
      break;
    }

    case SurpriseCardType.CASH_LOSS: {
      const player = requirePlayer(session, playerId);
      if (player.cash >= card.amount) {
        cashChange(session, playerId, -(card.amount as Money), 'SURPRISE_LOSS', io);
      } else {
        result.requiresRescue = true;
        result.amountOwed = card.amount as Money;
      }
      const payload: S2C_SurpriseResult = {
        playerId,
        cashDelta: -(card.amount),
        cardDescription: card.description,
      };
      broadcastToRoom(io, session.id, 'SURPRISE_RESULT', payload);
      break;
    }

    case SurpriseCardType.PROP_CARD: {
      // Give the player a random prop card
      const propCardType = randomPropCardType();
      const player = session.players.get(playerId);
      if (player) {
        player.propCards.push({ id: uuidv4(), type: propCardType, acquiredAt: Date.now() });
        syncPropCards(session, playerId, io);
      }
      // Broadcast: only reveal WHO drew, not what type
      const drawnPayload: S2C_PropCardDrawn = { playerId };
      broadcastToRoom(io, session.id, 'PROP_CARD_DRAWN', drawnPayload);

      // Also send the full surprise result description
      const payload: S2C_SurpriseResult = { playerId, cardDescription: card.description };
      broadcastToRoom(io, session.id, 'SURPRISE_RESULT', payload);

      result.propCardDrawn = true;
      logger.debug({ roomId: session.id, playerId, propCardType }, 'Prop card drawn from surprise');
      break;
    }

    case SurpriseCardType.RAMPAGE: {
      const payload: S2C_SurpriseRampage = { playerId };
      broadcastToRoom(io, session.id, 'SURPRISE_RAMPAGE', payload);

      const resultPayload: S2C_SurpriseResult = { playerId, cardDescription: card.description };
      broadcastToRoom(io, session.id, 'SURPRISE_RESULT', resultPayload);

      result.rampage = true;
      break;
    }
  }

  return result;
}
