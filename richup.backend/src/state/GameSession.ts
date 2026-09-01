/**
 * GameSession lifecycle helpers.
 *
 * - startGame()     transitions a LOBBY session to IN_PROGRESS
 * - cashChange()    the single authoritative cash mutation + CASH_UPDATED emit
 * - getActivePlayers() / getCurrentPlayer() convenience queries
 */

import type { Server } from 'socket.io';
import type { PlayerId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { GameStatus, TurnPhase } from '../types/GameSession.types';
import type { Player } from '../types/Player.types';
import { PlayerStatus } from '../types/Player.types';
import { TileType } from '../types/Tile.types';
import type { S2C_CashUpdated, S2C_PropCardsUpdated } from '../types/Events.types';
import { generateBoard } from '../modules/MapGenerator';
import { initSurpriseDeck } from '../modules/SurpriseHandler';
import { StateMachine } from './StateMachine';
import { emitToPlayer } from '../socket/emitters/direct';
import { fisherYatesShuffle } from '../utils/randomUtils';
import { NotFoundError, RuleViolationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { cancelAllTimers } from '../utils/timerUtils';

// ─── Start game ──────────────────────────────────────────────────────────────

/**
 * Transition a LOBBY session to IN_PROGRESS.
 * Generates the board, shuffles player order, deals starting cash.
 * Call this when the host clicks "Start Game".
 */
export function startGame(session: GameSession): void {
  if (session.status !== GameStatus.LOBBY) {
    throw new RuleViolationError('Game is not in LOBBY status');
  }
  if (session.players.size < 2) {
    throw new RuleViolationError('Need at least 2 players to start');
  }
  if ([...session.players.values()].some(player => !player.isConnected)) {
    throw new RuleViolationError('All lobby players must be connected');
  }

  // No lobby reservation timer may survive into an active match.
  cancelAllTimers(session.id);

  // Generate board
  session.board = generateBoard();

  // Randomize player order
  const playerIds = [...session.players.keys()];
  session.playerOrder = fisherYatesShuffle(playerIds);
  session.currentPlayerIndex = 0;

  // Initialize surprise deck
  session.surpriseDeck = initSurpriseDeck();
  session.surpriseDiscardPile = [];

  // Mark game started
  session.status = GameStatus.IN_PROGRESS;
  session.startedAt = Date.now();
  session.turnNumber = 1;
  session.roundNumber = 1;

  // Set initial phase
  StateMachine.forcePhase(session, TurnPhase.WAITING_FOR_ACTION);

  logger.info({ roomId: session.id, playerOrder: session.playerOrder }, 'Game started');
}

// ─── Cash mutation ────────────────────────────────────────────────────────────

/**
 * The single authoritative function for changing a player's cash.
 * Always emits CASH_UPDATED directed to the player only.
 *
 * @param delta Positive = gain, negative = loss.
 * @returns The player's new cash balance.
 */
export function cashChange(
  session: GameSession,
  playerId: PlayerId,
  delta: Money,
  reason: string,
  io: Server,
): Money {
  const player = requirePlayer(session, playerId);
  player.cash += delta;

  const payload: S2C_CashUpdated = {
    newBalance: player.cash,
    delta,
    reason,
  };
  emitToPlayer(io, playerId, 'CASH_UPDATED', payload);

  logger.debug({ roomId: session.id, playerId, delta, newBalance: player.cash, reason }, 'Cash changed');
  return player.cash;
}

/**
 * Send the authoritative prop-card hand to its owner only.
 * Call this after every successful server-side hand mutation.
 */
export function syncPropCards(session: GameSession, playerId: PlayerId, io: Server): void {
  const player = requirePlayer(session, playerId);
  const payload: S2C_PropCardsUpdated = {
    propCards: player.propCards.map(card => ({ ...card })),
  };
  emitToPlayer(io, playerId, 'PROP_CARDS_UPDATED', payload);
}

// ─── Player queries ───────────────────────────────────────────────────────────

export function requirePlayer(session: GameSession, playerId: PlayerId): Player {
  const p = session.players.get(playerId);
  if (!p) throw new NotFoundError('Player', playerId);
  return p;
}

export function getCurrentPlayer(session: GameSession): Player {
  const playerId = session.playerOrder[session.currentPlayerIndex];
  if (!playerId) throw new RuleViolationError('No current player (empty player order)');
  return requirePlayer(session, playerId);
}

export function getCurrentPlayerId(session: GameSession): PlayerId {
  const playerId = session.playerOrder[session.currentPlayerIndex];
  if (!playerId) throw new RuleViolationError('No current player');
  return playerId;
}

/** Active players = not bankrupt */
export function getActivePlayers(session: GameSession): Player[] {
  return session.playerOrder
    .map(id => session.players.get(id))
    .filter((p): p is Player => p !== undefined && p.status !== PlayerStatus.BANKRUPT);
}

/**
 * Advance to the next player's turn.
 * Skips bankrupt/disconnected players.
 * Updates turnNumber and roundNumber.
 */
export function advanceTurn(session: GameSession): void {
  const total = session.playerOrder.length;
  if (total === 0) return;

  const prevIndex = session.currentPlayerIndex;
  let next = (prevIndex + 1) % total;
  let looped = 0;

  // Skip bankrupt/disconnected players
  while (looped < total) {
    const pid = session.playerOrder[next];
    const p = pid ? session.players.get(pid) : undefined;
    if (p && p.status !== PlayerStatus.BANKRUPT && p.isConnected) break;
    next = (next + 1) % total;
    looped++;
  }

  if (next <= prevIndex) {
    // Completed a full round
    session.roundNumber++;
  }
  session.currentPlayerIndex = next;
  session.turnNumber++;
  session.lastDiceRoll = null;
  session.pendingExtraRoll = false;
  session.remoteDiceOverride = null;
  session.pendingTileEvent = null;
}

// ─── Victory check ────────────────────────────────────────────────────────────

/**
 * Returns the winner's PlayerId if only one active player remains, else null.
 */
export function checkVictory(session: GameSession): PlayerId | null {
  const active = getActivePlayers(session);
  if (active.length === 1) return active[0]!.id;
  return null;
}

// ─── Owned tiles helper ───────────────────────────────────────────────────────

/** Returns property TileIds that the player can manage during their turn. */
export function getConstructibleTileIds(session: GameSession, playerId: PlayerId): number[] {
  const owned: number[] = [];
  for (const tile of session.board) {
    if (tile.type === TileType.PROPERTY && tile.ownerId === playerId) {
      owned.push(tile.id);
    }
  }
  return owned;
}

/** Returns all ownable TileIds owned by the given player. */
export function getOwnedTileIds(session: GameSession, playerId: PlayerId): number[] {
  return session.board
    .filter((tile): tile is typeof tile & { ownerId: PlayerId | null } =>
      'ownerId' in tile && tile.ownerId === playerId,
    )
    .map(tile => tile.id);
}
