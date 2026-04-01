import type { PlayerId, TileId, Money, Timestamp } from './Common.types';

export enum AuctionStatus {
  OPEN      = 'OPEN',
  RESOLVED  = 'RESOLVED',  // Hammer down
  NO_SALE   = 'NO_SALE',   // All players passed
  CANCELLED = 'CANCELLED', // e.g. host whale-fall mid-auction
}

export interface AuctionBidRecord {
  bidderId: PlayerId;
  amount: Money;
  placedAt: Timestamp;
}

/**
 * Full auction session record (server-only).
 * The lockedBid mechanism prevents the current leader from spending their committed funds.
 */
export interface AuctionSession {
  id: string;
  tileId: TileId;

  currentBid: Money;               // Starts at 0
  currentLeaderId: PlayerId | null;
  lockedBid: Money;                // = currentBid; frozen in leader's account

  activePlayerIds: PlayerId[];     // Still in the auction (not passed)
  passedPlayerIds: PlayerId[];

  bidHistory: AuctionBidRecord[];  // Full history (server internal)

  status: AuctionStatus;
  winnerId: PlayerId | null;
  finalPrice: Money | null;

  roundDeadlineAt: Timestamp;      // Timer per round; null if no timer configured
  startedAt: Timestamp;
  resolvedAt: Timestamp | null;
}

/**
 * Public view of an auction — safe to broadcast.
 * Does NOT include bid history details that would reveal financial strategy.
 */
export interface AuctionPublicView {
  id: string;
  tileId: TileId;
  currentBid: Money;
  currentLeaderId: PlayerId | null;
  activePlayerIds: PlayerId[];
  passedPlayerIds: PlayerId[];
  status: AuctionStatus;
  winnerId: PlayerId | null;
  finalPrice: Money | null;
  roundDeadlineAt: Timestamp;
  // lockedBid: OMITTED (internal mechanism)
  // bidHistory: OMITTED (don't leak bid timing patterns)
}
