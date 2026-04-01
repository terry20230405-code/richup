import type { PlayerId, TileId, Money } from './Common.types';

/**
 * All tile types on the 56-tile board.
 */
export enum TileType {
  PROPERTY   = 'PROPERTY',    // 可购买地皮
  AIRPORT    = 'AIRPORT',     // 可购买机场（4个固定锚点）
  TEMPLE     = 'TEMPLE',      // 寺庙（2个固定锚点）
  CASINO     = 'CASINO',      // 赌场（2个固定锚点）
  TAX        = 'TAX',         // 交税区（随机填充）
  SURPRISE   = 'SURPRISE',    // 惊喜格（随机填充）
  GO         = 'GO',          // 起点（index 0）
  JAIL       = 'JAIL',        // 监狱/探视（index 28）
  GO_TO_JAIL = 'GO_TO_JAIL',  // 去监狱（如适用）
  FREE       = 'FREE',        // 无效果格
}

/**
 * Color group for properties — used for monopoly detection and cascading penalties.
 * Exact groupings are defined in TileDefinitions.ts config.
 */
export enum ColorGroup {
  BROWN      = 'BROWN',
  LIGHT_BLUE = 'LIGHT_BLUE',
  PINK       = 'PINK',
  ORANGE     = 'ORANGE',
  RED        = 'RED',
  YELLOW     = 'YELLOW',
  GREEN      = 'GREEN',
  DARK_BLUE  = 'DARK_BLUE',
  PURPLE     = 'PURPLE',
  TEAL       = 'TEAL',
  GRAY       = 'GRAY',
}

// ─── Base ────────────────────────────────────────────────────────────────────

export interface TileBase {
  id: TileId;
  name: string;
  type: TileType;
}

// ─── Property ────────────────────────────────────────────────────────────────

/**
 * Building level encoding:
 *   0 = empty lot
 *   1-4 = 1-4 houses
 *   5 = 1 hotel
 *   6 = 2 hotels
 *   7 = 3 hotels (max)
 */
export type BuildingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface PropertyTile extends TileBase {
  type: TileType.PROPERTY;
  colorGroup: ColorGroup;
  basePrice: Money;           // Placeholder; set in TileDefinitions
  mortgageValue: Money;       // = basePrice × 100% (full face value)
  buildingLevel: BuildingLevel;
  isMortgaged: boolean;
  ownerId: PlayerId | null;

  // Rent table — placeholder zeros; real values injected from TileDefinitions
  baseRent: Money;                           // 0 buildings (no monopoly)
  baseRentWithMonopoly: Money;               // 0 buildings + full color group
  rentByLevel: [Money, Money, Money, Money, Money, Money, Money]; // levels 1-7

  // Build cost per upgrade — set per city in TileDefinitions
  buildCost: Money;
}

// ─── Airport ─────────────────────────────────────────────────────────────────

export interface AirportTile extends TileBase {
  type: TileType.AIRPORT;
  basePrice: Money;
  mortgageValue: Money;
  isMortgaged: boolean;
  ownerId: PlayerId | null;

  /** Rent indexed by [ownerAirportCount - 1], e.g. rentTable[0] for 1 airport */
  rentTable: [Money, Money, Money, Money];
}

// ─── Temple ──────────────────────────────────────────────────────────────────

export interface TempleTile extends TileBase {
  type: TileType.TEMPLE;
  ownerId: PlayerId | null;
  isMortgaged: boolean;
  basePrice: Money;
  mortgageValue: Money;
  isLit: boolean;
  litCount: number;           // Private; never broadcast (only isLit is public)
  litThreshold: number;       // How many prayers to light up (placeholder)
  prayFee: Money;             // Cost per prayer (placeholder)
  passThruToll: Money;        // Fixed toll paid by non-owners (placeholder)
}

// ─── Casino ──────────────────────────────────────────────────────────────────

export interface CasinoTile extends TileBase {
  type: TileType.CASINO;
  // No owner; always belongs to BANK
  betMultiple: number;        // Minimum bet increment (placeholder; PRD = 50)
  maxBet: Money;              // Placeholder
}

// ─── Tax ─────────────────────────────────────────────────────────────────────

export interface TaxTile extends TileBase {
  type: TileType.TAX;
  // Actual deduction computed at runtime from GameConfig
}

// ─── Surprise ────────────────────────────────────────────────────────────────

export interface SurpriseTile extends TileBase {
  type: TileType.SURPRISE;
}

// ─── Special ─────────────────────────────────────────────────────────────────

export interface GoTile extends TileBase {
  type: TileType.GO;
}

export interface JailTile extends TileBase {
  type: TileType.JAIL;
}

export interface GoToJailTile extends TileBase {
  type: TileType.GO_TO_JAIL;
}

export interface FreeTile extends TileBase {
  type: TileType.FREE;
}

// ─── Union ───────────────────────────────────────────────────────────────────

export type Tile =
  | PropertyTile
  | AirportTile
  | TempleTile
  | CasinoTile
  | TaxTile
  | SurpriseTile
  | GoTile
  | JailTile
  | GoToJailTile
  | FreeTile;

/** Tiles that can be purchased by a player */
export type PurchasableTile = PropertyTile | AirportTile | TempleTile;

/** Tiles that generate rent when stepped on */
export type RentableTile = PropertyTile | AirportTile | TempleTile;

/** Type guard helpers */
export function isPropertyTile(t: Tile): t is PropertyTile  { return t.type === TileType.PROPERTY; }
export function isAirportTile(t: Tile):  t is AirportTile   { return t.type === TileType.AIRPORT; }
export function isTempleTile(t: Tile):   t is TempleTile     { return t.type === TileType.TEMPLE; }
export function isCasinoTile(t: Tile):   t is CasinoTile     { return t.type === TileType.CASINO; }
export function isTaxTile(t: Tile):      t is TaxTile        { return t.type === TileType.TAX; }
export function isSurpriseTile(t: Tile): t is SurpriseTile   { return t.type === TileType.SURPRISE; }
export function isGoTile(t: Tile):       t is GoTile          { return t.type === TileType.GO; }
export function isJailTile(t: Tile):     t is JailTile        { return t.type === TileType.JAIL; }
export function isPurchasable(t: Tile):  t is PurchasableTile {
  return t.type === TileType.PROPERTY || t.type === TileType.AIRPORT || t.type === TileType.TEMPLE;
}
