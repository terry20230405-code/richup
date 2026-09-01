"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAfterLanding = resolveAfterLanding;
exports.advanceToNextTurn = advanceToNextTurn;
exports.emitTurnStarted = emitTurnStarted;
const GameSession_types_1 = require("../types/GameSession.types");
const GameSession_1 = require("../state/GameSession");
const StateMachine_1 = require("../state/StateMachine");
const broadcast_1 = require("../socket/emitters/broadcast");
/** Complete a landing event and either grant an extra roll or end the turn. */
function resolveAfterLanding(session, playerId, io) {
    session.pendingTileEvent = null;
    if (session.pendingExtraRoll) {
        session.pendingExtraRoll = false;
        StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.WAITING_FOR_ACTION);
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'TURN_READY', {
            playerId,
            phase: GameSession_types_1.TurnPhase.WAITING_FOR_ACTION,
            availableActions: ['ROLL_DICE'],
        });
        return;
    }
    StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.END_TURN_PENDING);
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'TURN_READY', {
        playerId,
        phase: GameSession_types_1.TurnPhase.END_TURN_PENDING,
        availableActions: ['END_TURN'],
    });
}
/** Advance after a completed turn or an exceptional resolution. */
function advanceToNextTurn(session, io) {
    session.pendingExtraRoll = false;
    StateMachine_1.StateMachine.forcePhase(session, GameSession_types_1.TurnPhase.TURN_TRANSITIONING);
    (0, GameSession_1.advanceTurn)(session);
    const nextPlayer = (0, GameSession_1.requirePlayer)(session, (0, GameSession_1.getCurrentPlayerId)(session));
    if (nextPlayer.priceHikeActive
        && nextPlayer.priceHikeExpiresOnTurn !== null
        && session.turnNumber >= nextPlayer.priceHikeExpiresOnTurn) {
        nextPlayer.priceHikeActive = false;
        nextPlayer.priceHikeExpiresOnTurn = null;
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'PRICE_HIKE_EXPIRED', { playerId: nextPlayer.id });
    }
    StateMachine_1.StateMachine.transition(session, nextPlayer.inJail ? GameSession_types_1.TurnPhase.JAIL_DECISION : GameSession_types_1.TurnPhase.WAITING_FOR_ACTION);
    emitTurnStarted(io, session);
}
function emitTurnStarted(io, session) {
    const payload = {
        playerId: (0, GameSession_1.getCurrentPlayerId)(session),
        turnNumber: session.turnNumber,
        phase: session.currentPhase,
        timeoutMs: 60_000,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'TURN_STARTED', payload);
}
//# sourceMappingURL=TurnFlow.js.map