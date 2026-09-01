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
/**
 * Send a player to jail (teleport + set flags).
 * Does NOT emit PLAYER_MOVED — callers should use teleportPlayer for the move event.
 */
export declare function sendToJail(session: GameSession, playerId: PlayerId, io: Server): void;
/**
 * Player pays bail to leave jail immediately.
 * Deducts bail cost and clears jail flags.
 * Transitions to WAITING_FOR_ACTION so the player can still roll this turn.
 */
export declare function payBail(session: GameSession, playerId: PlayerId, io: Server): void;
/**
 * Player rolled for a double to escape jail.
 * - Success: release, player moves the rolled steps.
 * - Failure: increment jailTurnsWaited; auto-release if threshold reached.
 *
 * @returns Whether the player was released.
 */
export declare function resolveJailRoll(session: GameSession, playerId: PlayerId, isDouble: boolean, io: Server): boolean;
//# sourceMappingURL=JailManager.d.ts.map