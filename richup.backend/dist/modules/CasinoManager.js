"use strict";
/**
 * Casino bet resolution.
 *
 * Probability tiers are defined in GameConfig.CASINO_TIERS.
 * Bet must be a positive multiple of casinoBetMultiple (default 50).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCasinoBet = handleCasinoBet;
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
function handleCasinoBet(session, playerId, betAmount, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    const { casinoBetMultiple } = session.config;
    // Validate bet
    if (betAmount <= 0 || betAmount % casinoBetMultiple !== 0) {
        throw new errors_1.RuleViolationError(`Bet must be a positive multiple of ${casinoBetMultiple}`);
    }
    if (player.cash < betAmount) {
        throw new errors_1.InsufficientFundsError(playerId, betAmount, player.cash);
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
            cashDelta = betAmount; // Win: get betAmount back (net +betAmount)
            break;
        case 'LOSE':
            cashDelta = -betAmount; // Lose: lose bet
            break;
        default:
            cashDelta = 0; // Break even
            break;
    }
    // Apply cash change
    if (cashDelta !== 0) {
        (0, GameSession_1.cashChange)(session, playerId, cashDelta, `CASINO_${outcome}`, io);
    }
    const payload = {
        playerId,
        betAmount,
        outcome,
        cashDelta,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'CASINO_RESULT', payload);
    logger_1.logger.debug({ roomId: session.id, playerId, betAmount, outcome, cashDelta }, 'Casino result');
}
//# sourceMappingURL=CasinoManager.js.map