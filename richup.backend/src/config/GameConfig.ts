import type { GameConfig } from '../types/GameSession.types';

/**
 * Default game configuration.
 * All values are placeholders — adjust during balancing (Phase 2 of PRD).
 *
 * ⚠ Do NOT hardcode these values anywhere else in the codebase.
 *   Always read from the GameSession's config field.
 */
export const DEFAULT_GAME_CONFIG: Readonly<GameConfig> = Object.freeze({
  // ── Starting resources ─────────────────────────────────────────────────────
  startingCash: 15000,          // Each player's starting cash (placeholder)

  // ── GO / Start tile ────────────────────────────────────────────────────────
  goSalary: 300,               // Bonus for passing GO (placeholder)
  goLandBonus: 150,            // Extra bonus for landing exactly on GO (placeholder)

  // ── Jail ──────────────────────────────────────────────────────────────────
  bailCost: 80,                 // Cost to pay bail immediately (placeholder)
  jailAutoReleaseAfterTurns: 2,  // Auto-release after 2 full waited turns (per PRD)

  // ── Property / building ────────────────────────────────────────────────────
  mortgageInterestRate: 0.4,     // Redemption = mortgageValue × 1.1 (placeholder)
  buildingRefundRate: 0.7,      // Sell back at 75% of build cost (per PRD)

  // ── Auction ───────────────────────────────────────────────────────────────
  auctionRoundMs: 30_000,        // 30 seconds per round (placeholder)
  startingBid: 0,                // Always 0 per PRD

  // ── Dying rescue ──────────────────────────────────────────────────────────
  dyingRescueTotalMs: 10 * 60 * 1_000,            // 10 minutes total (per PRD)
  dyingRescueAfkWarningMs: (10 - 2) * 60 * 1_000, // Warn 2 minutes before kick
  dyingRescueAfkKickMs: 10 * 60 * 1_000,          // Kick at 10 minutes

  // ── Disconnect / reconnect ────────────────────────────────────────────────
  reconnectWindowMs: 5 * 60 * 1_000,  // 5 minutes reconnect window (per PRD)

  // ── Casino ────────────────────────────────────────────────────────────────
  casinoBetMultiple: 50,         // Bets must be multiples of 50 (per PRD)

  // ── Temple ────────────────────────────────────────────────────────────────
  templeLitThreshold: 3,         // 3 prayers to light up (per PRD)
  templePrayFee: 300,            // Cost per prayer (placeholder)

  // ── Prop cards ────────────────────────────────────────────────────────────
  priceHikeMultiplier: 1.5,      // Rent multiplier while price hike is active (per PRD)
});

/**
 * Board constants — board geometry that never changes during a game.
 */
export const BOARD_CONFIG = Object.freeze({
  TOTAL_TILES: 56,
  GO_TILE_ID: 0,
  JAIL_TILE_ID: 28,

  // Fixed anchor positions (per PRD)
  FIXED_ANCHORS: {
    GO:       0,
    AIRPORT_NORTH: 7,
    TEMPLE_A: 14,
    CASINO_B: 18,
    AIRPORT_EAST: 21,
    JAIL:     28,
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
export const CASINO_TIERS = Object.freeze([
  // ── 前期博弈区 (50 - 1000) 拆分得非常细 ──
  
  // 1. 乞丐搏命局：胜率极低(20%)，但一旦赢了直接 5 倍赔率（净赚 4 倍本金）
  { minBet: 50,    maxBet: 100,   loseWeight: 65, breakEvenWeight: 15, winWeight: 20, winMultiplier: 5.0 },
  
  // 2. 穷人碰运气：胜率略微提升(25%)，赔率 4 倍
  { minBet: 150,   maxBet: 250,   loseWeight: 60, breakEvenWeight: 15, winWeight: 25, winMultiplier: 4.0 },
  
  // 3. 平民小试牛刀：胜率达到近三分之一(30%)，赔率 3 倍
  { minBet: 300,   maxBet: 450,   loseWeight: 50, breakEvenWeight: 20, winWeight: 30, winMultiplier: 3.0 },
  
  // 4. 小康玩家：输赢开始趋于平衡(35%胜率)，赔率 2.5 倍
  { minBet: 500,   maxBet: 700,   loseWeight: 45, breakEvenWeight: 20, winWeight: 35, winMultiplier: 2.5 },
  
  // 5. 中产阶级：胜率(40%)终于和败率(40%)五五开了，标准的 2 倍赔率（赢了翻倍）
  { minBet: 750,   maxBet: 1000,  loseWeight: 40, breakEvenWeight: 20, winWeight: 40, winMultiplier: 2.0 },

  // ── 中后期土豪区 (1050 - Infinity) ──

  // 6. 富豪局：胜率(50%)已经大于败率(30%)，但赔率降到 1.5 倍（比如下 2000，连本带利拿回 3000）
  { minBet: 1050,  maxBet: 2000,  loseWeight: 30, breakEvenWeight: 20, winWeight: 50, winMultiplier: 1.5 },
  
  // 7. 大亨局：高胜率(60%)，低风险求稳，赔率 1.3 倍（赚 30% 利息）
  { minBet: 2050,  maxBet: 5000,  loseWeight: 20, breakEvenWeight: 20, winWeight: 60, winMultiplier: 1.3 },
  
  // 8. 寡头局：极高胜率(75%)，闭着眼睛赚钱，但只赚 20%
  { minBet: 5050,  maxBet: 10000, loseWeight: 10, breakEvenWeight: 15, winWeight: 75, winMultiplier: 1.2 },
  
  // 9. 财阀局：90% 的胜率基本等于系统送钱，但因为基数极大，赔率压到了 1.1 倍防止经济崩溃
  { minBet: 10050, maxBet: Infinity, loseWeight: 5, breakEvenWeight: 5, winWeight: 90, winMultiplier: 1.1 },
]);
