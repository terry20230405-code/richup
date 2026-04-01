/**
 * Dual-track bankruptcy resolution.
 *
 * TYPE_A (tax / system debt / whale-fall):
 *   - All cash destroyed (removed from game)
 *   - All properties stripped of buildings, returned to unowned
 *   - Prop cards destroyed
 *
 * TYPE_B (rent owed to another player):
 *   - Pay creditor: min(all liquidatable assets, amountOwed)
 *   - Remaining cash DESTROYED (not given to creditor — inflation prevention)
 *   - All properties stripped and returned to unowned
 *   - Prop cards destroyed
 */
import type { Server } from 'socket.io';
import type { PlayerId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { BankruptcyType } from '../types/GameSession.types';
/**
 * Transition a player to DYING_RESCUE state.
 * Starts the rescue window timer and AFK warning timer.
 */
export declare function enterDyingRescue(session: GameSession, playerId: PlayerId, bankruptcyType: BankruptcyType, creditorId: PlayerId | null, amountOwed: Money, io: Server): void;
/** Call this whenever the dying player takes a valid action in DYING_RESCUE. */
export declare function refreshDyingRescueActivity(session: GameSession, playerId: PlayerId): void;
export declare function declareBankruptcy(session: GameSession, playerId: PlayerId, io: Server): void;
export declare function triggerWhaleFall(session: GameSession, playerId: PlayerId, reason: 'DISCONNECT_TIMEOUT' | 'AFK_IN_RESCUE', io: Server): void;
//# sourceMappingURL=BankruptcyResolver.d.ts.map