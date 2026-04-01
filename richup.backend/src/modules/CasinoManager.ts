/**
 * Casino bet resolution.
 *
 * Probability tiers are defined in GameConfig.CASINO_TIERS.
 * Bet must be a positive multiple of casinoBetMultiple (default 50).
 */

import type { Server } from 'socket.io';
import type { PlayerId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import type { CasinoOutcome } from '../types/Common.types';
import type { S2C_CasinoResult } from '../types/Events.types';
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
  betAmount: Money,
  io: Server,
): void {
  const player = requirePlayer(session, playerId);
  const { casinoBetMultiple } = session.config;

  // Validate bet
  if (betAmount <= 0 || betAmount % casinoBetMultiple !== 0) {
    throw new RuleViolationError(
      `Bet must be a positive multiple of ${casinoBetMultiple}`,
    );
  }
  if (player.cash < betAmount) {
    throw new InsufficientFundsError(playerId, betAmount, player.cash);
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
      // 假设你在 GameConfig 的 CASINO_TIERS 里加了 winMultiplier 字段
      // 如果没配，兜底默认给 2 倍（即纯赚 1 倍本金）
      const multiplier = tier.winMultiplier ?? 2; 
      
      // 纯利润 = 本金 × (总赔率 - 1)
      // 比如赔率是 3，下注 100，纯赚 100 * (3 - 1) = 200
      cashDelta = Math.floor(betAmount * (multiplier - 1)); 
      break;
    case 'LOSE':
      cashDelta = -betAmount;  // Lose: 净亏掉所有本金
      break;
    case 'BREAK_EVEN':
    default:
      cashDelta = 0;           // Break even: 没赚没亏，资金不变
      break;
  }

  // Apply cash change
  if (cashDelta !== 0) {
    cashChange(session, playerId, cashDelta, `CASINO_${outcome}`, io);
  }

  const payload: S2C_CasinoResult = {
    playerId,
    betAmount,
    outcome,
    cashDelta,
  };
  broadcastToRoom(io, session.id, 'CASINO_RESULT', payload);

  logger.debug(
    { roomId: session.id, playerId, betAmount, outcome, cashDelta },
    'Casino result',
  );
}
