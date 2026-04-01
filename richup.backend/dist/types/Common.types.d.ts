/**
 * Common primitive types used across the entire game server.
 * All game monetary values use integer units (no decimals).
 */
export type PlayerId = string;
export type RoomId = string;
export type TileId = number;
export type Money = number;
export type Timestamp = number;
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
export declare const BANK_ID: "BANK";
export type BankId = typeof BANK_ID;
export type PlayerOrBank = PlayerId | BankId;
//# sourceMappingURL=Common.types.d.ts.map