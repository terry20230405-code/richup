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
export declare function movePlayer(session: GameSession, playerId: PlayerId, steps: number, io: Server): MoveResult;
/**
 * Teleport a player directly to a position without awarding GO salary.
 * Used for Go-to-Jail and card effects.
 */
export declare function teleportPlayer(session: GameSession, playerId: PlayerId, targetPosition: TileId, io: Server): Tile;
/** Returns the Tile at the given position. */
export declare function getTileAt(session: GameSession, position: TileId): Tile;
/** Returns the player's current tile. */
export declare function getPlayerTile(session: GameSession, playerId: PlayerId): Tile;
/** Check if this tile type triggers an EVENT_TRIGGER phase. */
export declare function needsTileEvent(tile: Tile): boolean;
//# sourceMappingURL=MovementEngine.d.ts.map