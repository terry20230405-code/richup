"use strict";
/**
 * Board generator.
 *
 * Algorithm:
 *   1. Create 56 slots.
 *   2. Place 10 fixed anchors at absolute indices.
 *   3. Build the 46-tile random pool:
 *      - 28 properties
 *      - 9 surprise
 *      - 9 tax
 *   4. Shuffle by chunks so each property group stays packed together.
 *   5. Fill the remaining 46 empty slots in order.
 *   6. Validate the generated board before returning it.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBoard = generateBoard;
const Tile_types_1 = require("../types/Tile.types");
const TileDefinitions_1 = require("../config/TileDefinitions");
const GameConfig_1 = require("../config/GameConfig");
const randomUtils_1 = require("../utils/randomUtils");
const FIXED_POSITIONS = new Set(Object.values(GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS));
function generateBoard() {
    const { TOTAL_TILES, RANDOM_POOL } = GameConfig_1.BOARD_CONFIG;
    const board = new Array(TOTAL_TILES).fill(null);
    for (const [id, tile] of TileDefinitions_1.FIXED_ANCHOR_TILES) {
        board[id] = tile;
    }
    const poolChunks = [
        ...TileDefinitions_1.PROPERTY_GROUP_TEMPLATES.map((group) => group.map((tile) => ({ ...tile }))),
        ...Array.from({ length: RANDOM_POOL.SURPRISE_COUNT }, () => [{ ...TileDefinitions_1.SURPRISE_TILE_TEMPLATE }]),
        ...Array.from({ length: RANDOM_POOL.TAX_COUNT }, () => [{ ...TileDefinitions_1.TAX_TILE_TEMPLATE }]),
    ];
    (0, randomUtils_1.fisherYatesShuffle)(poolChunks);
    const pool = poolChunks.flat();
    if (pool.length !== TOTAL_TILES - FIXED_POSITIONS.size) {
        throw new Error(`Random pool size mismatch: expected ${TOTAL_TILES - FIXED_POSITIONS.size}, got ${pool.length}`);
    }
    let poolIndex = 0;
    for (let i = 0; i < TOTAL_TILES; i++) {
        if (board[i] !== null) {
            continue;
        }
        const template = pool[poolIndex++];
        if (!template) {
            throw new Error(`Random pool exhausted while filling tile ${i}`);
        }
        board[i] = { ...template, id: i };
    }
    validateGeneratedBoard(board);
    return board;
}
function validateGeneratedBoard(board) {
    if (board.length !== GameConfig_1.BOARD_CONFIG.TOTAL_TILES) {
        throw new Error(`Generated board length mismatch: expected ${GameConfig_1.BOARD_CONFIG.TOTAL_TILES}, got ${board.length}`);
    }
    for (const fixedPosition of FIXED_POSITIONS) {
        if (board[fixedPosition] === null) {
            throw new Error(`Fixed anchor missing at tile ${fixedPosition}`);
        }
    }
    if (board.some((tile) => tile === null)) {
        throw new Error('Generated board contains unfilled slots');
    }
    const propertyKeys = new Set();
    let propertyCount = 0;
    let surpriseCount = 0;
    let taxCount = 0;
    for (const maybeTile of board) {
        if (maybeTile === null) {
            throw new Error('Generated board contains unfilled slots');
        }
        const tile = maybeTile;
        switch (tile.type) {
            case Tile_types_1.TileType.PROPERTY: {
                propertyCount++;
                const propertyKey = `${tile.colorGroup}:${tile.name}`;
                if (propertyKeys.has(propertyKey)) {
                    throw new Error(`Duplicate property detected in generated board: ${propertyKey}`);
                }
                propertyKeys.add(propertyKey);
                break;
            }
            case Tile_types_1.TileType.SURPRISE:
                surpriseCount++;
                break;
            case Tile_types_1.TileType.TAX:
                taxCount++;
                break;
            default:
                break;
        }
    }
    if (propertyCount !== GameConfig_1.BOARD_CONFIG.RANDOM_POOL.PROPERTY_COUNT) {
        throw new Error(`Generated property count mismatch: expected ${GameConfig_1.BOARD_CONFIG.RANDOM_POOL.PROPERTY_COUNT}, got ${propertyCount}`);
    }
    if (surpriseCount !== GameConfig_1.BOARD_CONFIG.RANDOM_POOL.SURPRISE_COUNT) {
        throw new Error(`Generated surprise count mismatch: expected ${GameConfig_1.BOARD_CONFIG.RANDOM_POOL.SURPRISE_COUNT}, got ${surpriseCount}`);
    }
    if (taxCount !== GameConfig_1.BOARD_CONFIG.RANDOM_POOL.TAX_COUNT) {
        throw new Error(`Generated tax count mismatch: expected ${GameConfig_1.BOARD_CONFIG.RANDOM_POOL.TAX_COUNT}, got ${taxCount}`);
    }
}
//# sourceMappingURL=MapGenerator.js.map