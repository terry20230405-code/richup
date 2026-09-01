"use strict";
/**
 * Casino bet resolution.
 *
 * Probability tiers are defined in GameConfig.CASINO_TIERS.
 * Bet must be a positive multiple of casinoBetMultiple (default 50).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCasinoBet = handleCasinoBet;
const Tile_types_1 = require("../types/Tile.types");
const GameSession_types_1 = require("../types/GameSession.types");
const GameConfig_1 = require("../config/GameConfig");
const GameSession_1 = require("../state/GameSession");
const randomUtils_1 = require("../utils/randomUtils");
const broadcast_1 = require("../socket/emitters/broadcast");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
/**
 * Process a casino bet for the landing player.
 * Emits CASINO_RESULT to all players.
 */
function handleCasinoBet(session, playerId, tileId, betAmount, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    const { casinoBetMultiple } = session.config;
    const tile = session.board[tileId];
    if (!tile || tile.type !== Tile_types_1.TileType.CASINO) {
        throw new errors_1.RuleViolationError('The current tile is not a casino');
    }
    // Validate bet
    if (betAmount <= 0 || betAmount % casinoBetMultiple !== 0) {
        throw new errors_1.RuleViolationError(`Bet must be a positive multiple of ${casinoBetMultiple}`);
    }
    if (player.cash < betAmount) {
        throw new errors_1.InsufficientFundsError(playerId, betAmount, player.cash);
    }
    if (betAmount > tile.maxBet) {
        throw new errors_1.RuleViolationError(`Bet cannot exceed the casino maximum of ${tile.maxBet}`);
    }
    // Select probability tier
    const tier = GameConfig_1.CASINO_TIERS.find(t => betAmount >= t.minBet && betAmount <= t.maxBet)
        ?? GameConfig_1.CASINO_TIERS[GameConfig_1.CASINO_TIERS.length - 1];
    const outcomeIndex = (0, randomUtils_1.weightedRandom)([
        tier.loseWeight,
        tier.breakEvenWeight,
        tier.winWeight,
    ]);
    const OUTCOME_MAP = ['LOSE', 'BREAK_EVEN', 'WIN'];
    const outcome = OUTCOME_MAP[outcomeIndex] ?? 'LOSE';
    let cashDelta;
    switch (outcome) {
        case 'WIN':
            // Use the tier multiplier from GameConfig, with a 2x fallback.
            // A 2x payout returns the stake plus an equal amount of profit.
            const multiplier = tier.winMultiplier ?? 2;
            // Net profit = stake x (total multiplier - 1).
            // For example, a $100 stake at 3x produces $200 net profit.
            cashDelta = Math.floor(betAmount * (multiplier - 1));
            break;
        case 'LOSE':
            cashDelta = -betAmount; // Lose the full stake.
            break;
        case 'BREAK_EVEN':
        default:
            cashDelta = 0; // Break even with no balance change.
            break;
    }
    // Apply cash change
    if (cashDelta !== 0) {
        (0, GameSession_1.cashChange)(session, playerId, cashDelta, `CASINO_${outcome}`, io);
    }
    const phase = session.pendingExtraRoll ? GameSession_types_1.TurnPhase.WAITING_FOR_ACTION : GameSession_types_1.TurnPhase.END_TURN_PENDING;
    const payload = {
        playerId,
        betAmount,
        outcome,
        cashDelta,
        phase,
        availableActions: session.pendingExtraRoll ? ['ROLL_DICE'] : ['END_TURN'],
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'CASINO_RESULT', payload);
    logger_1.logger.debug({ roomId: session.id, playerId, betAmount, outcome, cashDelta }, 'Casino result');
}
//# sourceMappingURL=CasinoManager.js.map