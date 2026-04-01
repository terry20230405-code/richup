/**
 * Auction system — full lifecycle.
 *
 * Rules (per PRD):
 *  - 0-yuan starting bid, no minimum increment
 *  - Timer resets on each new bid (auctionRoundMs)
 *  - lockedBid: current leader's bid is frozen — blocks other cash operations
 *  - Pass → permanently exit this auction
 *  - When 1 active player remains → immediate hammer down (even at 0)
 *  - All active players pass → no sale
 */
import type { Server } from 'socket.io';
import type { PlayerId, Money, TileId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
/**
 * Begin an auction for the given tile.
 * All non-bankrupt players are active participants.
 */
export declare function startAuction(session: GameSession, tileId: TileId, io: Server): void;
export declare function placeBid(session: GameSession, bidderId: PlayerId, amount: Money, io: Server): void;
export declare function passAuction(session: GameSession, bidderId: PlayerId, io: Server): void;
/** Called by the round timer OR when only 1 active player remains. */
export declare function resolveAuction(session: GameSession, io: Server): void;
/**
 * Throws BidLockedError if the player has a locked bid that would be
 * insufficient after the requested cash deduction.
 */
export declare function assertNotBidLocked(session: GameSession, playerId: PlayerId, amountToSpend: Money): void;
//# sourceMappingURL=AuctionManager.d.ts.map