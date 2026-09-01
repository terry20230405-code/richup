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
import { BOARD_CONFIG, DEFAULT_GAME_CONFIG } from './GameConfig';

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

const BASE_AIRPORT_RENT = 30;

function makeAirport(id: number, name: string): AirportTile {
  return {
    id,
    name,
    type: TileType.AIRPORT,
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
    litThreshold: DEFAULT_GAME_CONFIG.templeLitThreshold,
    prayFee: DEFAULT_GAME_CONFIG.templePrayFee,
    passThruToll: DEFAULT_GAME_CONFIG.templePassThruToll,
  };
}

function makeCasino(id: number, name: string): CasinoTile {
  return {
    id,
    name,
    type: TileType.CASINO,
    betMultiple: DEFAULT_GAME_CONFIG.casinoBetMultiple,
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
  // 1. Calculate base rent automatically as 10% of the property price.
  const autoBaseRent = Math.floor(basePrice * 0.08); 

  return {
    name,
    type: TileType.PROPERTY,
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
      autoBaseRent,       // Level 0: undeveloped.
      autoBaseRent * 5,   // Level 1: one house.
      autoBaseRent * 10,  // Level 2: two houses.
      autoBaseRent * 20,  // Level 3: three houses.
      autoBaseRent * 40,  // Level 4: four houses.
      autoBaseRent * 50,  // Level 5: hotel.
      autoBaseRent * 60,  // Level 6: landmark.
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
  // Tier 1: entry-level district ($50 build cost).
  // South Korea (brown).
  [
    makeProp('Seoul', ColorGroup.BROWN, 80, 50),
    makeProp('Busan', ColorGroup.BROWN, 60, 50),
  ],
  // Italy (purple).
  [
    makeProp('Rome', ColorGroup.PURPLE, 120, 50),
    makeProp('Milan', ColorGroup.PURPLE, 100, 50),
  ],

  // Tier 2: residential district ($100 build cost).
  // Canada (light blue).
  [
    makeProp('Toronto', ColorGroup.LIGHT_BLUE, 160, 100),
    makeProp('Vancouver', ColorGroup.LIGHT_BLUE, 140, 100),
    makeProp('Ottawa', ColorGroup.LIGHT_BLUE, 140, 100),
  ],
  // France (teal).
  [
    makeProp('Paris', ColorGroup.TEAL, 200, 100),
    makeProp('Lyon', ColorGroup.TEAL, 180, 100),
  ],

  // Tier 3: commercial district ($150 build cost).
  // United Kingdom (pink).
  [
    makeProp('London', ColorGroup.PINK, 240, 150),
    makeProp('Leeds', ColorGroup.PINK, 220, 150),
    makeProp('Edinburgh', ColorGroup.PINK, 220, 150),
  ],
  // Germany (orange).
  [
    makeProp('Berlin', ColorGroup.ORANGE, 280, 150),
    makeProp('Frankfurt', ColorGroup.ORANGE, 260, 150),
    makeProp('Munich', ColorGroup.ORANGE, 260, 150),
  ],

  // Tier 4: financial district ($200 build cost).
  // Japan (red).
  [
    makeProp('Tokyo', ColorGroup.RED, 320, 200),
    makeProp('Osaka', ColorGroup.RED, 300, 200),
    makeProp('Kyoto', ColorGroup.RED, 300, 200),
  ],
  // China (yellow).
  [
    makeProp('Beijing', ColorGroup.YELLOW, 360, 200),
    makeProp('Shanghai', ColorGroup.YELLOW, 340, 200),
    makeProp('Shenzhen', ColorGroup.YELLOW, 340, 200),
  ],
  // United States (green).
  [
    makeProp('New York', ColorGroup.GREEN, 400, 200),
    makeProp('Houston', ColorGroup.GREEN, 380, 200),
    makeProp('Detroit', ColorGroup.GREEN, 360, 200),
  ],

  // Tier 5: luxury landmark district ($250 build cost).
  // United Arab Emirates (gray).
  [
    makeProp('Dubai', ColorGroup.GRAY, 500, 250),
    makeProp('Abu Dhabi', ColorGroup.GRAY, 450, 250),
  ],
  // Australia (dark blue).
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
