import type { Server } from 'socket.io';
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { TurnPhase } from '../types/GameSession.types';
import type { S2C_TurnStarted } from '../types/Events.types';
import { advanceTurn, getCurrentPlayerId, requirePlayer } from '../state/GameSession';
import { StateMachine } from '../state/StateMachine';
import { broadcastToRoom } from '../socket/emitters/broadcast';

/** Complete a landing event and either grant an extra roll or end the turn. */
export function resolveAfterLanding(session: GameSession, playerId: PlayerId, io: Server): void {
  session.pendingTileEvent = null;
  if (session.pendingExtraRoll) {
    session.pendingExtraRoll = false;
    StateMachine.transition(session, TurnPhase.WAITING_FOR_ACTION);
    broadcastToRoom(io, session.id, 'TURN_READY', {
      playerId,
      phase: TurnPhase.WAITING_FOR_ACTION,
      availableActions: ['ROLL_DICE'],
    });
    return;
  }

  StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
  broadcastToRoom(io, session.id, 'TURN_READY', {
    playerId,
    phase: TurnPhase.END_TURN_PENDING,
    availableActions: ['END_TURN'],
  });
}

/** Advance after a completed turn or an exceptional resolution. */
export function advanceToNextTurn(session: GameSession, io: Server): void {
  session.pendingExtraRoll = false;
  StateMachine.forcePhase(session, TurnPhase.TURN_TRANSITIONING);
  advanceTurn(session);

  const nextPlayer = requirePlayer(session, getCurrentPlayerId(session));
  if (nextPlayer.priceHikeActive
      && nextPlayer.priceHikeExpiresOnTurn !== null
      && session.turnNumber >= nextPlayer.priceHikeExpiresOnTurn) {
    nextPlayer.priceHikeActive = false;
    nextPlayer.priceHikeExpiresOnTurn = null;
    broadcastToRoom(io, session.id, 'PRICE_HIKE_EXPIRED', { playerId: nextPlayer.id });
  }

  StateMachine.transition(
    session,
    nextPlayer.inJail ? TurnPhase.JAIL_DECISION : TurnPhase.WAITING_FOR_ACTION,
  );
  emitTurnStarted(io, session);
}

export function emitTurnStarted(io: Server, session: GameSession): void {
  const payload: S2C_TurnStarted = {
    playerId: getCurrentPlayerId(session),
    turnNumber: session.turnNumber,
    phase: session.currentPhase,
    timeoutMs: 60_000,
  };
  broadcastToRoom(io, session.id, 'TURN_STARTED', payload);
}
