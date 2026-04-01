"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureRandomInt = secureRandomInt;
exports.rollDie = rollDie;
exports.rollDice = rollDice;
exports.fisherYatesShuffle = fisherYatesShuffle;
exports.weightedRandom = weightedRandom;
const crypto_1 = require("crypto");
/**
 * Cryptographically secure random integer in [min, max) (exclusive upper bound).
 * Uses Node.js crypto.randomInt — server-side only, never trust client RNG.
 */
function secureRandomInt(min, max) {
    return (0, crypto_1.randomInt)(min, max);
}
/**
 * Roll a single fair six-sided die using the secure RNG.
 */
function rollDie() {
    return (secureRandomInt(1, 7));
}
/**
 * Roll two dice and return the result.
 */
function rollDice() {
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
function fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = secureRandomInt(0, i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
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
function weightedRandom(weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let rand = secureRandomInt(0, total);
    for (let i = 0; i < weights.length; i++) {
        rand -= weights[i];
        if (rand < 0)
            return i;
    }
    return weights.length - 1; // Fallback (should not reach here)
}
//# sourceMappingURL=randomUtils.js.map