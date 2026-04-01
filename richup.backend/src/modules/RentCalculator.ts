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
import type { Tile, PropertyTile, AirportTile, TempleTile } from '../types/Tile.types';
import { TileType } from '../types/Tile.types';
import { requirePlayer } from '../state/GameSession';
import { NotFoundError, RuleViolationError } from '../utils/errors';

export interface RentResult {
  amount: Money;
  recipient: PlayerId | typeof BANK_ID;
}

/**
 * Compute the rent owed when `landingPlayerId` lands on `tileId`.
 * Returns { amount: 0 } if no rent is due (unowned, mortgaged, etc.)
 */
export function computeRent(
  session: GameSession,
  tileId: number,
  landingPlayerId: PlayerId,
): RentResult {
  const tile = session.board[tileId];
  if (!tile) throw new NotFoundError('Tile', tileId);

  // Only ownable tiles can charge rent
  if (!('ownerId' in tile) || !tile.ownerId) {
    return { amount: 0, recipient: BANK_ID };
  }

  // Can't charge yourself rent
  if (tile.ownerId === landingPlayerId) {
    return { amount: 0, recipient: BANK_ID };
  }

  const owner = requirePlayer(session, tile.ownerId);

  switch (tile.type) {
    case TileType.PROPERTY:
      return computePropertyRent(session, tile as PropertyTile, owner, landingPlayerId);

    case TileType.AIRPORT:
      return computeAirportRent(session, tile as AirportTile, owner);

    case TileType.TEMPLE:
      return computeTemplePassRent(tile as TempleTile, owner);

    default:
      return { amount: 0, recipient: BANK_ID };
  }
}

// ─── Property rent ────────────────────────────────────────────────────────────

function computePropertyRent(
  session: GameSession,
  tile: PropertyTile,
  owner: ReturnType<typeof requirePlayer>,
  _landingPlayerId: PlayerId,
): RentResult {
  if (tile.isMortgaged) return { amount: 0, recipient: BANK_ID };

  const { colorGroup } = tile;
  const groupTiles = session.board.filter(
    (t): t is PropertyTile => t.type === TileType.PROPERTY && t.colorGroup === colorGroup,
  );

  // Get base rent
  let baseRent: Money;
  if (tile.buildingLevel > 0) {
    baseRent = tile.rentByLevel[tile.buildingLevel - 1] ?? 0;
  } else {
    // Check for monopoly
    const ownerOwnsAll = groupTiles.every(t => t.ownerId === owner.id);
    baseRent = ownerOwnsAll ? tile.baseRentWithMonopoly : tile.baseRent;
  }

  // Cascading penalty: ratio of unmortgaged tiles in group owner has
  const ownerGroupTiles = groupTiles.filter(t => t.ownerId === owner.id);
  const unmortgaged = ownerGroupTiles.filter(t => !t.isMortgaged).length;
  const total = ownerGroupTiles.length;
  const effectiveRent: Money = total > 0
    ? Math.ceil(baseRent * (unmortgaged / total))
    : baseRent;

  // Price-hike card multiplier
  const finalRent = owner.priceHikeActive
    ? Math.ceil(effectiveRent * session.config.priceHikeMultiplier)
    : effectiveRent;

  // If owner is in jail → rent goes to BANK
  const recipient = owner.inJail ? BANK_ID : owner.id;

  return { amount: finalRent as Money, recipient };
}

// ─── Airport rent ─────────────────────────────────────────────────────────────

function computeAirportRent(
  session: GameSession,
  tile: AirportTile,
  owner: ReturnType<typeof requirePlayer>,
): RentResult {
  if (tile.isMortgaged) return { amount: 0, recipient: BANK_ID };

  // Count how many airports the owner has
  const airportCount = session.board.filter(
    (t): t is AirportTile =>
      t.type === TileType.AIRPORT && !t.isMortgaged && t.ownerId === owner.id,
  ).length;

  const tableIndex = Math.min(airportCount - 1, tile.rentTable.length - 1);
  let rent: Money = tableIndex >= 0 ? (tile.rentTable[tableIndex] ?? 0) : 0;

  // Price-hike multiplier
  if (owner.priceHikeActive) {
    rent = Math.ceil(rent * session.config.priceHikeMultiplier) as Money;
  }

  const recipient = owner.inJail ? BANK_ID : owner.id;
  return { amount: rent, recipient };
}

// ─── Temple pass-through rent ─────────────────────────────────────────────────

function computeTemplePassRent(
  tile: TempleTile,
  owner: ReturnType<typeof requirePlayer>,
): RentResult {
  if (tile.isMortgaged) return { amount: 0, recipient: BANK_ID };

  const recipient = owner.inJail ? BANK_ID : owner.id;
  return { amount: tile.passThruToll, recipient };
}

// ─── Group helpers ────────────────────────────────────────────────────────────

/**
 * Check whether the given player owns all non-mortgaged tiles in the colour group.
 */
export function hasMonopoly(
  session: GameSession,
  playerId: PlayerId,
  colorGroup: string,
): boolean {
  const groupTiles = session.board.filter(
    (t): t is PropertyTile => t.type === TileType.PROPERTY && t.colorGroup === colorGroup,
  );
  return groupTiles.length > 0 && groupTiles.every(t => t.ownerId === playerId);
}

/**
 * Check that buildings are placed "evenly" across a colour group:
 * no tile in the group may have a building level more than 1 higher than any other.
 */
export function validateEvenBuilding(
  session: GameSession,
  playerId: PlayerId,
  colorGroup: string,
): void {
  const groupTiles = session.board.filter(
    (t): t is PropertyTile =>
      t.type === TileType.PROPERTY && t.colorGroup === colorGroup && t.ownerId === playerId,
  );
  if (groupTiles.length === 0) return;

  const levels = groupTiles.map(t => t.buildingLevel);
  const min = Math.min(...levels);
  const max = Math.max(...levels);

  if (max - min > 1) {
    throw new RuleViolationError(
      `Building levels in group ${colorGroup} are uneven (min: ${min}, max: ${max})`,
    );
  }
}
