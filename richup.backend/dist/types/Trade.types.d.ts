import type { PlayerId, TileId, Money, Timestamp } from './Common.types';
export declare enum TradeStatus {
    PENDING = "PENDING",
    ACCEPTED = "ACCEPTED",
    REJECTED = "REJECTED",
    CANCELLED = "CANCELLED",
    COMPLETED = "COMPLETED",
    VOIDED = "VOIDED"
}
export declare enum TradeVoidReason {
    PLAYER_ROLLED = "PLAYER_ROLLED",
    PLAYER_JAILED = "PLAYER_JAILED",
    PLAYER_DYING = "PLAYER_DYING",
    PLAYER_BANKRUPT = "PLAYER_BANKRUPT",
    PLAYER_DISCONNECTED = "PLAYER_DISCONNECTED",
    GAME_ENDED = "GAME_ENDED"
}
/**
 * What one side offers in a trade.
 * All three fields are optional but at least one must be non-empty.
 */
export interface TradeOffer {
    cash: Money;
    tileIds: TileId[];
    propCardIds: string[];
}
export interface Trade {
    id: string;
    proposerId: PlayerId;
    responderId: PlayerId;
    proposerOffer: TradeOffer;
    responderOffer: TradeOffer;
    status: TradeStatus;
    voidReason: TradeVoidReason | null;
    proposedAt: Timestamp;
    resolvedAt: Timestamp | null;
}
/**
 * Broadcast-safe view of a trade.
 * Cash amounts are omitted; only tile and card references shown.
 * Full offer details (including cash) are sent via TRADE_DETAIL directed emit to both parties.
 */
export interface TradePublicView {
    tradeId: string;
    proposerId: PlayerId;
    responderId: PlayerId;
    proposerTileIds: TileId[];
    responderTileIds: TileId[];
    status: TradeStatus;
    proposedAt: Timestamp;
}
//# sourceMappingURL=Trade.types.d.ts.map