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
    startingCash: 15000, // Each player's starting cash (placeholder)
    // ── GO / Start tile ────────────────────────────────────────────────────────
    goSalary: 300, // Bonus for passing GO (placeholder)
    goLandBonus: 150, // Extra bonus for landing exactly on GO (placeholder)
    // ── Jail ──────────────────────────────────────────────────────────────────
    bailCost: 80, // Cost to pay bail immediately (placeholder)
    jailAutoReleaseAfterTurns: 2, // Auto-release after 2 full waited turns (per PRD)
    // ── Property / building ────────────────────────────────────────────────────
    mortgageInterestRate: 0.1, // Redemption = mortgageValue × 1.1 (placeholder)
    buildingRefundRate: 0.75, // Sell back at 75% of build cost (per PRD)
    // ── Auction ───────────────────────────────────────────────────────────────
    auctionRoundMs: 30_000, // 30 seconds per round (placeholder)
    startingBid: 0, // Always 0 per PRD
    // ── Dying rescue ──────────────────────────────────────────────────────────
    dyingRescueTotalMs: 8 * 60 * 1_000, // 8 minutes total
    dyingRescueAfkWarningMs: (8 - 2) * 60 * 1_000, // Warn with 2 minutes remaining
    dyingRescueAfkKickMs: 8 * 60 * 1_000, // Kick at 8 minutes
    // ── Disconnect / reconnect ────────────────────────────────────────────────
    lobbyReconnectWindowMs: 90 * 1_000, // 90 seconds to reclaim a lobby seat
    reconnectWindowMs: 3 * 60 * 1_000, // 3 minutes to reconnect during a match
    // ── Casino ────────────────────────────────────────────────────────────────
    casinoBetMultiple: 50, // Bets must be multiples of 50 (per PRD)
    // ── Temple ────────────────────────────────────────────────────────────────
    templeLitThreshold: 3, // 3 prayers to light up (per PRD)
    templePrayFee: 300, // Cost per prayer (placeholder)
    templePassThruToll: 50, // Toll paid by a non-owner (placeholder)
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
    // Early-game tiers ($50-$1000).
    // 1. Very low win chance (20%) with a 5x payout.
    { minBet: 50, maxBet: 100, loseWeight: 65, breakEvenWeight: 15, winWeight: 20, winMultiplier: 5.0 },
    // 2. A 25% win chance with a 4x payout.
    { minBet: 150, maxBet: 250, loseWeight: 60, breakEvenWeight: 15, winWeight: 25, winMultiplier: 4.0 },
    // 3. A 30% win chance with a 3x payout.
    { minBet: 300, maxBet: 450, loseWeight: 50, breakEvenWeight: 20, winWeight: 30, winMultiplier: 3.0 },
    // 4. A 35% win chance with a 2.5x payout.
    { minBet: 500, maxBet: 700, loseWeight: 45, breakEvenWeight: 20, winWeight: 35, winMultiplier: 2.5 },
    // 5. A 40% win chance with a 2x payout.
    { minBet: 750, maxBet: 1000, loseWeight: 40, breakEvenWeight: 20, winWeight: 40, winMultiplier: 2.0 },
    // Mid-to-late-game high-stakes tiers ($1050 and above).
    // 6. A 50% win chance with a 1.5x payout.
    { minBet: 1050, maxBet: 2000, loseWeight: 30, breakEvenWeight: 20, winWeight: 50, winMultiplier: 1.5 },
    // 7. A 60% win chance with a 1.3x payout.
    { minBet: 2050, maxBet: 5000, loseWeight: 20, breakEvenWeight: 20, winWeight: 60, winMultiplier: 1.3 },
    // 8. A 75% win chance with a 1.2x payout.
    { minBet: 5050, maxBet: 10000, loseWeight: 10, breakEvenWeight: 15, winWeight: 75, winMultiplier: 1.2 },
    // 9. A 90% win chance with a 1.1x payout to limit inflation.
    { minBet: 10050, maxBet: Infinity, loseWeight: 5, breakEvenWeight: 5, winWeight: 90, winMultiplier: 1.1 },
]);
//# sourceMappingURL=GameConfig.js.map