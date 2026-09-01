/**
 * Casino bet resolution.
 *
 * Probability tiers are defined in GameConfig.CASINO_TIERS.
 * Bet must be a positive multiple of casinoBetMultiple (default 50).
 */

import type { Server } from 'socket.io';
import type { PlayerId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { TileType } from '../types/Tile.types';
import type { CasinoOutcome } from '../types/Common.types';
import type { S2C_CasinoResult } from '../types/Events.types';
import { TurnPhase } from '../types/GameSession.types';
import { CASINO_TIERS } from '../config/GameConfig';
import { requirePlayer, cashChange } from '../state/GameSession';
import { weightedRandom } from '../utils/randomUtils';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { InsufficientFundsError, RuleViolationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Process a casino bet for the landing player.
 * Emits CASINO_RESULT to all players.
 */
export function handleCasinoBet(
  session: GameSession,
  playerId: PlayerId,
  tileId: number,
  betAmount: Money,
  io: Server,
): void {
  const player = requirePlayer(session, playerId);
  const { casinoBetMultiple } = session.config;
  const tile = session.board[tileId];

  if (!tile || tile.type !== TileType.CASINO) {
    throw new RuleViolationError('The current tile is not a casino');
  }

  // Validate bet
  if (betAmount <= 0 || betAmount % casinoBetMultiple !== 0) {
    throw new RuleViolationError(
      `Bet must be a positive multiple of ${casinoBetMultiple}`,
    );
  }
  if (player.cash < betAmount) {
    throw new InsufficientFundsError(playerId, betAmount, player.cash);
  }
  if (betAmount > tile.maxBet) {
    throw new RuleViolationError(`Bet cannot exceed the casino maximum of ${tile.maxBet}`);
  }

  // Select probability tier
  const tier = CASINO_TIERS.find(t => betAmount >= t.minBet && betAmount <= t.maxBet)
    ?? CASINO_TIERS[CASINO_TIERS.length - 1]!;

  const outcomeIndex = weightedRandom([
    tier.loseWeight,
    tier.breakEvenWeight,
    tier.winWeight,
  ]);

  const OUTCOME_MAP: CasinoOutcome[] = ['LOSE', 'BREAK_EVEN', 'WIN'];
  const outcome = OUTCOME_MAP[outcomeIndex] ?? 'LOSE';

  let cashDelta: Money;
  switch (outcome) {
    case 'WIN':
      // Use the tier multiplier from GameConfig, with a 2x fallback.
      // A 2x payout returns the stake plus an equal amount of profit.
      const multiplier = tier.winMultiplier ?? 2; 
      
      // Net profit = stake x (total multiplier - 1).
      // For example, a $100 stake at 3x produces $200 net profit.
      cashDelta = Math.floor(betAmount * (multiplier - 1)); 
      break;
    case 'LOSE':
      cashDelta = -betAmount;  // Lose the full stake.
      break;
    case 'BREAK_EVEN':
    default:
      cashDelta = 0;           // Break even with no balance change.
      break;
  }

  // Apply cash change
  if (cashDelta !== 0) {
    cashChange(session, playerId, cashDelta, `CASINO_${outcome}`, io);
  }

  const phase = session.pendingExtraRoll ? TurnPhase.WAITING_FOR_ACTION : TurnPhase.END_TURN_PENDING;
  const payload: S2C_CasinoResult = {
    playerId,
    betAmount,
    outcome,
    cashDelta,
    phase,
    availableActions: session.pendingExtraRoll ? ['ROLL_DICE'] : ['END_TURN'],
  };
  broadcastToRoom(io, session.id, 'CASINO_RESULT', payload);

  logger.debug(
    { roomId: session.id, playerId, betAmount, outcome, cashDelta },
    'Casino result',
  );
}
