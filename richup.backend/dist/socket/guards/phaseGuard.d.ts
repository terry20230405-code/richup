import type { Socket } from 'socket.io';
import type { GameSession } from '../../types/GameSession.types';
import { TurnPhase } from '../../types/GameSession.types';
/**
 * Verify the session is in one of the allowed phases.
 * If not, emits ACTION_REJECTED and returns false.
 */
export declare function phaseGuard(socket: Socket, session: GameSession, allowedPhases: TurnPhase[], action: string): boolean;
//# sourceMappingURL=phaseGuard.d.ts.map