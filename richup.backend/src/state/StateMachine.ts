/**
 * Turn-phase state machine.
 *
 * ONLY this module may write session.currentPhase.
 * All other modules must call StateMachine.transition() or StateMachine.forcePhase().
 */

import type { GameSession } from '../types/GameSession.types';
import { TurnPhase } from '../types/GameSession.types';
import { PhaseViolationError } from '../utils/errors';
import { logger } from '../utils/logger';

// ─── Valid transitions ────────────────────────────────────────────────────────

/**
 * Allowed phase transitions.
 * Key = current phase, Value = set of phases it can transition to.
 */
const VALID_TRANSITIONS: ReadonlyMap<TurnPhase, ReadonlySet<TurnPhase>> = new Map<TurnPhase, ReadonlySet<TurnPhase>>([
  [
    TurnPhase.WAITING_FOR_ACTION,
    new Set([TurnPhase.ROLLING_DICE, TurnPhase.JAIL_DECISION, TurnPhase.END_TURN_PENDING]),
  ],
  [
    TurnPhase.ROLLING_DICE,
    // END_TURN_PENDING: rolled but no move happens (sent to jail on 3rd double,
    // or failed the jail-escape roll) — turn ends immediately.
    new Set([TurnPhase.MOVING, TurnPhase.JAIL_DECISION, TurnPhase.WAITING_FOR_ACTION, TurnPhase.END_TURN_PENDING]),
  ],
  [
    TurnPhase.MOVING,
    new Set([TurnPhase.EVENT_TRIGGER, TurnPhase.END_TURN_PENDING, TurnPhase.WAITING_FOR_ACTION]),
  ],
  [
    TurnPhase.EVENT_TRIGGER,
    new Set([
      TurnPhase.END_TURN_PENDING,
      TurnPhase.AUCTION_IN_PROGRESS,
      TurnPhase.DYING_RESCUE,
      TurnPhase.WAITING_FOR_ACTION,
    ]),
  ],
  [
    TurnPhase.AUCTION_IN_PROGRESS,
    new Set([TurnPhase.END_TURN_PENDING, TurnPhase.WAITING_FOR_ACTION, TurnPhase.DYING_RESCUE]),
  ],
  [
    TurnPhase.JAIL_DECISION,
    new Set([TurnPhase.ROLLING_DICE, TurnPhase.END_TURN_PENDING, TurnPhase.MOVING, TurnPhase.WAITING_FOR_ACTION]),
  ],
  [
    TurnPhase.DYING_RESCUE,
    new Set([TurnPhase.TURN_TRANSITIONING]),
  ],
  [
    TurnPhase.END_TURN_PENDING,
    new Set([TurnPhase.TURN_TRANSITIONING, TurnPhase.AUCTION_IN_PROGRESS]),
  ],
  [
    TurnPhase.TURN_TRANSITIONING,
    new Set([TurnPhase.WAITING_FOR_ACTION, TurnPhase.JAIL_DECISION]),
  ],
]);

// ─── StateMachine namespace ───────────────────────────────────────────────────

export const StateMachine = {
  /**
   * Validate and apply a phase transition.
   * Throws PhaseViolationError if the transition is not allowed.
   */
  transition(session: GameSession, newPhase: TurnPhase): void {
    const current = session.currentPhase;
    const allowed = VALID_TRANSITIONS.get(current);

    if (!allowed?.has(newPhase)) {
      throw new PhaseViolationError(
        current,
        `transition to ${newPhase}`,
      );
    }

    logger.debug(
      { roomId: session.id, from: current, to: newPhase },
      'Phase transition',
    );
    session.currentPhase = newPhase;
    session.phaseEnteredAt = Date.now();
  },

  /**
   * Force-set a phase without validation.
   * Only use for game initialisation or after catastrophic state recovery.
   */
  forcePhase(session: GameSession, newPhase: TurnPhase): void {
    logger.debug(
      { roomId: session.id, from: session.currentPhase, to: newPhase },
      'Force phase set',
    );
    session.currentPhase = newPhase;
    session.phaseEnteredAt = Date.now();
  },

  /** Assert the session is in one of the expected phases. Throws otherwise. */
  requirePhase(session: GameSession, allowedPhases: TurnPhase[], action: string): void {
    if (!allowedPhases.includes(session.currentPhase)) {
      throw new PhaseViolationError(session.currentPhase, action);
    }
  },
};
