import type { PlayerId, TileId, Money, Timestamp } from './Common.types';
import type { PropCard } from './PropCard.types';
export declare enum PlayerStatus {
    ACTIVE = "ACTIVE",
    DISCONNECTED = "DISCONNECTED",
    DYING = "DYING",// In DYING_RESCUE phase
    BANKRUPT = "BANKRUPT"
}
/**
 * Full server-side player record.
 * Fields marked ⚠PRIVATE must NEVER appear in any broadcast payload.
 */
export interface Player {
    id: PlayerId;
    nickname: string;
    avatarIndex: number;
    color: string;
    position: TileId;
    previousPosition: TileId;
    inJail: boolean;
    jailTurnsWaited: number;
    status: PlayerStatus;
    isConnected: boolean;
    lastSeenAt: Timestamp;
    cash: Money;
    propCards: PropCard[];
    /** Whether IMMUNITY card effect is active (next rent landing is free) */
    hasImmunity: boolean;
    /** Whether PRICE_HIKE card effect is active on this player's properties */
    priceHikeActive: boolean;
    /** Expiry turn number for price hike (checked at TURN_STARTED of owner) */
    priceHikeExpiresOnTurn: number | null;
    /** Computed by server; sent only to the player themselves via PlayerSelfView */
    constructibleTileIds: TileId[];
}
/**
 * What a player sees about themselves — sent via directed emit only (CASH_UPDATED, RECONNECT_SUCCESS).
 * Includes all private fields.
 */
export interface PlayerSelfView {
    id: PlayerId;
    nickname: string;
    avatarIndex: number;
    color: string;
    position: TileId;
    previousPosition: TileId;
    inJail: boolean;
    jailTurnsWaited: number;
    status: PlayerStatus;
    isConnected: boolean;
    cash: Money;
    propCards: PropCard[];
    hasImmunity: boolean;
    priceHikeActive: boolean;
    constructibleTileIds: TileId[];
}
/**
 * What other players can see about a given player — safe to broadcast.
 * ⚠ Absolutely no cash, no propCards, no hasImmunity, no priceHikeActive.
 */
export interface PlayerPublicView {
    id: PlayerId;
    nickname: string;
    avatarIndex: number;
    color: string;
    position: TileId;
    previousPosition: TileId;
    inJail: boolean;
    jailTurnsWaited: number;
    status: PlayerStatus;
    isConnected: boolean;
}
//# sourceMappingURL=Player.types.d.ts.map