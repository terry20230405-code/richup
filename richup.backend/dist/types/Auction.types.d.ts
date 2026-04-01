import type { PlayerId, TileId, Money, Timestamp } from './Common.types';
export declare enum AuctionStatus {
    OPEN = "OPEN",
    RESOLVED = "RESOLVED",// Hammer down
    NO_SALE = "NO_SALE",// All players passed
    CANCELLED = "CANCELLED"
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
    currentBid: Money;
    currentLeaderId: PlayerId | null;
    lockedBid: Money;
    activePlayerIds: PlayerId[];
    passedPlayerIds: PlayerId[];
    bidHistory: AuctionBidRecord[];
    status: AuctionStatus;
    winnerId: PlayerId | null;
    finalPrice: Money | null;
    roundDeadlineAt: Timestamp;
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
}
//# sourceMappingURL=Auction.types.d.ts.map