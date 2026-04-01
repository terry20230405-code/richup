import type { Socket } from 'socket.io';
import type { PlayerId } from '../../types/Common.types';
import type { GameSession } from '../../types/GameSession.types';
/**
 * Verify the socket sender is the current turn player.
 * If not, emits ACTION_REJECTED and returns false.
 */
export declare function playerTurnGuard(socket: Socket, session: GameSession, senderId: PlayerId, action: string): boolean;
//# sourceMappingURL=playerTurnGuard.d.ts.map