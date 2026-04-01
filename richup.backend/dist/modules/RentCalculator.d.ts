/**
 * Rent calculation engine.
 *
 * Calculation chain (per PRD):
 *   1. Tile is mortgaged → 0
 *   2. Base rent by building level
 *   3. Monopoly bonus (owns all tiles in colour group AND buildingLevel === 0 → ×2)
 *   4. Airport: rent table indexed by number of airports the owner has
 *   5. Temple: prayFee (owner praying) or passThruToll (non-owner landing)
 *   6. Cascading penalty: effectiveRent = baseRent × (unmortgaged / totalInGroup)
 *   7. Price-hike card: if owner.priceHikeActive → ceil(rent × multiplier)
 *   8. Owner in jail → rent goes to BANK (return BANK_ID as recipient)
 */
import type { PlayerId, Money } from '../types/Common.types';
import { BANK_ID } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
export interface RentResult {
    amount: Money;
    recipient: PlayerId | typeof BANK_ID;
}
/**
 * Compute the rent owed when `landingPlayerId` lands on `tileId`.
 * Returns { amount: 0 } if no rent is due (unowned, mortgaged, etc.)
 */
export declare function computeRent(session: GameSession, tileId: number, landingPlayerId: PlayerId): RentResult;
/**
 * Check whether the given player owns all non-mortgaged tiles in the colour group.
 */
export declare function hasMonopoly(session: GameSession, playerId: PlayerId, colorGroup: string): boolean;
/**
 * Check that buildings are placed "evenly" across a colour group:
 * no tile in the group may have a building level more than 1 higher than any other.
 */
export declare function validateEvenBuilding(session: GameSession, playerId: PlayerId, colorGroup: string): void;
//# sourceMappingURL=RentCalculator.d.ts.map