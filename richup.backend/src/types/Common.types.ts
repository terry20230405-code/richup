/**
 * Common primitive types used across the entire game server.
 * All game monetary values use integer units (no decimals).
 */

export type PlayerId = string;   // UUID or socket.id
export type RoomId   = string;
export type TileId   = number;   // 0-55, index into the board array
export type Money    = number;   // Integer; negative values indicate debt
export type Timestamp = number;  // Date.now() ms epoch

export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface DiceRoll {
  die1: DiceValue;
  die2: DiceValue;
  isDouble: boolean;
  total: number;
}

/** Possible outcomes from the casino event */
export type CasinoOutcome = 'WIN' | 'LOSE' | 'BREAK_EVEN';

/** Canonical "bank" identifier used where rent redirects to system */
export const BANK_ID = 'BANK' as const;
export type BankId = typeof BANK_ID;

export type PlayerOrBank = PlayerId | BankId;
