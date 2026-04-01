"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CASINO_TIERS = exports.BOARD_CONFIG = exports.DEFAULT_GAME_CONFIG = void 0;
/**
 * Default game configuration.
 * All values are placeholders — adjust during balancing (Phase 2 of PRD).
 *
 * ⚠ Do NOT hardcode these values anywhere else in the codebase.
 *   Always read from the GameSession's config field.
 */
exports.DEFAULT_GAME_CONFIG = Object.freeze({
    // ── Starting resources ─────────────────────────────────────────────────────
    startingCash: 15_000, // Each player's starting cash (placeholder)
    // ── GO / Start tile ────────────────────────────────────────────────────────
    goSalary: 2_000, // Bonus for passing GO (placeholder)
    goLandBonus: 2_000, // Extra bonus for landing exactly on GO (placeholder)
    // ── Jail ──────────────────────────────────────────────────────────────────
    bailCost: 500, // Cost to pay bail immediately (placeholder)
    jailAutoReleaseAfterTurns: 2, // Auto-release after 2 full waited turns (per PRD)
    // ── Property / building ────────────────────────────────────────────────────
    mortgageInterestRate: 0.1, // Redemption = mortgageValue × 1.1 (placeholder)
    buildingRefundRate: 0.75, // Sell back at 75% of build cost (per PRD)
    // ── Auction ───────────────────────────────────────────────────────────────
    auctionRoundMs: 30_000, // 30 seconds per round (placeholder)
    startingBid: 0, // Always 0 per PRD
    // ── Dying rescue ──────────────────────────────────────────────────────────
    dyingRescueTotalMs: 10 * 60 * 1_000, // 10 minutes total (per PRD)
    dyingRescueAfkWarningMs: (10 - 2) * 60 * 1_000, // Warn 2 minutes before kick
    dyingRescueAfkKickMs: 10 * 60 * 1_000, // Kick at 10 minutes
    // ── Disconnect / reconnect ────────────────────────────────────────────────
    reconnectWindowMs: 5 * 60 * 1_000, // 5 minutes reconnect window (per PRD)
    // ── Casino ────────────────────────────────────────────────────────────────
    casinoBetMultiple: 50, // Bets must be multiples of 50 (per PRD)
    // ── Temple ────────────────────────────────────────────────────────────────
    templeLitThreshold: 3, // 3 prayers to light up (per PRD)
    templePrayFee: 500, // Cost per prayer (placeholder)
    // ── Prop cards ────────────────────────────────────────────────────────────
    priceHikeMultiplier: 1.5, // Rent multiplier while price hike is active (per PRD)
});
/**
 * Board constants — board geometry that never changes during a game.
 */
exports.BOARD_CONFIG = Object.freeze({
    TOTAL_TILES: 56,
    GO_TILE_ID: 0,
    JAIL_TILE_ID: 28,
    // Fixed anchor positions (per PRD)
    FIXED_ANCHORS: {
        GO: 0,
        AIRPORT_NORTH: 7,
        TEMPLE_A: 14,
        CASINO_B: 18,
        AIRPORT_EAST: 21,
        JAIL: 28,
        AIRPORT_SOUTH: 35,
        TEMPLE_B: 42,
        CASINO_A: 46,
        AIRPORT_WEST: 49,
    },
    // Random pool counts (per PRD: 28 properties + 9 surprise + 9 tax = 46)
    RANDOM_POOL: {
        PROPERTY_COUNT: 28,
        SURPRISE_COUNT: 9,
        TAX_COUNT: 9,
    },
});
/**
 * Casino probability tiers (per PRD).
 * Probabilities are weights: [lose, break-even, win].
 * Tier selection is based on bet amount ranges.
 */
exports.CASINO_TIERS = Object.freeze([
    { minBet: 50, maxBet: 500, loseWeight: 50, breakEvenWeight: 20, winWeight: 30 },
    { minBet: 510, maxBet: 2000, loseWeight: 40, breakEvenWeight: 20, winWeight: 40 },
    { minBet: 2010, maxBet: 5000, loseWeight: 30, breakEvenWeight: 15, winWeight: 55 },
    { minBet: 5001, maxBet: Infinity, loseWeight: 20, breakEvenWeight: 10, winWeight: 70 },
]);
//# sourceMappingURL=GameConfig.js.map