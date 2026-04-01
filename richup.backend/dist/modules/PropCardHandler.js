"use strict";
/**
 * Prop-card effect dispatcher — 6 card types.
 *
 *  FORCED_TRADE  — buy any non-built tile from any player at its basePrice
 *  REMOTE_DICE   — choose steps (5/6/7), overrides next roll
 *  PLUNDER       — steal max(0, floor(target.cash / 2)) from a target player
 *  IMMUNITY      — next time you must pay rent, it's waived (one use)
 *  AUDIT         — private: see all players' current cash balances
 *  PRICE_HIKE    — your rent is ×1.5 until the start of your next turn
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.usePropCard = usePropCard;
const PropCard_types_1 = require("../types/PropCard.types");
const GameSession_1 = require("../state/GameSession");
const broadcast_1 = require("../socket/emitters/broadcast");
const direct_1 = require("../socket/emitters/direct");
const DiceEngine_1 = require("./DiceEngine");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
/**
 * Execute a prop card effect.
 * Removes the card from the player's hand if successful.
 */
function usePropCard(session, playerId, cardId, cardType, params, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    // Verify card ownership
    const cardIndex = player.propCards.findIndex(c => c.id === cardId && c.type === cardType);
    if (cardIndex === -1) {
        throw new errors_1.RuleViolationError(`Player does not hold card ${cardId} of type ${cardType}`);
    }
    // Dispatch by type
    switch (cardType) {
        case PropCard_types_1.PropCardType.FORCED_TRADE:
            handleForcedTrade(session, playerId, params, io);
            break;
        case PropCard_types_1.PropCardType.REMOTE_DICE:
            handleRemoteDice(session, playerId, params, io);
            break;
        case PropCard_types_1.PropCardType.PLUNDER:
            handlePlunder(session, playerId, params, io);
            break;
        case PropCard_types_1.PropCardType.IMMUNITY:
            handleImmunity(session, playerId, io);
            break;
        case PropCard_types_1.PropCardType.AUDIT:
            handleAudit(session, playerId, io);
            break;
        case PropCard_types_1.PropCardType.PRICE_HIKE:
            handlePriceHike(session, playerId, io);
            break;
        default:
            throw new errors_1.RuleViolationError(`Unknown prop card type: ${cardType}`);
    }
    // Remove used card
    player.propCards.splice(cardIndex, 1);
    // Broadcast usage (type revealed, target may be revealed)
    const payload = {
        playerId,
        cardType,
        targetPlayerId: params.targetPlayerId,
        targetTileId: params.targetTileId,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PROP_CARD_USED', payload);
    logger_1.logger.debug({ roomId: session.id, playerId, cardType }, 'Prop card used');
}
// ─── Handlers ─────────────────────────────────────────────────────────────────
function handleForcedTrade(session, buyerId, params, io) {
    const { targetPlayerId, targetTileId } = params;
    if (!targetPlayerId || targetTileId === undefined) {
        throw new errors_1.RuleViolationError('FORCED_TRADE requires targetPlayerId and targetTileId');
    }
    const tile = session.board[targetTileId];
    if (!tile)
        throw new errors_1.NotFoundError('Tile', targetTileId);
    if (!('ownerId' in tile))
        throw new errors_1.RuleViolationError('Tile cannot be traded');
    const typedTile = tile;
    if (typedTile.ownerId !== targetPlayerId) {
        throw new errors_1.RuleViolationError(`Player ${targetPlayerId} does not own tile ${targetTileId}`);
    }
    if ((typedTile.buildingLevel ?? 0) > 0) {
        throw new errors_1.RuleViolationError('Cannot force-trade a tile with buildings');
    }
    if (typedTile.isMortgaged) {
        throw new errors_1.RuleViolationError('Cannot force-trade a mortgaged tile');
    }
    const price = typedTile.basePrice;
    const buyer = (0, GameSession_1.requirePlayer)(session, buyerId);
    if (buyer.cash < price) {
        throw new errors_1.RuleViolationError('Insufficient funds for forced trade');
    }
    // Transfer ownership
    typedTile.ownerId = buyerId;
    // Cash exchange
    (0, GameSession_1.cashChange)(session, buyerId, -price, 'FORCED_TRADE_BUY', io);
    (0, GameSession_1.cashChange)(session, targetPlayerId, price, 'FORCED_TRADE_SELL', io);
    const payload = {
        fromPlayerId: buyerId,
        toPlayerId: targetPlayerId,
        tileId: targetTileId,
        price,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'FORCED_TRADE_EXECUTED', payload);
}
function handleRemoteDice(session, playerId, params, io) {
    const { steps } = params;
    if (!steps || ![5, 6, 7].includes(steps)) {
        throw new errors_1.RuleViolationError('REMOTE_DICE requires steps of 5, 6, or 7');
    }
    (0, DiceEngine_1.applyRemoteDice)(session, playerId, steps, io);
}
function handlePlunder(session, plunderer, params, io) {
    const { targetPlayerId } = params;
    if (!targetPlayerId)
        throw new errors_1.RuleViolationError('PLUNDER requires targetPlayerId');
    const target = (0, GameSession_1.requirePlayer)(session, targetPlayerId);
    // max(0, floor(target.cash / 2)) — 0 if target has no cash
    const stealAmount = Math.max(0, Math.floor(target.cash / 2));
    if (stealAmount > 0) {
        (0, GameSession_1.cashChange)(session, targetPlayerId, -stealAmount, 'PLUNDER_VICTIM', io);
        (0, GameSession_1.cashChange)(session, plunderer, stealAmount, 'PLUNDER_GAIN', io);
    }
    const payload = {
        fromPlayerId: plunderer,
        toPlayerId: targetPlayerId,
        amount: stealAmount,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLUNDER_EXECUTED', payload);
}
function handleImmunity(session, playerId, _io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    player.hasImmunity = true;
    // Broadcast happens via PROP_CARD_USED (type revealed) — actual use revealed via IMMUNITY_USED
}
function handleAudit(session, auditorId, io) {
    const cashMap = {};
    for (const [id, p] of session.players) {
        cashMap[id] = p.cash;
    }
    const payload = {
        requestedByPlayerId: auditorId,
        playerCashMap: cashMap,
    };
    // ⚠ Directed only — never broadcast
    (0, direct_1.emitToPlayer)(io, auditorId, 'AUDIT_RESULT', payload);
}
function handlePriceHike(session, playerId, _io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    player.priceHikeActive = true;
    player.priceHikeExpiresOnTurn = session.turnNumber + session.playerOrder.length;
    // Expiry handled in SocketEventRouter at TURN_STARTED
}
//# sourceMappingURL=PropCardHandler.js.map