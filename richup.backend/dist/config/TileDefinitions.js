"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAX_TILE_TEMPLATE = exports.SURPRISE_TILE_TEMPLATE = exports.PROPERTY_TEMPLATES = exports.PROPERTY_GROUP_TEMPLATES = exports.FIXED_ANCHOR_TILES = void 0;
const Tile_types_1 = require("../types/Tile.types");
const GameConfig_1 = require("./GameConfig");
/**
 * Static tile blueprints used by MapGenerator to initialize each game.
 *
 * Fixed anchors are written to absolute indices.
 * The remaining 46 slots are filled from the random pool:
 *   - 28 properties
 *   - 9 surprise
 *   - 9 tax
 */
const GO_TILE = {
    id: GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.GO,
    name: 'START',
    type: Tile_types_1.TileType.GO,
};
const JAIL_TILE = {
    id: GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.JAIL,
    name: 'JAIL',
    type: Tile_types_1.TileType.JAIL,
};
const BASE_AIRPORT_RENT = 30;
function makeAirport(id, name) {
    return {
        id,
        name,
        type: Tile_types_1.TileType.AIRPORT,
        basePrice: 250,
        mortgageValue: 125,
        isMortgaged: false,
        ownerId: null,
        rentTable: [
            BASE_AIRPORT_RENT * 1,
            BASE_AIRPORT_RENT * 2,
            BASE_AIRPORT_RENT * 4,
            BASE_AIRPORT_RENT * 8,
        ],
    };
}
function makeTemple(id, name) {
    return {
        id,
        name,
        type: Tile_types_1.TileType.TEMPLE,
        ownerId: null,
        isMortgaged: false,
        basePrice: 400,
        mortgageValue: 200,
        isLit: false,
        litCount: 0,
        litThreshold: GameConfig_1.DEFAULT_GAME_CONFIG.templeLitThreshold,
        prayFee: GameConfig_1.DEFAULT_GAME_CONFIG.templePrayFee,
        passThruToll: GameConfig_1.DEFAULT_GAME_CONFIG.templePassThruToll,
    };
}
function makeCasino(id, name) {
    return {
        id,
        name,
        type: Tile_types_1.TileType.CASINO,
        betMultiple: GameConfig_1.DEFAULT_GAME_CONFIG.casinoBetMultiple,
        maxBet: 1000000,
    };
}
const AIRPORT_NORTH = makeAirport(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_NORTH, 'Airport');
const AIRPORT_EAST = makeAirport(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_EAST, 'Airport');
const AIRPORT_SOUTH = makeAirport(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_SOUTH, 'Airport');
const AIRPORT_WEST = makeAirport(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_WEST, 'Airport');
const TEMPLE_A = makeTemple(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.TEMPLE_A, 'Temple');
const TEMPLE_B = makeTemple(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.TEMPLE_B, 'Temple');
const CASINO_A = makeCasino(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.CASINO_A, 'Casino');
const CASINO_B = makeCasino(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.CASINO_B, 'Casino');
exports.FIXED_ANCHOR_TILES = new Map([
    [GO_TILE.id, GO_TILE],
    [AIRPORT_NORTH.id, AIRPORT_NORTH],
    [TEMPLE_A.id, TEMPLE_A],
    [CASINO_B.id, CASINO_B],
    [AIRPORT_EAST.id, AIRPORT_EAST],
    [JAIL_TILE.id, JAIL_TILE],
    [AIRPORT_SOUTH.id, AIRPORT_SOUTH],
    [TEMPLE_B.id, TEMPLE_B],
    [CASINO_A.id, CASINO_A],
    [AIRPORT_WEST.id, AIRPORT_WEST],
]);
function makeProp(name, colorGroup, basePrice, buildCost) {
    // 1. Calculate base rent automatically as 10% of the property price.
    const autoBaseRent = Math.floor(basePrice * 0.08);
    return {
        name,
        type: Tile_types_1.TileType.PROPERTY,
        colorGroup,
        basePrice,
        buildCost,
        mortgageValue: basePrice * 0.5, // Mortgage value.
        buildingLevel: 0,
        isMortgaged: false,
        ownerId: null,
        // 2. Apply the calculated rent values.
        baseRent: autoBaseRent,
        baseRentWithMonopoly: autoBaseRent * 2, // A monopoly doubles base rent.
        // 3. Generate level 0-6 rent values from the base rent.
        rentByLevel: [
            autoBaseRent, // Level 0: undeveloped.
            autoBaseRent * 5, // Level 1: one house.
            autoBaseRent * 10, // Level 2: two houses.
            autoBaseRent * 20, // Level 3: three houses.
            autoBaseRent * 40, // Level 4: four houses.
            autoBaseRent * 50, // Level 5: hotel.
            autoBaseRent * 60, // Level 6: landmark.
        ],
    };
}
/**
 * 11 countries / color groups, 28 property tiles total.
 * Each inner array represents one country and must stay packed together in the random pool.
 */
