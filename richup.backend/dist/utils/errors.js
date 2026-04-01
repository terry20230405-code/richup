"use strict";
/**
 * Domain error hierarchy for the game server.
 * All errors should be caught at the SocketEventRouter level and converted
 * to ACTION_REJECTED payloads. Never let raw errors reach the client.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameNotActiveError = exports.AuthError = exports.BidLockedError = exports.NotFoundError = exports.RuleViolationError = exports.InsufficientFundsError = exports.NotYourTurnError = exports.PhaseViolationError = exports.DomainError = void 0;
class DomainError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.DomainError = DomainError;
/** Player tried to act outside the allowed TurnPhase */
class PhaseViolationError extends DomainError {
    currentPhase;
    action;
    constructor(currentPhase, action) {
        super(`Action "${action}" is not allowed in phase "${currentPhase}"`);
        this.currentPhase = currentPhase;
        this.action = action;
    }
}
exports.PhaseViolationError = PhaseViolationError;
/** Action sent by a player who is not the current turn holder */
class NotYourTurnError extends DomainError {
    playerId;
    constructor(playerId) {
        super(`It is not player "${playerId}"'s turn`);
        this.playerId = playerId;
    }
}
exports.NotYourTurnError = NotYourTurnError;
/** Monetary operation would leave a player with insufficient funds */
class InsufficientFundsError extends DomainError {
    playerId;
    required;
    available;
    constructor(playerId, required, available) {
        super(`Player "${playerId}" needs ${required} but only has ${available}`);
        this.playerId = playerId;
        this.required = required;
        this.available = available;
    }
}
exports.InsufficientFundsError = InsufficientFundsError;
/** Generic rule violation (e.g. building rules, trade constraints) */
class RuleViolationError extends DomainError {
    constructor(message) {
        super(message);
    }
}
exports.RuleViolationError = RuleViolationError;
/** Requested entity (room, player, tile, trade, auction) was not found */
class NotFoundError extends DomainError {
    constructor(entity, id) {
        super(`${entity} with id "${id}" not found`);
    }
}
exports.NotFoundError = NotFoundError;
/** Operation blocked due to auction bid lock */
class BidLockedError extends DomainError {
    lockedAmount;
    constructor(lockedAmount) {
        super(`Operation blocked: ${lockedAmount} is locked in an active auction bid`);
        this.lockedAmount = lockedAmount;
    }
}
exports.BidLockedError = BidLockedError;
/** JWT authentication failed */
class AuthError extends DomainError {
    constructor(reason) {
        super(`Authentication failed: ${reason}`);
    }
}
exports.AuthError = AuthError;
/** Attempted to perform an action on a game that is not in IN_PROGRESS state */
class GameNotActiveError extends DomainError {
    gameStatus;
    constructor(gameStatus) {
        super(`Game is not active (current status: ${gameStatus})`);
        this.gameStatus = gameStatus;
    }
}
exports.GameNotActiveError = GameNotActiveError;
//# sourceMappingURL=errors.js.map