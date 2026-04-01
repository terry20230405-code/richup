import { randomInt } from 'crypto';
import type { DiceValue, DiceRoll } from '../types/Common.types';

/**
 * Cryptographically secure random integer in [min, max) (exclusive upper bound).
 * Uses Node.js crypto.randomInt — server-side only, never trust client RNG.
 */
export function secureRandomInt(min: number, max: number): number {
  return randomInt(min, max);
}

/**
 * Roll a single fair six-sided die using the secure RNG.
 */
export function rollDie(): DiceValue {
  return (secureRandomInt(1, 7)) as DiceValue;
}

/**
 * Roll two dice and return the result.
 */
export function rollDice(): DiceRoll {
  const die1 = rollDie();
  const die2 = rollDie();
  return {
    die1,
    die2,
    isDouble: die1 === die2,
    total: die1 + die2,
  };
}

/**
 * In-place Fisher-Yates shuffle using the secure RNG.
 * Returns the same array (mutated) for convenience.
 */
export function fisherYatesShuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = secureRandomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

/**
 * Weighted random pick.
 * weights must be non-negative integers and sum > 0.
 * Returns the index of the selected weight.
 *
 * Example: weightedRandom([50, 20, 30]) → 0 with 50% probability, etc.
 */
export function weightedRandom(weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let rand = secureRandomInt(0, total);
  for (let i = 0; i < weights.length; i++) {
    rand -= weights[i]!;
    if (rand < 0) return i;
  }
  return weights.length - 1; // Fallback (should not reach here)
}
