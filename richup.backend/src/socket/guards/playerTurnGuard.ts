import type { Socket } from 'socket.io';
import type { PlayerId } from '../../types/Common.types';
import type { GameSession } from '../../types/GameSession.types';
import type { S2C_ActionRejected } from '../../types/Events.types';
import { getCurrentPlayerId } from '../../state/GameSession';

/**
 * Verify the socket sender is the current turn player.
 * If not, emits ACTION_REJECTED and returns false.
 */
export function playerTurnGuard(
  socket: Socket,
  session: GameSession,
  senderId: PlayerId,
  action: string,
): boolean {
  const currentId = getCurrentPlayerId(session);
  if (currentId !== senderId) {
    const payload: S2C_ActionRejected = {
      action,
      reason: `It is not your turn`,
      code: 'NOT_YOUR_TURN',
    };
    socket.emit('ACTION_REJECTED', payload);
    return false;
  }
  return true;
}
