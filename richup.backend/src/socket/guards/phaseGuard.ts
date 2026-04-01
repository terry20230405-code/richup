import type { Socket } from 'socket.io';
import type { GameSession } from '../../types/GameSession.types';
import { TurnPhase } from '../../types/GameSession.types';
import type { S2C_ActionRejected } from '../../types/Events.types';
import { PhaseViolationError } from '../../utils/errors';

/**
 * Verify the session is in one of the allowed phases.
 * If not, emits ACTION_REJECTED and returns false.
 */
export function phaseGuard(
  socket: Socket,
  session: GameSession,
  allowedPhases: TurnPhase[],
  action: string,
): boolean {
  if (!allowedPhases.includes(session.currentPhase)) {
    const payload: S2C_ActionRejected = {
      action,
      reason: `Action "${action}" not allowed in phase "${session.currentPhase}"`,
      code: 'WRONG_PHASE',
    };
    socket.emit('ACTION_REJECTED', payload);
    return false;
  }
  return true;
}
