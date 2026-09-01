"use strict";
/**
 * Rent calculation engine.
 *
 * Calculation chain (per PRD):
 *   1. Tile is mortgaged → 0
 *   2. Base rent by building level
 *   3. Monopoly bonus (owns all tiles in colour group AND buildingLevel === 0 → ×2)
 *   4. Airport: rent table indexed by number of airports the owner has
 *   5. Temple: prayFee (owner praying) or passThruToll (non-owner landing)
 *   6. Cascading penalty: effectiveRent = baseRent × (unmortgaged / totalInGroup)
 *   7. Price-hike card: if owner.priceHikeActive → ceil(rent × multiplier)
 *   8. Owner in jail → rent goes to BANK (return BANK_ID as recipient)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRent = computeRent;
exports.hasMonopoly = hasMonopoly;
exports.validateEvenBuilding = validateEvenBuilding;
const Common_types_1 = require("../types/Common.types");
const Tile_types_1 = require("../types/Tile.types");
const GameSession_1 = require("../state/GameSession");
const errors_1 = require("../utils/errors");
/**
 * Compute the rent owed when `landingPlayerId` lands on `tileId`.
 * Returns { amount: 0 } if no rent is due (unowned, mortgaged, etc.)
 */
function computeRent(session, tileId, landingPlayerId) {
    const tile = session.board[tileId];
    if (!tile)
        throw new errors_1.NotFoundError('Tile', tileId);
    // Only ownable tiles can charge rent
    if (!('ownerId' in tile) || !tile.ownerId) {
        return { amount: 0, recipient: Common_types_1.BANK_ID };
    }
    // Can't charge yourself rent
    if (tile.ownerId === landingPlayerId) {
        return { amount: 0, recipient: Common_types_1.BANK_ID };
    }
    const owner = (0, GameSession_1.requirePlayer)(session, tile.ownerId);
    switch (tile.type) {
        case Tile_types_1.TileType.PROPERTY:
            return computePropertyRent(session, tile, owner, landingPlayerId);
        case Tile_types_1.TileType.AIRPORT:
            return computeAirportRent(session, tile, owner);
        case Tile_types_1.TileType.TEMPLE:
            return computeTemplePassRent(session, tile, owner);
        default:
            return { amount: 0, recipient: Common_types_1.BANK_ID };
    }
}
// ─── Property rent ────────────────────────────────────────────────────────────
function computePropertyRent(session, tile, owner, _landingPlayerId) {
    if (tile.isMortgaged)
        return { amount: 0, recipient: Common_types_1.BANK_ID };
    const { colorGroup } = tile;
    const groupTiles = session.board.filter((t) => t.type === Tile_types_1.TileType.PROPERTY && t.colorGroup === colorGroup);
    // Get base rent
    let baseRent;
    if (tile.buildingLevel > 0) {
        baseRent = tile.rentByLevel[tile.buildingLevel] ?? 0;
    }
    else {
        // Check for monopoly
        const ownerOwnsAll = groupTiles.every(t => t.ownerId === owner.id && !t.isMortgaged);
        baseRent = ownerOwnsAll ? tile.baseRentWithMonopoly : tile.baseRent;
    }
    // Cascading penalty: ratio of unmortgaged tiles in group owner has
    const ownerGroupTiles = groupTiles.filter(t => t.ownerId === owner.id);
    const unmortgaged = ownerGroupTiles.filter(t => !t.isMortgaged).length;
    const total = ownerGroupTiles.length;
    const effectiveRent = total > 0
        ? Math.ceil(baseRent * (unmortgaged / total))
        : baseRent;
    // Price-hike card multiplier
    const finalRent = owner.priceHikeActive
        ? Math.ceil(effectiveRent * session.config.priceHikeMultiplier)
        : effectiveRent;
    // If owner is in jail → rent goes to BANK
    const recipient = owner.inJail ? Common_types_1.BANK_ID : owner.id;
    return { amount: finalRent, recipient };
}
// ─── Airport rent ─────────────────────────────────────────────────────────────
function computeAirportRent(session, tile, owner) {
    if (tile.isMortgaged)
        return { amount: 0, recipient: Common_types_1.BANK_ID };
    // Count how many airports the owner has
    const airportCount = session.board.filter((t) => t.type === Tile_types_1.TileType.AIRPORT && !t.isMortgaged && t.ownerId === owner.id).length;
    const tableIndex = Math.min(airportCount - 1, tile.rentTable.length - 1);
    let rent = tableIndex >= 0 ? (tile.rentTable[tableIndex] ?? 0) : 0;
    // Price-hike multiplier
    if (owner.priceHikeActive) {
        rent = Math.ceil(rent * session.config.priceHikeMultiplier);
    }
    const recipient = owner.inJail ? Common_types_1.BANK_ID : owner.id;
    return { amount: rent, recipient };
}
// ─── Temple pass-through rent ─────────────────────────────────────────────────
function computeTemplePassRent(session, tile, owner) {
    if (tile.isMortgaged)
        return { amount: 0, recipient: Common_types_1.BANK_ID };
    const recipient = owner.inJail ? Common_types_1.BANK_ID : owner.id;
    return { amount: session.config.templePassThruToll, recipient };
}
// ─── Group helpers ────────────────────────────────────────────────────────────
/**
 * Check whether the given player owns all non-mortgaged tiles in the colour group.
 */
function hasMonopoly(session, playerId, colorGroup) {
    const groupTiles = session.board.filter((t) => t.type === Tile_types_1.TileType.PROPERTY && t.colorGroup === colorGroup);
    return groupTiles.length > 0 && groupTiles.every(t => t.ownerId === playerId && !t.isMortgaged);
}
/**
 * Check that buildings are placed "evenly" across a colour group:
 * no tile in the group may have a building level more than 1 higher than any other.
 */
function validateEvenBuilding(session, playerId, colorGroup) {
    const groupTiles = session.board.filter((t) => t.type === Tile_types_1.TileType.PROPERTY && t.colorGroup === colorGroup && t.ownerId === playerId);
    if (groupTiles.length === 0)
        return;
    const levels = groupTiles.map(t => t.buildingLevel);
    const min = Math.min(...levels);
    const max = Math.max(...levels);
    if (max - min > 1) {
        throw new errors_1.RuleViolationError(`Building levels in group ${colorGroup} are uneven (min: ${min}, max: ${max})`);
    }
}
//# sourceMappingURL=RentCalculator.js.map