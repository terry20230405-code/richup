import type { GameConfig } from '../types/GameSession.types';
/**
 * Default game configuration.
 * All values are placeholders — adjust during balancing (Phase 2 of PRD).
 *
 * ⚠ Do NOT hardcode these values anywhere else in the codebase.
 *   Always read from the GameSession's config field.
 */
export declare const DEFAULT_GAME_CONFIG: Readonly<GameConfig>;
/**
 * Board constants — board geometry that never changes during a game.
 */
export declare const BOARD_CONFIG: Readonly<{
    TOTAL_TILES: 56;
    GO_TILE_ID: 0;
    JAIL_TILE_ID: 28;
    FIXED_ANCHORS: {
        GO: number;
        AIRPORT_NORTH: number;
        TEMPLE_A: number;
        CASINO_B: number;
        AIRPORT_EAST: number;
        JAIL: number;
        AIRPORT_SOUTH: number;
        TEMPLE_B: number;
        CASINO_A: number;
        AIRPORT_WEST: number;
    };
    RANDOM_POOL: {
        PROPERTY_COUNT: number;
        SURPRISE_COUNT: number;
        TAX_COUNT: number;
    };
}>;
/**
 * Casino probability tiers (per PRD).
 * Probabilities are weights: [lose, break-even, win].
 * Tier selection is based on bet amount ranges.
 */
export declare const CASINO_TIERS: readonly {
    minBet: number;
    maxBet: number;
    loseWeight: number;
    breakEvenWeight: number;
    winWeight: number;
    winMultiplier: number;
}[];
//# sourceMappingURL=GameConfig.d.ts.map