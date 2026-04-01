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
    name: '起点',
    type: Tile_types_1.TileType.GO,
};
const JAIL_TILE = {
    id: GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.JAIL,
    name: '监狱/探视',
    type: Tile_types_1.TileType.JAIL,
};
const BASE_AIRPORT_RENT = 0;
function makeAirport(id, name) {
    return {
        id,
        name,
        type: Tile_types_1.TileType.AIRPORT,
        basePrice: 0,
        mortgageValue: 0,
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
        basePrice: 0,
        mortgageValue: 0,
        isLit: false,
        litCount: 0,
        litThreshold: 3,
        prayFee: 0,
        passThruToll: 0,
    };
}
function makeCasino(id, name) {
    return {
        id,
        name,
        type: Tile_types_1.TileType.CASINO,
        betMultiple: 50,
        maxBet: 0,
    };
}
const AIRPORT_NORTH = makeAirport(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_NORTH, '北方机场（飞机场1）');
const AIRPORT_EAST = makeAirport(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_EAST, '东方机场（飞机场4）');
const AIRPORT_SOUTH = makeAirport(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_SOUTH, '南方机场（飞机场2）');
const AIRPORT_WEST = makeAirport(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_WEST, '西方机场（飞机场3）');
const TEMPLE_A = makeTemple(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.TEMPLE_A, '东方古寺（寺庙A）');
const TEMPLE_B = makeTemple(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.TEMPLE_B, '西方古寺（寺庙B）');
const CASINO_A = makeCasino(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.CASINO_A, '西部赌场（赌场A）');
const CASINO_B = makeCasino(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.CASINO_B, '东部赌场（赌场B）');
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
function makeProp(name, colorGroup) {
    return {
        name,
        type: Tile_types_1.TileType.PROPERTY,
        colorGroup,
        basePrice: 0,
        mortgageValue: 0,
        buildingLevel: 0,
        isMortgaged: false,
        ownerId: null,
        baseRent: 0,
        baseRentWithMonopoly: 0,
        rentByLevel: [0, 0, 0, 0, 0, 0, 0],
    };
}
/**
 * 11 countries / color groups, 28 property tiles total.
 * Each inner array represents one country and must stay packed together in the random pool.
 */
exports.PROPERTY_GROUP_TEMPLATES = [
    [
        makeProp('棕色街1', Tile_types_1.ColorGroup.BROWN),
        makeProp('棕色街2', Tile_types_1.ColorGroup.BROWN),
    ],
    [
        makeProp('浅蓝街1', Tile_types_1.ColorGroup.LIGHT_BLUE),
        makeProp('浅蓝街2', Tile_types_1.ColorGroup.LIGHT_BLUE),
        makeProp('浅蓝街3', Tile_types_1.ColorGroup.LIGHT_BLUE),
    ],
    [
        makeProp('粉红街1', Tile_types_1.ColorGroup.PINK),
        makeProp('粉红街2', Tile_types_1.ColorGroup.PINK),
        makeProp('粉红街3', Tile_types_1.ColorGroup.PINK),
    ],
    [
        makeProp('橙色街1', Tile_types_1.ColorGroup.ORANGE),
        makeProp('橙色街2', Tile_types_1.ColorGroup.ORANGE),
        makeProp('橙色街3', Tile_types_1.ColorGroup.ORANGE),
    ],
    [
        makeProp('红色街1', Tile_types_1.ColorGroup.RED),
        makeProp('红色街2', Tile_types_1.ColorGroup.RED),
        makeProp('红色街3', Tile_types_1.ColorGroup.RED),
    ],
    [
        makeProp('黄色街1', Tile_types_1.ColorGroup.YELLOW),
        makeProp('黄色街2', Tile_types_1.ColorGroup.YELLOW),
        makeProp('黄色街3', Tile_types_1.ColorGroup.YELLOW),
    ],
    [
        makeProp('绿色街1', Tile_types_1.ColorGroup.GREEN),
        makeProp('绿色街2', Tile_types_1.ColorGroup.GREEN),
        makeProp('绿色街3', Tile_types_1.ColorGroup.GREEN),
    ],
    [
        makeProp('深蓝街1', Tile_types_1.ColorGroup.DARK_BLUE),
        makeProp('深蓝街2', Tile_types_1.ColorGroup.DARK_BLUE),
    ],
    [
        makeProp('紫色街1', Tile_types_1.ColorGroup.PURPLE),
        makeProp('紫色街2', Tile_types_1.ColorGroup.PURPLE),
    ],
    [
        makeProp('青色街1', Tile_types_1.ColorGroup.TEAL),
        makeProp('青色街2', Tile_types_1.ColorGroup.TEAL),
    ],
    [
        makeProp('灰色街1', Tile_types_1.ColorGroup.GRAY),
        makeProp('灰色街2', Tile_types_1.ColorGroup.GRAY),
    ],
];
exports.PROPERTY_TEMPLATES = exports.PROPERTY_GROUP_TEMPLATES.flat();
if (exports.PROPERTY_TEMPLATES.length !== GameConfig_1.BOARD_CONFIG.RANDOM_POOL.PROPERTY_COUNT) {
    throw new Error(`PROPERTY_TEMPLATES count mismatch: expected ${GameConfig_1.BOARD_CONFIG.RANDOM_POOL.PROPERTY_COUNT}, got ${exports.PROPERTY_TEMPLATES.length}`);
}
exports.SURPRISE_TILE_TEMPLATE = {
    name: '惊喜格',
    type: Tile_types_1.TileType.SURPRISE,
};
exports.TAX_TILE_TEMPLATE = {
    name: '交税格',
    type: Tile_types_1.TileType.TAX,
};
//# sourceMappingURL=TileDefinitions.js.map