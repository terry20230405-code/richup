"use strict";
/**
 * Surprise card deck management and effect application.
 *
 * Deck is a shuffled stack; when empty the discard pile is reshuffled.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSurpriseDeck = initSurpriseDeck;
exports.applySurpriseCard = applySurpriseCard;
const uuid_1 = require("uuid");
const GameSession_types_1 = require("../types/GameSession.types");
const PropCard_types_1 = require("../types/PropCard.types");
const GameSession_1 = require("../state/GameSession");
const broadcast_1 = require("../socket/emitters/broadcast");
const randomUtils_1 = require("../utils/randomUtils");
const logger_1 = require("../utils/logger");
// ─── Deck definitions ─────────────────────────────────────────────────────────
/**
 * Master card pool — all placeholder amounts.
 * PRD Phase 2 will balance these values.
 */
function buildCardPool() {
    return [
        // Cash gains (placeholder amounts)
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.CASH_GAIN, amount: 1000, description: '获得奖励金 1000' },
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.CASH_GAIN, amount: 2000, description: '获得奖励金 2000' },
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.CASH_GAIN, amount: 500, description: '获得奖励金 500' },
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.CASH_GAIN, amount: 3000, description: '获得奖励金 3000' },
        // Cash losses (placeholder amounts)
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.CASH_LOSS, amount: 500, description: '支付罚款 500' },
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.CASH_LOSS, amount: 1000, description: '支付罚款 1000' },
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.CASH_LOSS, amount: 2000, description: '支付维修费 2000' },
        // Prop card draws
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.PROP_CARD, amount: 0, description: '获得一张道具卡' },
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.PROP_CARD, amount: 0, description: '获得一张道具卡' },
        // Rampage (extra roll)
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.RAMPAGE, amount: 0, description: '狂奔！再掷一次骰子' },
        { id: (0, uuid_1.v4)(), type: GameSession_types_1.SurpriseCardType.RAMPAGE, amount: 0, description: '狂奔！再掷一次骰子' },
    ];
}
/** Create a freshly shuffled surprise deck for a new game. */
function initSurpriseDeck() {
    return (0, randomUtils_1.fisherYatesShuffle)(buildCardPool());
}
// ─── Draw ─────────────────────────────────────────────────────────────────────
function drawCard(session) {
    if (session.surpriseDeck.length === 0) {
        // Reshuffle discard pile
        session.surpriseDeck = (0, randomUtils_1.fisherYatesShuffle)(session.surpriseDiscardPile);
        session.surpriseDiscardPile = [];
    }
    const card = session.surpriseDeck.pop();
    if (!card)
        throw new Error('Surprise deck is empty even after reshuffle');
    return card;
}
// ─── Prop card pool ───────────────────────────────────────────────────────────
const PROP_CARD_TYPES = [
    PropCard_types_1.PropCardType.FORCED_TRADE,
    PropCard_types_1.PropCardType.REMOTE_DICE,
    PropCard_types_1.PropCardType.PLUNDER,
    PropCard_types_1.PropCardType.IMMUNITY,
    PropCard_types_1.PropCardType.AUDIT,
    PropCard_types_1.PropCardType.PRICE_HIKE,
];
function randomPropCardType() {
    const idx = Math.floor(Math.random() * PROP_CARD_TYPES.length);
    return PROP_CARD_TYPES[idx];
}
/**
 * Draw and apply a surprise card for the given player.
 * Emits SURPRISE_RESULT (and SURPRISE_RAMPAGE / PROP_CARD_DRAWN if applicable).
 */
function applySurpriseCard(session, playerId, io) {
    const card = drawCard(session);
    session.surpriseDiscardPile.push(card);
    const result = { rampage: false, propCardDrawn: false };
    switch (card.type) {
        case GameSession_types_1.SurpriseCardType.CASH_GAIN: {
            (0, GameSession_1.cashChange)(session, playerId, card.amount, 'SURPRISE_GAIN', io);
            const payload = {
                playerId,
                cashDelta: card.amount,
                cardDescription: card.description,
            };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'SURPRISE_RESULT', payload);
            break;
        }
        case GameSession_types_1.SurpriseCardType.CASH_LOSS: {
            (0, GameSession_1.cashChange)(session, playerId, -card.amount, 'SURPRISE_LOSS', io);
            const payload = {
                playerId,
                cashDelta: -(card.amount),
                cardDescription: card.description,
            };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'SURPRISE_RESULT', payload);
            break;
        }
        case GameSession_types_1.SurpriseCardType.PROP_CARD: {
            // Give the player a random prop card
            const propCardType = randomPropCardType();
            const player = session.players.get(playerId);
            if (player) {
                player.propCards.push({ id: (0, uuid_1.v4)(), type: propCardType, acquiredAt: Date.now() });
            }
            // Broadcast: only reveal WHO drew, not what type
            const drawnPayload = { playerId };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'PROP_CARD_DRAWN', drawnPayload);
            // Also send the full surprise result description
            const payload = { playerId, cardDescription: card.description };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'SURPRISE_RESULT', payload);
            result.propCardDrawn = true;
            logger_1.logger.debug({ roomId: session.id, playerId, propCardType }, 'Prop card drawn from surprise');
            break;
        }
        case GameSession_types_1.SurpriseCardType.RAMPAGE: {
            const payload = { playerId };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'SURPRISE_RAMPAGE', payload);
            const resultPayload = { playerId, cardDescription: card.description };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'SURPRISE_RESULT', resultPayload);
            result.rampage = true;
            break;
        }
    }
    return result;
}
//# sourceMappingURL=SurpriseHandler.js.map