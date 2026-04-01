import { type PropertyTile, type SurpriseTile, type TaxTile, type Tile } from '../types/Tile.types';
export declare const FIXED_ANCHOR_TILES: ReadonlyMap<number, Tile>;
/**
 * 11 countries / color groups, 28 property tiles total.
 * Each inner array represents one country and must stay packed together in the random pool.
 */
export declare const PROPERTY_GROUP_TEMPLATES: ReadonlyArray<ReadonlyArray<Omit<PropertyTile, 'id'>>>;
export declare const PROPERTY_TEMPLATES: ReadonlyArray<Omit<PropertyTile, 'id'>>;
export declare const SURPRISE_TILE_TEMPLATE: Omit<SurpriseTile, 'id'>;
export declare const TAX_TILE_TEMPLATE: Omit<TaxTile, 'id'>;
//# sourceMappingURL=TileDefinitions.d.ts.map