exports.PROPERTY_GROUP_TEMPLATES = [
    // Tier 1: entry-level district ($50 build cost).
    // South Korea (brown).
    [
        makeProp('Seoul', Tile_types_1.ColorGroup.BROWN, 80, 50),
        makeProp('Busan', Tile_types_1.ColorGroup.BROWN, 60, 50),
    ],
    // Italy (purple).
    [
        makeProp('Rome', Tile_types_1.ColorGroup.PURPLE, 120, 50),
        makeProp('Milan', Tile_types_1.ColorGroup.PURPLE, 100, 50),
    ],
    // Tier 2: residential district ($100 build cost).
    // Canada (light blue).
    [
        makeProp('Toronto', Tile_types_1.ColorGroup.LIGHT_BLUE, 160, 100),
        makeProp('Vancouver', Tile_types_1.ColorGroup.LIGHT_BLUE, 140, 100),
        makeProp('Ottawa', Tile_types_1.ColorGroup.LIGHT_BLUE, 140, 100),
    ],
    // France (teal).
    [
        makeProp('Paris', Tile_types_1.ColorGroup.TEAL, 200, 100),
        makeProp('Lyon', Tile_types_1.ColorGroup.TEAL, 180, 100),
    ],
    // Tier 3: commercial district ($150 build cost).
    // United Kingdom (pink).
    [
        makeProp('London', Tile_types_1.ColorGroup.PINK, 240, 150),
        makeProp('Leeds', Tile_types_1.ColorGroup.PINK, 220, 150),
        makeProp('Edinburgh', Tile_types_1.ColorGroup.PINK, 220, 150),
    ],
    // Germany (orange).
    [
        makeProp('Berlin', Tile_types_1.ColorGroup.ORANGE, 280, 150),
        makeProp('Frankfurt', Tile_types_1.ColorGroup.ORANGE, 260, 150),
        makeProp('Munich', Tile_types_1.ColorGroup.ORANGE, 260, 150),
    ],
    // Tier 4: financial district ($200 build cost).
    // Japan (red).
    [
        makeProp('Tokyo', Tile_types_1.ColorGroup.RED, 320, 200),
        makeProp('Osaka', Tile_types_1.ColorGroup.RED, 300, 200),
        makeProp('Kyoto', Tile_types_1.ColorGroup.RED, 300, 200),
    ],
    // China (yellow).
    [
        makeProp('Beijing', Tile_types_1.ColorGroup.YELLOW, 360, 200),
        makeProp('Shanghai', Tile_types_1.ColorGroup.YELLOW, 340, 200),
        makeProp('Shenzhen', Tile_types_1.ColorGroup.YELLOW, 340, 200),
    ],
    // United States (green).
    [
        makeProp('New York', Tile_types_1.ColorGroup.GREEN, 400, 200),
        makeProp('Houston', Tile_types_1.ColorGroup.GREEN, 380, 200),
        makeProp('Detroit', Tile_types_1.ColorGroup.GREEN, 360, 200),
    ],
    // Tier 5: luxury landmark district ($250 build cost).
    // United Arab Emirates (gray).
    [
        makeProp('Dubai', Tile_types_1.ColorGroup.GRAY, 500, 250),
        makeProp('Abu Dhabi', Tile_types_1.ColorGroup.GRAY, 450, 250),
    ],
    // Australia (dark blue).
    [
        makeProp('Sydney', Tile_types_1.ColorGroup.DARK_BLUE, 600, 250),
        makeProp('BNE', Tile_types_1.ColorGroup.DARK_BLUE, 550, 250),
    ],
];
exports.PROPERTY_TEMPLATES = exports.PROPERTY_GROUP_TEMPLATES.flat();
if (exports.PROPERTY_TEMPLATES.length !== GameConfig_1.BOARD_CONFIG.RANDOM_POOL.PROPERTY_COUNT) {
    throw new Error(`PROPERTY_TEMPLATES count mismatch: expected ${GameConfig_1.BOARD_CONFIG.RANDOM_POOL.PROPERTY_COUNT}, got ${exports.PROPERTY_TEMPLATES.length}`);
}
exports.SURPRISE_TILE_TEMPLATE = {
    name: 'Surprise',
    type: Tile_types_1.TileType.SURPRISE,
};
exports.TAX_TILE_TEMPLATE = {
    name: 'Tax',
    type: Tile_types_1.TileType.TAX,
};
//# sourceMappingURL=TileDefinitions.js.map