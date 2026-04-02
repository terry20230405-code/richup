/**
 * Building and mortgage management.
 *
 * Covers:
 *  - BUILD_HOUSE / BUILD_HOTEL (with even-building validation)
 *  - SELL_BUILDING
 *  - MORTGAGE / UNMORTGAGE
 */

import type { Server } from 'socket.io';
import type { PlayerId, TileId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import type { PropertyTile } from '../types/Tile.types';
import { TileType } from '../types/Tile.types';
import type {
  S2C_BuildingBuilt,
  S2C_BuildingSold,
  S2C_PropertyMortgaged,
  S2C_PropertyUnmortgaged,
} from '../types/Events.types';
import { requirePlayer, cashChange } from '../state/GameSession';
import { assertNotBidLocked } from './AuctionManager';
import { hasMonopoly, validateEvenBuilding } from './RentCalculator';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { NotFoundError, RuleViolationError, InsufficientFundsError } from '../utils/errors';
import { logger } from '../utils/logger';

const MAX_HOUSE_LEVEL = 4;
const HOTEL_LEVEL = 5;     // level 5 = 1 hotel; 6 = 2 hotels; 7 = 3 hotels per PRD
const MAX_LEVEL = 7;

// ─── Build ────────────────────────────────────────────────────────────────────

/** Build one house on the specified tile. */
export function buildHouse(
  session: GameSession,
  playerId: PlayerId,
  tileId: TileId,
  io: Server,
): void {
  const tile = requireOwnedProperty(session, tileId, playerId);

  if (!hasMonopoly(session, playerId, tile.colorGroup)) {
    throw new RuleViolationError(`Must own all tiles in colour group ${tile.colorGroup} to build`);
  }
  if (tile.buildingLevel >= MAX_HOUSE_LEVEL) {
    throw new RuleViolationError('Must build a hotel, not more houses');
  }
  if (tile.buildingLevel >= MAX_LEVEL) {
    throw new RuleViolationError('Already at maximum building level');
  }

  validateEvenBuilding(session, playerId, tile.colorGroup);

  const cost = tile.buildCost;
  const player = requirePlayer(session, playerId);
  if (player.cash < cost) throw new InsufficientFundsError(playerId, cost, player.cash);

  assertNotBidLocked(session, playerId, cost as Money);

  tile.buildingLevel++;
  cashChange(session, playerId, -cost as Money, 'BUILD_HOUSE', io);

  const payload: S2C_BuildingBuilt = {
    tileId,
    ownerId: playerId,
    cost: cost as Money,
    newBuildingLevel: tile.buildingLevel,
  };
  broadcastToRoom(io, session.id, 'BUILDING_BUILT', payload);
  logger.debug({ roomId: session.id, playerId, tileId, level: tile.buildingLevel }, 'House built');
}

/** Build a hotel (upgrade from level 4 → 5, or 5→6, 6→7). */
export function buildHotel(
  session: GameSession,
  playerId: PlayerId,
  tileId: TileId,
  io: Server,
): void {
  const tile = requireOwnedProperty(session, tileId, playerId);

  if (!hasMonopoly(session, playerId, tile.colorGroup)) {
    throw new RuleViolationError(`Must own all tiles in colour group ${tile.colorGroup} to build`);
  }
  if (tile.buildingLevel < MAX_HOUSE_LEVEL) {
    throw new RuleViolationError('Must have 4 houses before building a hotel');
  }
  if (tile.buildingLevel >= MAX_LEVEL) {
    throw new RuleViolationError('Already at maximum building level');
  }

  validateEvenBuilding(session, playerId, tile.colorGroup);

  const cost = tile.buildCost;
  const player = requirePlayer(session, playerId);
  if (player.cash < cost) throw new InsufficientFundsError(playerId, cost, player.cash);

  assertNotBidLocked(session, playerId, cost as Money);

  tile.buildingLevel++;
  cashChange(session, playerId, -cost as Money, 'BUILD_HOTEL', io);

  const payload: S2C_BuildingBuilt = {
    tileId,
    ownerId: playerId,
    cost: cost as Money,
    newBuildingLevel: tile.buildingLevel,
  };
  broadcastToRoom(io, session.id, 'BUILDING_BUILT', payload);
}

// ─── Sell building ────────────────────────────────────────────────────────────

export function sellBuilding(
  session: GameSession,
  playerId: PlayerId,
  tileId: TileId,
  io: Server,
): void {
  const tile = requireOwnedProperty(session, tileId, playerId);

  if (tile.buildingLevel === 0) throw new RuleViolationError('No buildings to sell');

  const refund = Math.floor(tile.buildCost * session.config.buildingRefundRate) as Money;
  tile.buildingLevel--;

  cashChange(session, playerId, refund, 'SELL_BUILDING', io);

  const payload: S2C_BuildingSold = {
    tileId,
    ownerId: playerId,
    refund,
    newBuildingLevel: tile.buildingLevel,
  };
  broadcastToRoom(io, session.id, 'BUILDING_SOLD', payload);
}

// ─── Mortgage ─────────────────────────────────────────────────────────────────

export function mortgageProperty(
  session: GameSession,
  playerId: PlayerId,
  tileId: TileId,
  io: Server,
): void {
  const tile = requireOwnedProperty(session, tileId, playerId);

  if (tile.isMortgaged) throw new RuleViolationError('Tile is already mortgaged');
  if (tile.buildingLevel > 0) throw new RuleViolationError('Must sell all buildings before mortgaging');

  tile.isMortgaged = true;
  cashChange(session, playerId, tile.mortgageValue, 'MORTGAGE', io);

  const payload: S2C_PropertyMortgaged = {
    tileId,
    playerId,
    mortgageValue: tile.mortgageValue,
  };
  broadcastToRoom(io, session.id, 'PROPERTY_MORTGAGED', payload);
}

export function unmortgageProperty(
  session: GameSession,
  playerId: PlayerId,
  tileId: TileId,
  io: Server,
): void {
  const tile = requireOwnedProperty(session, tileId, playerId);

  if (!tile.isMortgaged) throw new RuleViolationError('Tile is not mortgaged');

  const redemptionCost = Math.ceil(
    tile.mortgageValue * (1 + session.config.mortgageInterestRate),
  ) as Money;

  const player = requirePlayer(session, playerId);
  if (player.cash < redemptionCost) {
    throw new InsufficientFundsError(playerId, redemptionCost, player.cash);
  }

  assertNotBidLocked(session, playerId, redemptionCost);

  tile.isMortgaged = false;
  cashChange(session, playerId, -redemptionCost, 'UNMORTGAGE', io);

  const payload: S2C_PropertyUnmortgaged = { tileId, playerId, redemptionCost };
  broadcastToRoom(io, session.id, 'PROPERTY_UNMORTGAGED', payload);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireOwnedProperty(
  session: GameSession,
  tileId: TileId,
  playerId: PlayerId,
): PropertyTile {
  const tile = session.board[tileId];
  if (!tile) throw new NotFoundError('Tile', tileId);
  if (tile.type !== TileType.PROPERTY) throw new RuleViolationError('Tile is not a property');

  const prop = tile as PropertyTile;
  if (prop.ownerId !== playerId) throw new RuleViolationError('You do not own this tile');
  return prop;
}

