import type { Timestamp } from './Common.types';

/**
 * The six property card types defined in the PRD.
 * Card hand contents are server-private; only the *type* is revealed when used.
 */
export enum PropCardType {
  FORCED_TRADE  = 'FORCED_TRADE',   // Buy another player's undeveloped property at list price.
  REMOTE_DICE   = 'REMOTE_DICE',    // Choose a movement distance of 5, 6, or 7 spaces.
  PLUNDER       = 'PLUNDER',        // Take 50% of the target player's cash.
  IMMUNITY      = 'IMMUNITY',       // Avoid the next rent payment to another player.
  AUDIT         = 'AUDIT',          // Privately inspect every player's current cash.
  PRICE_HIKE    = 'PRICE_HIKE',     // Raise rent on owned properties by 1.5x until the next turn.
}

export interface PropCard {
  id: string;           // UUID
  type: PropCardType;
  acquiredAt: Timestamp;
}
