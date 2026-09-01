/**
 * Dice engine.
 *
 * Tracks consecutive doubles for the current turn (rolled 3 doubles → go to jail).
 * The roll result is stored in session.lastDiceRoll.
 */

import type { Server } from 'socket.io';
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import type { S2C_DiceRolled, S2C_DiceOverride } from '../types/Events.types';
import { rollDice } from '../utils/randomUtils';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { logger } from '../utils/logger';
import { voidTradesInvolvingPlayer } from './TradeLifecycle';
import { TradeVoidReason } from '../types/Trade.types';

const MAX_CONSECUTIVE_DOUBLES = 3;
const REMOTE_DICE_PAIRS: Record<5 | 6 | 7, [1 | 2 | 3 | 4 | 5 | 6, 1 | 2 | 3 | 4 | 5 | 6]> = {
  5: [2, 3],
  6: [1, 5],
  7: [3, 4],
};

/** Track consecutive doubles per player per turn. Cleared on END_TURN. */
const doublesTracker = new Map<string, number>(); // key: `${roomId}:${playerId}`

function doublesKey(roomId: string, playerId: PlayerId): string {
  return `${roomId}:${playerId}`;
}

export function resetDoublesTracker(roomId: string, playerId: PlayerId): void {
  doublesTracker.delete(doublesKey(roomId, playerId));
}

/** Roll dice for the current player. Emits DICE_ROLLED. Returns the result. */
export function performRoll(
  session: GameSession,
  playerId: PlayerId,
  io: Server,
): { die1: number; die2: number; isDouble: boolean; total: number; jailTriggered: boolean } {
  const override = session.remoteDiceOverride?.playerId === playerId
    ? session.remoteDiceOverride
    : null;
  session.remoteDiceOverride = null;

  const result = override
    ? { die1: REMOTE_DICE_PAIRS[override.steps][0], die2: REMOTE_DICE_PAIRS[override.steps][1], isDouble: false, total: override.steps }
    : rollDice();
  session.lastDiceRoll = result;

  const payload: S2C_DiceRolled = {
    playerId,
    die1: result.die1,
    die2: result.die2,
    isDouble: result.isDouble,
    totalSteps: result.total,
  };
  broadcastToRoom(io, session.id, 'DICE_ROLLED', payload);
  voidTradesInvolvingPlayer(session, playerId, TradeVoidReason.PLAYER_ROLLED, io);
  logger.debug({ roomId: session.id, playerId, ...result }, 'Dice rolled');

  // Track doubles
  const key = doublesKey(session.id, playerId);
  const consecutiveDoubles = (doublesTracker.get(key) ?? 0) + (result.isDouble ? 1 : 0);

  if (result.isDouble) {
    doublesTracker.set(key, consecutiveDoubles);
  } else {
    doublesTracker.delete(key);
  }

  const jailTriggered = consecutiveDoubles >= MAX_CONSECUTIVE_DOUBLES;
  if (jailTriggered) {
    doublesTracker.delete(key);
  }

  return { ...result, total: result.total, jailTriggered };
}

/**
 * Apply a Remote Dice card override.
 * Emits DICE_OVERRIDE broadcast.
 */
export function applyRemoteDice(
  session: GameSession,
  playerId: PlayerId,
  steps: 5 | 6 | 7,
  io: Server,
): void {
  session.remoteDiceOverride = { playerId, steps };
  const payload: S2C_DiceOverride = { playerId, steps, source: 'REMOTE_DICE' };
  broadcastToRoom(io, session.id, 'DICE_OVERRIDE', payload);
}

/** Roll a single die for jail double attempt. Returns the roll result. */
export function rollForJailDouble(
  session: GameSession,
  playerId: PlayerId,
  io: Server,
): { die1: number; die2: number; isDouble: boolean; total: number; jailTriggered: false } {
  const result = rollDice();
  session.lastDiceRoll = result;

  const payload: S2C_DiceRolled = {
    playerId,
    die1: result.die1,
    die2: result.die2,
    isDouble: result.isDouble,
    totalSteps: result.total,
  };
  broadcastToRoom(io, session.id, 'DICE_ROLLED', payload);
  voidTradesInvolvingPlayer(session, playerId, TradeVoidReason.PLAYER_ROLLED, io);
  return { ...result, total: result.total, jailTriggered: false };
}
