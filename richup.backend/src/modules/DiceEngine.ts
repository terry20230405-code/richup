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
import { BOARD_CONFIG } from '../config/GameConfig';
import { rollDice } from '../utils/randomUtils';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { logger } from '../utils/logger';

const MAX_CONSECUTIVE_DOUBLES = 3;

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
  session.lastDiceRoll = { die1: steps, die2: 0, isDouble: false, total: steps };
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
  return { ...result, total: result.total, jailTriggered: false };
}

/** How many consecutive doubles the current player has rolled this turn. */
export function getConsecutiveDoubles(roomId: string, playerId: PlayerId): number {
  return doublesTracker.get(doublesKey(roomId, playerId)) ?? 0;
}

/** Position of the jail tile. */
export const JAIL_POSITION = BOARD_CONFIG.FIXED_ANCHORS.JAIL;
