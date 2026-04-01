/**
 * Dice engine.
 *
 * Tracks consecutive doubles for the current turn (rolled 3 doubles → go to jail).
 * The roll result is stored in session.lastDiceRoll.
 */
import type { Server } from 'socket.io';
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
export declare function resetDoublesTracker(roomId: string, playerId: PlayerId): void;
/** Roll dice for the current player. Emits DICE_ROLLED. Returns the result. */
export declare function performRoll(session: GameSession, playerId: PlayerId, io: Server): {
    die1: number;
    die2: number;
    isDouble: boolean;
    total: number;
    jailTriggered: boolean;
};
/**
 * Apply a Remote Dice card override.
 * Emits DICE_OVERRIDE broadcast.
 */
export declare function applyRemoteDice(session: GameSession, playerId: PlayerId, steps: 5 | 6 | 7, io: Server): void;
/** Roll a single die for jail double attempt. Returns the roll result. */
export declare function rollForJailDouble(session: GameSession, playerId: PlayerId, io: Server): {
    die1: number;
    die2: number;
    isDouble: boolean;
    total: number;
    jailTriggered: false;
};
/** How many consecutive doubles the current player has rolled this turn. */
export declare function getConsecutiveDoubles(roomId: string, playerId: PlayerId): number;
/** Position of the jail tile. */
export declare const JAIL_POSITION: number;
//# sourceMappingURL=DiceEngine.d.ts.map