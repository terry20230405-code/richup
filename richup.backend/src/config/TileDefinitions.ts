import {
  ColorGroup,
  TileType,
  type AirportTile,
  type CasinoTile,
  type GoTile,
  type JailTile,
  type PropertyTile,
  type SurpriseTile,
  type TaxTile,
  type TempleTile,
  type Tile,
} from '../types/Tile.types';
import { BOARD_CONFIG } from './GameConfig';

/**
 * Static tile blueprints used by MapGenerator to initialize each game.
 *
 * Fixed anchors are written to absolute indices.
 * The remaining 46 slots are filled from the random pool:
 *   - 28 properties
 *   - 9 surprise
 *   - 9 tax
 */

const GO_TILE: GoTile = {
  id: BOARD_CONFIG.FIXED_ANCHORS.GO,
  name: 'START',
  type: TileType.GO,
};

const JAIL_TILE: JailTile = {
  id: BOARD_CONFIG.FIXED_ANCHORS.JAIL,
  name: 'JAIL',
  type: TileType.JAIL,
};

const BASE_AIRPORT_RENT = 0;

function makeAirport(id: number, name: string): AirportTile {
  return {
    id,
    name,
    type: TileType.AIRPORT,
    basePrice: 200,
    mortgageValue: 100,
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

function makeTemple(id: number, name: string): TempleTile {
  return {
    id,
    name,
    type: TileType.TEMPLE,
    ownerId: null,
    isMortgaged: false,
    basePrice: 400,
    mortgageValue: 200,
    isLit: false,
    litCount: 0,
    litThreshold: 3,
    prayFee: 300,
    passThruToll: 50,
  };
}

function makeCasino(id: number, name: string): CasinoTile {
  return {
    id,
    name,
    type: TileType.CASINO,
    betMultiple: 50,
    maxBet: 1000000,
  };
}

const AIRPORT_NORTH = makeAirport(BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_NORTH, 'Airport');
const AIRPORT_EAST = makeAirport(BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_EAST, 'Airport');
const AIRPORT_SOUTH = makeAirport(BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_SOUTH, 'Airport');
const AIRPORT_WEST = makeAirport(BOARD_CONFIG.FIXED_ANCHORS.AIRPORT_WEST, 'Airport');

const TEMPLE_A = makeTemple(BOARD_CONFIG.FIXED_ANCHORS.TEMPLE_A, 'Temple');
const TEMPLE_B = makeTemple(BOARD_CONFIG.FIXED_ANCHORS.TEMPLE_B, 'Temple');

const CASINO_A = makeCasino(BOARD_CONFIG.FIXED_ANCHORS.CASINO_A, 'Casino');
const CASINO_B = makeCasino(BOARD_CONFIG.FIXED_ANCHORS.CASINO_B, 'Casino');

export const FIXED_ANCHOR_TILES: ReadonlyMap<number, Tile> = new Map<number, Tile>([
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

function makeProp(name: string, colorGroup: ColorGroup, basePrice: number, buildCost: number): Omit<PropertyTile, 'id'> {
  // 1. 自动计算基础租金（比如地价的 10%，向下取整）
  const autoBaseRent = Math.floor(basePrice * 0.08); 

  return {
    name,
    type: TileType.PROPERTY,
    colorGroup,
    basePrice,
    buildCost,
    mortgageValue: basePrice * 0.5, // 抵押价
    buildingLevel: 0,
    isMortgaged: false,
    ownerId: null,
    
    // 2. 自动填入计算好的租金
    baseRent: autoBaseRent,
    baseRentWithMonopoly: autoBaseRent * 2, // 凑齐同色地皮租金翻倍
    
    // 3. 根据基础租金，按比例生成 0~6 级的租金数组 (倍数你可以自己调)
    rentByLevel: [
      autoBaseRent,       // 0级 (空地)
      autoBaseRent * 5,   // 1级 (1栋房子)
      autoBaseRent * 10,  // 2级 (2栋房子)
      autoBaseRent * 20,  // 3级 (3栋房子)
      autoBaseRent * 40,  // 4级 (4栋房子)
      autoBaseRent * 50, // 5级 (旅馆)
      autoBaseRent * 60  // 6级 (地标)
    ],
    
  };
}

/**
 * 11 countries / color groups, 28 property tiles total.
 * Each inner array represents one country and must stay packed together in the random pool.
 */
export const PROPERTY_GROUP_TEMPLATES: ReadonlyArray<
  ReadonlyArray<Omit<PropertyTile, 'id'>>
> = [
  // ── 第 1 档：贫民窟区 (建房成本 $50) ──
  // 韩国 (棕色)
  [
    makeProp('Seoul', ColorGroup.BROWN, 80, 50),
    makeProp('Busan', ColorGroup.BROWN, 60, 50),
  ],
  // 意大利 (紫色)
  [
    makeProp('Rome', ColorGroup.PURPLE, 120, 50),
    makeProp('Milan', ColorGroup.PURPLE, 100, 50),
  ],

  // ── 第 2 档：平民住宅区 (建房成本 $100) ──
  // 加拿大 (浅蓝)
  [
    makeProp('Toronto', ColorGroup.LIGHT_BLUE, 160, 100),
    makeProp('Vancouver', ColorGroup.LIGHT_BLUE, 140, 100),
    makeProp('Ottawa', ColorGroup.LIGHT_BLUE, 140, 100),
  ],
  // 法国 (青色)
  [
    makeProp('Paris', ColorGroup.TEAL, 200, 100),
    makeProp('Lyon', ColorGroup.TEAL, 180, 100),
  ],

  // ── 第 3 档：中产商业区 (建房成本 $150) ──
  // 英国 (粉色)
  [
    makeProp('London', ColorGroup.PINK, 240, 150),
    makeProp('Manchester', ColorGroup.PINK, 220, 150),
    makeProp('Edinburgh', ColorGroup.PINK, 220, 150),
  ],
  // 德国 (橙色)
  [
    makeProp('Berlin', ColorGroup.ORANGE, 280, 150),
    makeProp('Frankfurt', ColorGroup.ORANGE, 260, 150),
    makeProp('Munich', ColorGroup.ORANGE, 260, 150),
  ],

  // ── 第 4 档：核心金融区 (建房成本 $200) ──
  // 日本 (红色)
  [
    makeProp('Tokyo', ColorGroup.RED, 320, 200),
    makeProp('Osaka', ColorGroup.RED, 300, 200),
    makeProp('Kyoto', ColorGroup.RED, 300, 200),
  ],
  // 中国 (黄色)
  [
    makeProp('Beijing', ColorGroup.YELLOW, 360, 200),
    makeProp('Shanghai', ColorGroup.YELLOW, 340, 200),
    makeProp('Shenzhen', ColorGroup.YELLOW, 340, 200),
  ],
  // 美国 (绿色)
  [
    makeProp('New York', ColorGroup.GREEN, 400, 200),
    makeProp('Houston', ColorGroup.GREEN, 380, 200),
    makeProp('Detroit', ColorGroup.GREEN, 360, 200),
  ],

  // ── 第 5 档：奢华地标区 (建房成本 $250) ──
  // 阿联酋 (灰色)
  [
    makeProp('Dubai', ColorGroup.GRAY, 500, 250),
    makeProp('Abu Dhabi', ColorGroup.GRAY, 450, 250),
  ],
  // 澳大利亚 (深蓝)
  [
    makeProp('Sydney', ColorGroup.DARK_BLUE, 600, 250),
    makeProp('BNE', ColorGroup.DARK_BLUE, 550, 250),
  ],
];

export const PROPERTY_TEMPLATES: ReadonlyArray<Omit<PropertyTile, 'id'>> =
  PROPERTY_GROUP_TEMPLATES.flat();

if (PROPERTY_TEMPLATES.length !== BOARD_CONFIG.RANDOM_POOL.PROPERTY_COUNT) {
  throw new Error(
    `PROPERTY_TEMPLATES count mismatch: expected ${BOARD_CONFIG.RANDOM_POOL.PROPERTY_COUNT}, got ${PROPERTY_TEMPLATES.length}`,
  );
}

export const SURPRISE_TILE_TEMPLATE: Omit<SurpriseTile, 'id'> = {
  name: 'Surprise',
  type: TileType.SURPRISE,
};

export const TAX_TILE_TEMPLATE: Omit<TaxTile, 'id'> = {
  name: 'Tax',
  type: TileType.TAX,
};
