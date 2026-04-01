/**
 * Jail management.
 *
 * Handles:
 *  - Sending a player to jail (doubles overflow, Go-To-Jail tile)
 *  - Jail decision resolution: pay bail, roll for double
 *  - Auto-release after jailAutoReleaseAfterTurns full waited turns
 */

import type { Server } from 'socket.io';
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import type { S2C_JailAutoReleased } from '../types/Events.types';
import { BOARD_CONFIG } from '../config/GameConfig';
import { requirePlayer, cashChange } from '../state/GameSession';
import { teleportPlayer } from './MovementEngine';
import { StateMachine } from '../state/StateMachine';
import { TurnPhase } from '../types/GameSession.types';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { InsufficientFundsError, RuleViolationError } from '../utils/errors';
import { logger } from '../utils/logger';

const JAIL_POSITION = BOARD_CONFIG.FIXED_ANCHORS.JAIL;

// ─── Send to jail ─────────────────────────────────────────────────────────────

/**
 * Send a player to jail (teleport + set flags).
 * Does NOT emit PLAYER_MOVED — callers should use teleportPlayer for the move event.
 */
export function sendToJail(session: GameSession, playerId: PlayerId, io: Server): void {
  const player = requirePlayer(session, playerId);

  teleportPlayer(session, playerId, JAIL_POSITION, io);
  player.inJail = true;
  player.jailTurnsWaited = 0;

  logger.info({ roomId: session.id, playerId }, 'Player sent to jail');
}

// ─── Pay bail ─────────────────────────────────────────────────────────────────

/**
 * Player pays bail to leave jail immediately.
 * Deducts bail cost and clears jail flags.
 * Transitions to ROLLING_DICE so the player can still move this turn.
 */
export function payBail(session: GameSession, playerId: PlayerId, io: Server): void {
  const player = requirePlayer(session, playerId);

  if (!player.inJail) throw new RuleViolationError('Player is not in jail');

  const bailCost = session.config.bailCost;
  if (player.cash < bailCost) {
    throw new InsufficientFundsError(playerId, bailCost, player.cash);
  }

  cashChange(session, playerId, -bailCost, 'BAIL_PAID', io);
  releaseFromJail(player);

  StateMachine.transition(session, TurnPhase.ROLLING_DICE);
  logger.info({ roomId: session.id, playerId }, 'Player paid bail');
}

// ─── Roll for double in jail ──────────────────────────────────────────────────

/**
 * Player rolled for a double to escape jail.
 * - Success: release, player moves the rolled steps.
 * - Failure: increment jailTurnsWaited; auto-release if threshold reached.
 *
 * @returns Whether the player was released.
 */
export function resolveJailRoll(
  session: GameSession,
  playerId: PlayerId,
  isDouble: boolean,
  io: Server,
): boolean {
  const player = requirePlayer(session, playerId);

  if (!player.inJail) throw new RuleViolationError('Player is not in jail');

  if (isDouble) {
    releaseFromJail(player);
    logger.info({ roomId: session.id, playerId }, 'Jail escape: rolled double');
    return true;
  }

  // Failed: increment wait counter
  player.jailTurnsWaited++;

  // Auto-release check
  if (player.jailTurnsWaited >= session.config.jailAutoReleaseAfterTurns) {
    releaseFromJail(player);
    const payload: S2C_JailAutoReleased = { playerId };
    broadcastToRoom(io, session.id, 'JAIL_AUTO_RELEASED', payload);
    logger.info({ roomId: session.id, playerId }, 'Jail auto-released');
    return true;
  }

  logger.debug(
    { roomId: session.id, playerId, jailTurnsWaited: player.jailTurnsWaited },
    'Jail roll failed',
  );
  return false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function releaseFromJail(player: ReturnType<typeof requirePlayer>): void {
  player.inJail = false;
  player.jailTurnsWaited = 0;
}
