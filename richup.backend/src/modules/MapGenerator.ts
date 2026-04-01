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

import type { PropertyTile, SurpriseTile, TaxTile, Tile } from '../types/Tile.types';
import { TileType } from '../types/Tile.types';
import {
  FIXED_ANCHOR_TILES,
  PROPERTY_GROUP_TEMPLATES,
  SURPRISE_TILE_TEMPLATE,
  TAX_TILE_TEMPLATE,
} from '../config/TileDefinitions';
import { BOARD_CONFIG } from '../config/GameConfig';
import { fisherYatesShuffle } from '../utils/randomUtils';

type RandomPoolTile = Omit<PropertyTile, 'id'> | Omit<SurpriseTile, 'id'> | Omit<TaxTile, 'id'>;
type RandomPoolChunk = RandomPoolTile[];

const FIXED_POSITIONS = new Set(Object.values(BOARD_CONFIG.FIXED_ANCHORS));

export function generateBoard(): Tile[] {
  const { TOTAL_TILES, RANDOM_POOL } = BOARD_CONFIG;
  const board: (Tile | null)[] = new Array<null>(TOTAL_TILES).fill(null);

  for (const [id, tile] of FIXED_ANCHOR_TILES) {
    board[id] = tile;
  }

  const poolChunks: RandomPoolChunk[] = [
    ...PROPERTY_GROUP_TEMPLATES.map((group) => group.map((tile) => ({ ...tile }))),
    ...Array.from({ length: RANDOM_POOL.SURPRISE_COUNT }, () => [{ ...SURPRISE_TILE_TEMPLATE }]),
    ...Array.from({ length: RANDOM_POOL.TAX_COUNT }, () => [{ ...TAX_TILE_TEMPLATE }]),
  ];

  fisherYatesShuffle(poolChunks);
  const pool = poolChunks.flat();

  if (pool.length !== TOTAL_TILES - FIXED_POSITIONS.size) {
    throw new Error(
      `Random pool size mismatch: expected ${TOTAL_TILES - FIXED_POSITIONS.size}, got ${pool.length}`,
    );
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

    board[i] = { ...template, id: i } as Tile;
  }

  validateGeneratedBoard(board);
  return board;
}

function validateGeneratedBoard(board: (Tile | null)[]): asserts board is Tile[] {
  if (board.length !== BOARD_CONFIG.TOTAL_TILES) {
    throw new Error(
      `Generated board length mismatch: expected ${BOARD_CONFIG.TOTAL_TILES}, got ${board.length}`,
    );
  }

  for (const fixedPosition of FIXED_POSITIONS) {
    if (board[fixedPosition] === null) {
      throw new Error(`Fixed anchor missing at tile ${fixedPosition}`);
    }
  }

  if (board.some((tile) => tile === null)) {
    throw new Error('Generated board contains unfilled slots');
  }

  const propertyKeys = new Set<string>();
  let propertyCount = 0;
  let surpriseCount = 0;
  let taxCount = 0;

  for (const maybeTile of board) {
    if (maybeTile === null) {
      throw new Error('Generated board contains unfilled slots');
    }

    const tile = maybeTile;

    switch (tile.type) {
      case TileType.PROPERTY: {
        propertyCount++;
        const propertyKey = `${tile.colorGroup}:${tile.name}`;
        if (propertyKeys.has(propertyKey)) {
          throw new Error(`Duplicate property detected in generated board: ${propertyKey}`);
        }
        propertyKeys.add(propertyKey);
        break;
      }
      case TileType.SURPRISE:
        surpriseCount++;
        break;
      case TileType.TAX:
        taxCount++;
        break;
      default:
        break;
    }
  }

  if (propertyCount !== BOARD_CONFIG.RANDOM_POOL.PROPERTY_COUNT) {
    throw new Error(
      `Generated property count mismatch: expected ${BOARD_CONFIG.RANDOM_POOL.PROPERTY_COUNT}, got ${propertyCount}`,
    );
  }

  if (surpriseCount !== BOARD_CONFIG.RANDOM_POOL.SURPRISE_COUNT) {
    throw new Error(
      `Generated surprise count mismatch: expected ${BOARD_CONFIG.RANDOM_POOL.SURPRISE_COUNT}, got ${surpriseCount}`,
    );
  }

  if (taxCount !== BOARD_CONFIG.RANDOM_POOL.TAX_COUNT) {
    throw new Error(
      `Generated tax count mismatch: expected ${BOARD_CONFIG.RANDOM_POOL.TAX_COUNT}, got ${taxCount}`,
    );
  }
}
