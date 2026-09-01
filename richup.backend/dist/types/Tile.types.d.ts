import type { PlayerId, TileId, Money } from './Common.types';
/**
 * All tile types on the 56-tile board.
 */
export declare enum TileType {
    PROPERTY = "PROPERTY",// Purchasable property.
    AIRPORT = "AIRPORT",// Purchasable airport at one of four fixed anchors.
    TEMPLE = "TEMPLE",// Temple at one of two fixed anchors.
    CASINO = "CASINO",// Casino at one of two fixed anchors.
    TAX = "TAX",// Tax tile in the randomized pool.
    SURPRISE = "SURPRISE",// Surprise tile in the randomized pool.
    GO = "GO",// Start tile at index 0.
    JAIL = "JAIL",// Jail or visiting tile at index 28.
    GO_TO_JAIL = "GO_TO_JAIL",// Sends a player to jail when used.
    FREE = "FREE"
}
/**
 * Color group for properties — used for monopoly detection and cascading penalties.
 * Exact groupings are defined in TileDefinitions.ts config.
 */
export declare enum ColorGroup {
    BROWN = "BROWN",
    LIGHT_BLUE = "LIGHT_BLUE",
    PINK = "PINK",
    ORANGE = "ORANGE",
    RED = "RED",
    YELLOW = "YELLOW",
    GREEN = "GREEN",
    DARK_BLUE = "DARK_BLUE",
    PURPLE = "PURPLE",
    TEAL = "TEAL",
    GRAY = "GRAY"
}
export interface TileBase {
    id: TileId;
    name: string;
    type: TileType;
}
/**
 * Building level encoding:
 *   0 = empty lot
 *   1-4 = 1-4 houses
 *   5 = hotel
 *   6 = landmark (max)
 */
export type BuildingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export interface PropertyTile extends TileBase {
    type: TileType.PROPERTY;
    colorGroup: ColorGroup;
    basePrice: Money;
    mortgageValue: Money;
    buildingLevel: BuildingLevel;
    isMortgaged: boolean;
    ownerId: PlayerId | null;
    baseRent: Money;
    baseRentWithMonopoly: Money;
    rentByLevel: [Money, Money, Money, Money, Money, Money, Money];
    buildCost: Money;
}
export interface AirportTile extends TileBase {
    type: TileType.AIRPORT;
    basePrice: Money;
    mortgageValue: Money;
    isMortgaged: boolean;
    ownerId: PlayerId | null;
    /** Rent indexed by [ownerAirportCount - 1], e.g. rentTable[0] for 1 airport */
    rentTable: [Money, Money, Money, Money];
}
export interface TempleTile extends TileBase {
    type: TileType.TEMPLE;
    ownerId: PlayerId | null;
    isMortgaged: boolean;
    basePrice: Money;
    mortgageValue: Money;
    isLit: boolean;
    litCount: number;
    litThreshold: number;
    prayFee: Money;
    passThruToll: Money;
}
export interface CasinoTile extends TileBase {
    type: TileType.CASINO;
    betMultiple: number;
    maxBet: Money;
}
export interface TaxTile extends TileBase {
    type: TileType.TAX;
}
export interface SurpriseTile extends TileBase {
    type: TileType.SURPRISE;
}
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
export type Tile = PropertyTile | AirportTile | TempleTile | CasinoTile | TaxTile | SurpriseTile | GoTile | JailTile | GoToJailTile | FreeTile;
/**
 * Broadcast-safe tile shape. Temple progress is intentionally private; only
 * the derived `isLit` state is exposed to clients.
 */
export type TilePublicView = PropertyTile | AirportTile | Omit<TempleTile, 'litCount'> | CasinoTile | TaxTile | SurpriseTile | GoTile | JailTile | GoToJailTile | FreeTile;
/** Tiles that can be purchased by a player */
export type PurchasableTile = PropertyTile | AirportTile | TempleTile;
/** Tiles that generate rent when stepped on */
export type RentableTile = PropertyTile | AirportTile | TempleTile;
/** Type guard helpers */
export declare function isPropertyTile(t: Tile): t is PropertyTile;
export declare function isAirportTile(t: Tile): t is AirportTile;
export declare function isTempleTile(t: Tile): t is TempleTile;
export declare function isCasinoTile(t: Tile): t is CasinoTile;
export declare function isTaxTile(t: Tile): t is TaxTile;
export declare function isSurpriseTile(t: Tile): t is SurpriseTile;
export declare function isGoTile(t: Tile): t is GoTile;
export declare function isJailTile(t: Tile): t is JailTile;
export declare function isPurchasable(t: Tile): t is PurchasableTile;
//# sourceMappingURL=Tile.types.d.ts.map