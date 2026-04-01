import type { PlayerId, TileId, Money, Timestamp } from './Common.types';
import type { PropCard } from './PropCard.types';

export enum PlayerStatus {
  ACTIVE       = 'ACTIVE',
  DISCONNECTED = 'DISCONNECTED',
  DYING        = 'DYING',        // In DYING_RESCUE phase
  BANKRUPT     = 'BANKRUPT',
}

/**
 * Full server-side player record.
 * Fields marked ⚠PRIVATE must NEVER appear in any broadcast payload.
 */
export interface Player {
  // ─── Public fields (appear in PlayerPublicView) ───────────────────────────
  id: PlayerId;
  nickname: string;
  avatarIndex: number;
  color: string;              // Hex token color, e.g. "#FF5733"
  position: TileId;
  previousPosition: TileId;
  inJail: boolean;
  jailTurnsWaited: number;    // 0 when not in jail; increments each END_TURN while jailed
  status: PlayerStatus;
  isConnected: boolean;
  lastSeenAt: Timestamp;

  // ─── Private fields (⚠PRIVATE — never broadcast to other players) ─────────
  cash: Money;                // ⚠PRIVATE
  propCards: PropCard[];      // ⚠PRIVATE — type, count, and contents all hidden

  // ─── Derived / computed private state ────────────────────────────────────
  /** Whether IMMUNITY card effect is active (next rent landing is free) */
  hasImmunity: boolean;       // ⚠PRIVATE — revealed only via IMMUNITY_USED event
  /** Whether PRICE_HIKE card effect is active on this player's properties */
  priceHikeActive: boolean;   // ⚠PRIVATE — revealed via PROP_CARD_USED then PRICE_HIKE_EXPIRED
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
  // cash:             OMITTED ⚠
  // propCards:        OMITTED ⚠
  // propCardCount:    OMITTED ⚠ (even count is secret per PRD)
  // hasImmunity:      OMITTED ⚠
  // priceHikeActive:  OMITTED ⚠
}
