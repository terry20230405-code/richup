"use strict";
/**
 * Temple tile logic.
 *
 * Rules (per PRD):
 *  - Owner lands on own lit temple → draws 1 PropCard (no fee)
 *  - Owner lands on own unlit temple → pays prayFee, litCount++; if litCount >= litThreshold → temple lights up
 *  - Non-owner lands → pays passThruToll to owner
 *  - Temple can only be "lit" once per game
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTempleLanding = handleTempleLanding;
exports.ownerPrays = ownerPrays;
const Tile_types_1 = require("../types/Tile.types");
const PropCard_types_1 = require("../types/PropCard.types");
const GameSession_1 = require("../state/GameSession");
const broadcast_1 = require("../socket/emitters/broadcast");
const RentCalculator_1 = require("./RentCalculator");
const errors_1 = require("../utils/errors");
const uuid_1 = require("uuid");
const Common_types_1 = require("../types/Common.types");
const logger_1 = require("../utils/logger");
// Prop card pool for temple draws (same distribution as surprise cards)
const TEMPLE_PROP_POOL = [
    PropCard_types_1.PropCardType.FORCED_TRADE,
    PropCard_types_1.PropCardType.REMOTE_DICE,
    PropCard_types_1.PropCardType.PLUNDER,
    PropCard_types_1.PropCardType.IMMUNITY,
    PropCard_types_1.PropCardType.AUDIT,
    PropCard_types_1.PropCardType.PRICE_HIKE,
];
function randomPropType() {
    const idx = Math.floor(Math.random() * TEMPLE_PROP_POOL.length);
    return TEMPLE_PROP_POOL[idx];
}
/**
 * Handle a player landing on a temple tile.
 * Returns a description of what happened.
 */
function handleTempleLanding(session, landingPlayerId, tileId, io) {
    const tile = session.board[tileId];
    if (!tile || tile.type !== Tile_types_1.TileType.TEMPLE)
        throw new errors_1.NotFoundError('TempleTile', tileId);
    const temple = tile;
    const result = { ownerPrayed: false, propCardDrawn: false, rentCharged: false };
    if (!temple.ownerId) {
        // Unowned — no effect (player can buy in EVENT_TRIGGER phase)
        return result;
    }
    if (temple.ownerId === landingPlayerId) {
        // Owner landed on own temple
        if (temple.isLit) {
            // Lit temple: draw a prop card
            const player = (0, GameSession_1.requirePlayer)(session, landingPlayerId);
            const propType = randomPropType();
            player.propCards.push({ id: (0, uuid_1.v4)(), type: propType, acquiredAt: Date.now() });
            const drawnPayload = { playerId: landingPlayerId };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'PROP_CARD_DRAWN', drawnPayload);
            result.propCardDrawn = true;
            logger_1.logger.debug({ roomId: session.id, tileId, playerId: landingPlayerId }, 'Temple prop card drawn');
        }
        else {
            // Unlit temple: owner prays — handled via ACTION:TEMPLE_PRAY in router
            // Just signal the result; actual fee deducted when player explicitly prays
            result.ownerPrayed = false;
        }
    }
    else {
        // Non-owner: charge pass-through toll
        const rentResult = (0, RentCalculator_1.computeRent)(session, tileId, landingPlayerId);
        if (rentResult.amount > 0) {
            (0, GameSession_1.cashChange)(session, landingPlayerId, -rentResult.amount, 'TEMPLE_TOLL', io);
            if (rentResult.recipient !== Common_types_1.BANK_ID) {
                (0, GameSession_1.cashChange)(session, rentResult.recipient, rentResult.amount, 'TEMPLE_TOLL_RECEIVE', io);
            }
            const payload = {
                from: landingPlayerId,
                to: rentResult.recipient,
                tileId,
                amount: rentResult.amount,
            };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'RENT_CHARGED', payload);
            result.rentCharged = true;
        }
    }
    return result;
}
// ─── Owner prays ──────────────────────────────────────────────────────────────
/**
 * Called when the owner explicitly clicks "TEMPLE_PRAY" (in EVENT_TRIGGER phase).
 * Deducts prayFee, increments litCount, lights up temple if threshold reached.
 */
function ownerPrays(session, playerId, tileId, io) {
    const tile = session.board[tileId];
    if (!tile || tile.type !== Tile_types_1.TileType.TEMPLE)
        throw new errors_1.NotFoundError('TempleTile', tileId);
    const temple = tile;
    if (temple.ownerId !== playerId)
        throw new errors_1.RuleViolationError('Only the owner can pray');
    if (temple.isLit)
        throw new errors_1.RuleViolationError('Temple is already lit');
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    const prayFee = temple.prayFee;
    if (player.cash < prayFee) {
        throw new errors_1.RuleViolationError('Insufficient funds to pray');
    }
    (0, GameSession_1.cashChange)(session, playerId, -prayFee, 'TEMPLE_PRAY', io);
    temple.litCount++;
    if (temple.litCount >= temple.litThreshold) {
        temple.isLit = true;
        const litPayload = { tileId, isLit: true };
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'TEMPLE_LIT', litPayload);
        logger_1.logger.info({ roomId: session.id, tileId }, 'Temple lit up');
    }
}
//# sourceMappingURL=TempleManager.js.map