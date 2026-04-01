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
import type { Tile } from '../types/Tile.types';
export declare function generateBoard(): Tile[];
//# sourceMappingURL=MapGenerator.d.ts.map