/**
 * Building and mortgage management.
 *
 * Covers:
 *  - BUILD_HOUSE / BUILD_HOTEL (with even-building validation)
 *  - SELL_BUILDING
 *  - MORTGAGE / UNMORTGAGE
 */
import type { Server } from 'socket.io';
import type { PlayerId, TileId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
/** Build one house on the specified tile. */
export declare function buildHouse(session: GameSession, playerId: PlayerId, tileId: TileId, io: Server): void;
/** Upgrade beyond houses (level 4 → 5 → 6). */
export declare function buildHotel(session: GameSession, playerId: PlayerId, tileId: TileId, io: Server): void;
export declare function sellBuilding(session: GameSession, playerId: PlayerId, tileId: TileId, io: Server): void;
export declare function mortgageProperty(session: GameSession, playerId: PlayerId, tileId: TileId, io: Server): void;
export declare function unmortgageProperty(session: GameSession, playerId: PlayerId, tileId: TileId, io: Server): void;
//# sourceMappingURL=BuildingManager.d.ts.map