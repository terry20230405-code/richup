/**
 * Movement engine.
 *
 * Handles player movement around the board, GO crossing detection,
 * and landing position resolution.
 */

import type { Server } from 'socket.io';
import type { PlayerId, TileId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import type { Tile } from '../types/Tile.types';
import { TileType } from '../types/Tile.types';
import type { S2C_PlayerMoved, S2C_StartPassed, S2C_StartLanded } from '../types/Events.types';
import { BOARD_CONFIG } from '../config/GameConfig';
import { requirePlayer, cashChange } from '../state/GameSession';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { logger } from '../utils/logger';

const BOARD_SIZE = BOARD_CONFIG.TOTAL_TILES;
const GO_POSITION = BOARD_CONFIG.FIXED_ANCHORS.GO;

export interface MoveResult {
  newPosition: TileId;
  passedGo: boolean;
  landedOnGo: boolean;
  landedTile: Tile;
}

/**
 * Move a player by `steps` positions around the board.
 * Handles GO crossing, GO landing bonus, and emits PLAYER_MOVED.
 */
export function movePlayer(
  session: GameSession,
  playerId: PlayerId,
  steps: number,
  io: Server,
): MoveResult {
  const player = requirePlayer(session, playerId);
  const fromPosition = player.position;
  const rawNext = (fromPosition + steps) % BOARD_SIZE;

  // Detect GO crossing (wrapping around position 0)
  const passedGo = rawNext < fromPosition && fromPosition + steps >= BOARD_SIZE;
  const landedOnGo = rawNext === GO_POSITION;

  player.previousPosition = fromPosition;
  player.position = rawNext;

  const movedPayload: S2C_PlayerMoved = {
    playerId,
    fromPosition,
    toPosition: rawNext,
    passedGo: passedGo || landedOnGo,
  };
  broadcastToRoom(io, session.id, 'PLAYER_MOVED', movedPayload);

  // Award GO bonuses
  if (landedOnGo) {
    // Exactly landed on GO: pass bonus + land bonus
    const passBonusAmount = session.config.goSalary;
    const landBonusAmount = session.config.goLandBonus;
    cashChange(session, playerId, passBonusAmount + landBonusAmount, 'GO_LAND', io);

    const startLandedPayload: S2C_StartLanded = { playerId, passBonusAmount, landBonusAmount };
    broadcastToRoom(io, session.id, 'START_LANDED', startLandedPayload);
  } else if (passedGo) {
    // Passed over GO: only pass salary
    const bonusAmount = session.config.goSalary;
    cashChange(session, playerId, bonusAmount, 'GO_PASS', io);

    const startPassedPayload: S2C_StartPassed = { playerId, bonusAmount };
    broadcastToRoom(io, session.id, 'START_PASSED', startPassedPayload);
  }

  const landedTile = session.board[rawNext]!;
  logger.debug(
    { roomId: session.id, playerId, fromPosition, toPosition: rawNext, passedGo, landedOnGo },
    'Player moved',
  );

  return { newPosition: rawNext, passedGo: passedGo || landedOnGo, landedOnGo, landedTile };
}

/**
 * Teleport a player directly to a position without awarding GO salary.
 * Used for Go-to-Jail and card effects.
 */
export function teleportPlayer(
  session: GameSession,
  playerId: PlayerId,
  targetPosition: TileId,
  io: Server,
): Tile {
  const player = requirePlayer(session, playerId);
  player.previousPosition = player.position;
  player.position = targetPosition;

  const movedPayload: S2C_PlayerMoved = {
    playerId,
    fromPosition: player.previousPosition,
    toPosition: targetPosition,
    passedGo: false,
  };
  broadcastToRoom(io, session.id, 'PLAYER_MOVED', movedPayload);

  return session.board[targetPosition]!;
}

/** Returns the Tile at the given position. */
export function getTileAt(session: GameSession, position: TileId): Tile {
  const tile = session.board[position];
  if (!tile) throw new Error(`No tile at position ${position}`);
  return tile;
}

/** Returns the player's current tile. */
export function getPlayerTile(session: GameSession, playerId: PlayerId): Tile {
  const player = requirePlayer(session, playerId);
  return getTileAt(session, player.position);
}

/** Check if this tile type triggers an EVENT_TRIGGER phase. */
export function needsTileEvent(tile: Tile): boolean {
  return [
    TileType.PROPERTY,
    TileType.AIRPORT,
    TileType.TEMPLE,
    TileType.CASINO,
    TileType.TAX,
    TileType.SURPRISE,
    TileType.JAIL,
  ].includes(tile.type);
}
