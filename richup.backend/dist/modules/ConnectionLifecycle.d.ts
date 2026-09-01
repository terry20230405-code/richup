import type { Server } from 'socket.io';
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
export declare function broadcastLobbyState(session: GameSession, io: Server): void;
export declare function scheduleLobbyReservation(session: GameSession, playerId: PlayerId, io: Server): void;
export declare function handleLastSocketDisconnect(session: GameSession, playerId: PlayerId, io: Server): void;
//# sourceMappingURL=ConnectionLifecycle.d.ts.map