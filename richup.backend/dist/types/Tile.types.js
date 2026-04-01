"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColorGroup = exports.TileType = void 0;
exports.isPropertyTile = isPropertyTile;
exports.isAirportTile = isAirportTile;
exports.isTempleTile = isTempleTile;
exports.isCasinoTile = isCasinoTile;
exports.isTaxTile = isTaxTile;
exports.isSurpriseTile = isSurpriseTile;
exports.isGoTile = isGoTile;
exports.isJailTile = isJailTile;
exports.isPurchasable = isPurchasable;
/**
 * All tile types on the 56-tile board.
 */
var TileType;
(function (TileType) {
    TileType["PROPERTY"] = "PROPERTY";
    TileType["AIRPORT"] = "AIRPORT";
    TileType["TEMPLE"] = "TEMPLE";
    TileType["CASINO"] = "CASINO";
    TileType["TAX"] = "TAX";
    TileType["SURPRISE"] = "SURPRISE";
    TileType["GO"] = "GO";
    TileType["JAIL"] = "JAIL";
    TileType["GO_TO_JAIL"] = "GO_TO_JAIL";
    TileType["FREE"] = "FREE";
})(TileType || (exports.TileType = TileType = {}));
/**
 * Color group for properties — used for monopoly detection and cascading penalties.
 * Exact groupings are defined in TileDefinitions.ts config.
 */
var ColorGroup;
(function (ColorGroup) {
    ColorGroup["BROWN"] = "BROWN";
    ColorGroup["LIGHT_BLUE"] = "LIGHT_BLUE";
    ColorGroup["PINK"] = "PINK";
    ColorGroup["ORANGE"] = "ORANGE";
    ColorGroup["RED"] = "RED";
    ColorGroup["YELLOW"] = "YELLOW";
    ColorGroup["GREEN"] = "GREEN";
    ColorGroup["DARK_BLUE"] = "DARK_BLUE";
    ColorGroup["PURPLE"] = "PURPLE";
    ColorGroup["TEAL"] = "TEAL";
    ColorGroup["GRAY"] = "GRAY";
})(ColorGroup || (exports.ColorGroup = ColorGroup = {}));
/** Type guard helpers */
function isPropertyTile(t) { return t.type === TileType.PROPERTY; }
function isAirportTile(t) { return t.type === TileType.AIRPORT; }
function isTempleTile(t) { return t.type === TileType.TEMPLE; }
function isCasinoTile(t) { return t.type === TileType.CASINO; }
function isTaxTile(t) { return t.type === TileType.TAX; }
function isSurpriseTile(t) { return t.type === TileType.SURPRISE; }
function isGoTile(t) { return t.type === TileType.GO; }
function isJailTile(t) { return t.type === TileType.JAIL; }
function isPurchasable(t) {
    return t.type === TileType.PROPERTY || t.type === TileType.AIRPORT || t.type === TileType.TEMPLE;
}
//# sourceMappingURL=Tile.types.js.map