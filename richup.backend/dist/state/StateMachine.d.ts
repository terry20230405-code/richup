/**
 * Turn-phase state machine.
 *
 * ONLY this module may write session.currentPhase.
 * All other modules must call StateMachine.transition() or StateMachine.forcePhase().
 */
import type { GameSession } from '../types/GameSession.types';
import { TurnPhase } from '../types/GameSession.types';
export declare const StateMachine: {
    /**
     * Validate and apply a phase transition.
     * Throws PhaseViolationError if the transition is not allowed.
     */
    transition(session: GameSession, newPhase: TurnPhase): void;
    /**
     * Force-set a phase without validation.
     * Only use for game initialisation or after catastrophic state recovery.
     */
    forcePhase(session: GameSession, newPhase: TurnPhase): void;
    /** Assert the session is in one of the expected phases. Throws otherwise. */
    requirePhase(session: GameSession, allowedPhases: TurnPhase[], action: string): void;
};
//# sourceMappingURL=StateMachine.d.ts.map