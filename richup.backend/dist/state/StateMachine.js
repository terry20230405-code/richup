"use strict";
/**
 * Turn-phase state machine.
 *
 * ONLY this module may write session.currentPhase.
 * All other modules must call StateMachine.transition() or StateMachine.forcePhase().
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachine = void 0;
const GameSession_types_1 = require("../types/GameSession.types");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
// ─── Valid transitions ────────────────────────────────────────────────────────
/**
 * Allowed phase transitions.
 * Key = current phase, Value = set of phases it can transition to.
 */
const VALID_TRANSITIONS = new Map([
    [
        GameSession_types_1.TurnPhase.WAITING_FOR_ACTION,
        new Set([GameSession_types_1.TurnPhase.ROLLING_DICE, GameSession_types_1.TurnPhase.JAIL_DECISION, GameSession_types_1.TurnPhase.END_TURN_PENDING]),
    ],
    [
        GameSession_types_1.TurnPhase.ROLLING_DICE,
        new Set([GameSession_types_1.TurnPhase.MOVING, GameSession_types_1.TurnPhase.JAIL_DECISION, GameSession_types_1.TurnPhase.WAITING_FOR_ACTION]),
    ],
    [
        GameSession_types_1.TurnPhase.MOVING,
        new Set([GameSession_types_1.TurnPhase.EVENT_TRIGGER, GameSession_types_1.TurnPhase.END_TURN_PENDING, GameSession_types_1.TurnPhase.WAITING_FOR_ACTION]),
    ],
    [
        GameSession_types_1.TurnPhase.EVENT_TRIGGER,
        new Set([
            GameSession_types_1.TurnPhase.END_TURN_PENDING,
            GameSession_types_1.TurnPhase.AUCTION_IN_PROGRESS,
            GameSession_types_1.TurnPhase.DYING_RESCUE,
            GameSession_types_1.TurnPhase.WAITING_FOR_ACTION,
        ]),
    ],
    [
        GameSession_types_1.TurnPhase.AUCTION_IN_PROGRESS,
        new Set([GameSession_types_1.TurnPhase.END_TURN_PENDING, GameSession_types_1.TurnPhase.DYING_RESCUE]),
    ],
    [
        GameSession_types_1.TurnPhase.BUILD_PHASE,
        new Set([GameSession_types_1.TurnPhase.END_TURN_PENDING]),
    ],
    [
        GameSession_types_1.TurnPhase.JAIL_DECISION,
        new Set([GameSession_types_1.TurnPhase.ROLLING_DICE, GameSession_types_1.TurnPhase.END_TURN_PENDING, GameSession_types_1.TurnPhase.MOVING]),
    ],
    [
        GameSession_types_1.TurnPhase.DYING_RESCUE,
        new Set([GameSession_types_1.TurnPhase.TURN_TRANSITIONING]),
    ],
    [
        GameSession_types_1.TurnPhase.END_TURN_PENDING,
        new Set([GameSession_types_1.TurnPhase.TURN_TRANSITIONING, GameSession_types_1.TurnPhase.AUCTION_IN_PROGRESS]),
    ],
    [
        GameSession_types_1.TurnPhase.TURN_TRANSITIONING,
        new Set([GameSession_types_1.TurnPhase.WAITING_FOR_ACTION, GameSession_types_1.TurnPhase.JAIL_DECISION]),
    ],
]);
// ─── StateMachine namespace ───────────────────────────────────────────────────
exports.StateMachine = {
    /**
     * Validate and apply a phase transition.
     * Throws PhaseViolationError if the transition is not allowed.
     */
    transition(session, newPhase) {
        const current = session.currentPhase;
        const allowed = VALID_TRANSITIONS.get(current);
        if (!allowed?.has(newPhase)) {
            throw new errors_1.PhaseViolationError(current, `transition to ${newPhase}`);
        }
        logger_1.logger.debug({ roomId: session.id, from: current, to: newPhase }, 'Phase transition');
        session.currentPhase = newPhase;
        session.phaseEnteredAt = Date.now();
    },
    /**
     * Force-set a phase without validation.
     * Only use for game initialisation or after catastrophic state recovery.
     */
    forcePhase(session, newPhase) {
        logger_1.logger.debug({ roomId: session.id, from: session.currentPhase, to: newPhase }, 'Force phase set');
        session.currentPhase = newPhase;
        session.phaseEnteredAt = Date.now();
    },
    /** Assert the session is in one of the expected phases. Throws otherwise. */
    requirePhase(session, allowedPhases, action) {
        if (!allowedPhases.includes(session.currentPhase)) {
            throw new errors_1.PhaseViolationError(session.currentPhase, action);
        }
    },
};
//# sourceMappingURL=StateMachine.js.map