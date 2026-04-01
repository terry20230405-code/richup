"use strict";
/**
 * Building and mortgage management.
 *
 * Covers:
 *  - BUILD_HOUSE / BUILD_HOTEL (with even-building validation)
 *  - SELL_BUILDING
 *  - MORTGAGE / UNMORTGAGE
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildHouse = buildHouse;
exports.buildHotel = buildHotel;
exports.sellBuilding = sellBuilding;
exports.mortgageProperty = mortgageProperty;
exports.unmortgageProperty = unmortgageProperty;
const Tile_types_1 = require("../types/Tile.types");
const GameSession_1 = require("../state/GameSession");
const AuctionManager_1 = require("./AuctionManager");
const RentCalculator_1 = require("./RentCalculator");
const broadcast_1 = require("../socket/emitters/broadcast");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const MAX_HOUSE_LEVEL = 4;
const HOTEL_LEVEL = 5; // level 5 = 1 hotel; 6 = 2 hotels; 7 = 3 hotels per PRD
const MAX_LEVEL = 7;
// ─── Build ────────────────────────────────────────────────────────────────────
/** Build one house on the specified tile. */
function buildHouse(session, playerId, tileId, io) {
    const tile = requireOwnedProperty(session, tileId, playerId);
    if (!(0, RentCalculator_1.hasMonopoly)(session, playerId, tile.colorGroup)) {
        throw new errors_1.RuleViolationError(`Must own all tiles in colour group ${tile.colorGroup} to build`);
    }
    if (tile.buildingLevel >= MAX_HOUSE_LEVEL) {
        throw new errors_1.RuleViolationError('Must build a hotel, not more houses');
    }
    (0, RentCalculator_1.validateEvenBuilding)(session, playerId, tile.colorGroup);
    const cost = buildCost(tile.buildingLevel + 1);
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    if (player.cash < cost)
        throw new errors_1.InsufficientFundsError(playerId, cost, player.cash);
    (0, AuctionManager_1.assertNotBidLocked)(session, playerId, cost);
    tile.buildingLevel++;
    (0, GameSession_1.cashChange)(session, playerId, -cost, 'BUILD_HOUSE', io);
    const payload = {
        tileId,
        ownerId: playerId,
        cost: cost,
        newBuildingLevel: tile.buildingLevel,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'BUILDING_BUILT', payload);
    logger_1.logger.debug({ roomId: session.id, playerId, tileId, level: tile.buildingLevel }, 'House built');
}
/** Build a hotel (upgrade from level 4 → 5, or 5→6, 6→7). */
function buildHotel(session, playerId, tileId, io) {
    const tile = requireOwnedProperty(session, tileId, playerId);
    if (!(0, RentCalculator_1.hasMonopoly)(session, playerId, tile.colorGroup)) {
        throw new errors_1.RuleViolationError(`Must own all tiles in colour group ${tile.colorGroup} to build`);
    }
    if (tile.buildingLevel < MAX_HOUSE_LEVEL) {
        throw new errors_1.RuleViolationError('Must have 4 houses before building a hotel');
    }
    if (tile.buildingLevel >= MAX_LEVEL) {
        throw new errors_1.RuleViolationError('Already at maximum building level');
    }
    (0, RentCalculator_1.validateEvenBuilding)(session, playerId, tile.colorGroup);
    const cost = buildCost(tile.buildingLevel + 1);
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    if (player.cash < cost)
        throw new errors_1.InsufficientFundsError(playerId, cost, player.cash);
    (0, AuctionManager_1.assertNotBidLocked)(session, playerId, cost);
    tile.buildingLevel++;
    (0, GameSession_1.cashChange)(session, playerId, -cost, 'BUILD_HOTEL', io);
    const payload = {
        tileId,
        ownerId: playerId,
        cost: cost,
        newBuildingLevel: tile.buildingLevel,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'BUILDING_BUILT', payload);
}
// ─── Sell building ────────────────────────────────────────────────────────────
function sellBuilding(session, playerId, tileId, io) {
    const tile = requireOwnedProperty(session, tileId, playerId);
    if (tile.buildingLevel === 0)
        throw new errors_1.RuleViolationError('No buildings to sell');
    const refund = Math.floor(buildCost(tile.buildingLevel) * session.config.buildingRefundRate);
    tile.buildingLevel--;
    (0, GameSession_1.cashChange)(session, playerId, refund, 'SELL_BUILDING', io);
    const payload = {
        tileId,
        ownerId: playerId,
        refund,
        newBuildingLevel: tile.buildingLevel,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'BUILDING_SOLD', payload);
}
// ─── Mortgage ─────────────────────────────────────────────────────────────────
function mortgageProperty(session, playerId, tileId, io) {
    const tile = requireOwnedProperty(session, tileId, playerId);
    if (tile.isMortgaged)
        throw new errors_1.RuleViolationError('Tile is already mortgaged');
    if (tile.buildingLevel > 0)
        throw new errors_1.RuleViolationError('Must sell all buildings before mortgaging');
    tile.isMortgaged = true;
    (0, GameSession_1.cashChange)(session, playerId, tile.mortgageValue, 'MORTGAGE', io);
    const payload = {
        tileId,
        playerId,
        mortgageValue: tile.mortgageValue,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PROPERTY_MORTGAGED', payload);
}
function unmortgageProperty(session, playerId, tileId, io) {
    const tile = requireOwnedProperty(session, tileId, playerId);
    if (!tile.isMortgaged)
        throw new errors_1.RuleViolationError('Tile is not mortgaged');
    const redemptionCost = Math.ceil(tile.mortgageValue * (1 + session.config.mortgageInterestRate));
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    if (player.cash < redemptionCost) {
        throw new errors_1.InsufficientFundsError(playerId, redemptionCost, player.cash);
    }
    (0, AuctionManager_1.assertNotBidLocked)(session, playerId, redemptionCost);
    tile.isMortgaged = false;
    (0, GameSession_1.cashChange)(session, playerId, -redemptionCost, 'UNMORTGAGE', io);
    const payload = { tileId, playerId, redemptionCost };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PROPERTY_UNMORTGAGED', payload);
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function requireOwnedProperty(session, tileId, playerId) {
    const tile = session.board[tileId];
    if (!tile)
        throw new errors_1.NotFoundError('Tile', tileId);
    if (tile.type !== Tile_types_1.TileType.PROPERTY)
        throw new errors_1.RuleViolationError('Tile is not a property');
    const prop = tile;
    if (prop.ownerId !== playerId)
        throw new errors_1.RuleViolationError('You do not own this tile');
    return prop;
}
/**
 * Build cost per level — placeholder values.
 * Will be balanced in PRD Phase 2 using per-group tables.
 */
function buildCost(_level) {
    // All placeholder — real values driven by tile's colorGroup
    return 1000;
}
//# sourceMappingURL=BuildingManager.js.map