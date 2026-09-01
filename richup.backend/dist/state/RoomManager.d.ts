/**
 * In-memory room registry and JWT utilities.
 *
 * A "room" maps 1-to-1 with a GameSession (even in LOBBY status).
 * All session mutations happen in-place; no persistence layer.
 */
import type { RoomId, PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { GameStatus } from '../types/GameSession.types';
export interface SessionTokenPayload {
    playerId: PlayerId;
    roomId: RoomId;
}
export declare function issueToken(playerId: PlayerId, roomId: RoomId): string;
export declare function verifyToken(token: string): SessionTokenPayload;
export declare function createRoom(hostNickname: string): {
    roomId: RoomId;
    playerId: PlayerId;
    sessionToken: string;
};
export declare function joinRoom(roomId: RoomId, nickname: string): {
    playerId: PlayerId;
    sessionToken: string;
};
export declare function deleteRoom(roomId: RoomId, requesterId: PlayerId): void;
export interface LobbyPlayerRemovalResult {
    removed: boolean;
    roomDeleted: boolean;
    newHostId: PlayerId | null;
}
export declare function removeLobbyPlayer(roomId: RoomId, playerId: PlayerId): LobbyPlayerRemovalResult;
export declare function canStartGame(roomId: RoomId): {
    ok: boolean;
    reason?: string;
};
export declare function getSession(roomId: RoomId): GameSession | undefined;
export declare function requireSession(roomId: RoomId): GameSession;
export declare function listRooms(): Array<{
    id: RoomId;
    playerCount: number;
    status: GameStatus;
    hostNickname: string;
    createdAt: number;
}>;
export declare function registerSocket(socketId: string, playerId: PlayerId, roomId: RoomId): void;
export declare function unregisterSocket(socketId: string): {
    playerId: PlayerId;
    roomId: RoomId;
} | undefined;
export declare function getSocketContext(socketId: string): {
    playerId: PlayerId;
    roomId: RoomId;
} | undefined;
export declare function hasConnectedSocket(roomId: RoomId, playerId: PlayerId): boolean;
//# sourceMappingURL=RoomManager.d.ts.map