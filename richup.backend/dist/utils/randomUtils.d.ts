import type { DiceValue, DiceRoll } from '../types/Common.types';
/**
 * Cryptographically secure random integer in [min, max) (exclusive upper bound).
 * Uses Node.js crypto.randomInt — server-side only, never trust client RNG.
 */
export declare function secureRandomInt(min: number, max: number): number;
/**
 * Roll a single fair six-sided die using the secure RNG.
 */
export declare function rollDie(): DiceValue;
/**
 * Roll two dice and return the result.
 */
export declare function rollDice(): DiceRoll;
/**
 * In-place Fisher-Yates shuffle using the secure RNG.
 * Returns the same array (mutated) for convenience.
 */
export declare function fisherYatesShuffle<T>(arr: T[]): T[];
/**
 * Weighted random pick.
 * weights must be non-negative integers and sum > 0.
 * Returns the index of the selected weight.
 *
 * Example: weightedRandom([50, 20, 30]) → 0 with 50% probability, etc.
 */
export declare function weightedRandom(weights: number[]): number;
//# sourceMappingURL=randomUtils.d.ts.map