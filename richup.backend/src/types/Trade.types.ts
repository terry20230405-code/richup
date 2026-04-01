import type { PlayerId, TileId, Money, Timestamp } from './Common.types';

export enum TradeStatus {
  PENDING   = 'PENDING',
  ACCEPTED  = 'ACCEPTED',
  REJECTED  = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  VOIDED    = 'VOIDED',    // Auto-cancelled by system (rolled dice, jail, bankrupt, etc.)
}

export enum TradeVoidReason {
  PLAYER_ROLLED        = 'PLAYER_ROLLED',
  PLAYER_JAILED        = 'PLAYER_JAILED',
  PLAYER_DYING         = 'PLAYER_DYING',      // Only outgoing trades from dying player
  PLAYER_BANKRUPT      = 'PLAYER_BANKRUPT',
  PLAYER_DISCONNECTED  = 'PLAYER_DISCONNECTED',
}

/**
 * What one side offers in a trade.
 * All three fields are optional but at least one must be non-empty.
 */
export interface TradeOffer {
  cash: Money;           // 0 = no cash offered; must not make offeror's cash go negative
  tileIds: TileId[];     // Must be unoccupied (buildingLevel == 0); can be mortgaged
  propCardIds: string[]; // Must be in offeror's hand
}

export interface Trade {
  id: string;
  proposerId: PlayerId;
  responderId: PlayerId;
  proposerOffer: TradeOffer;   // ⚠ PRIVATE — only sent to trade parties
  responderOffer: TradeOffer;  // ⚠ PRIVATE — only sent to trade parties
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
  // cash amounts: OMITTED from broadcast (sent directed to parties only)
  // propCardIds:  only the count/presence is hinted, types NOT revealed
  status: TradeStatus;
  proposedAt: Timestamp;
}
