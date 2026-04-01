/**
 * Casino bet resolution.
 *
 * Probability tiers are defined in GameConfig.CASINO_TIERS.
 * Bet must be a positive multiple of casinoBetMultiple (default 50).
 */
import type { Server } from 'socket.io';
import type { PlayerId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
/**
 * Process a casino bet for the landing player.
 * Emits CASINO_RESULT to all players.
 */
export declare function handleCasinoBet(session: GameSession, playerId: PlayerId, betAmount: Money, io: Server): void;
//# sourceMappingURL=CasinoManager.d.ts.map