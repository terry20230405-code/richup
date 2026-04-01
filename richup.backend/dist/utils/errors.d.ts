/**
 * Domain error hierarchy for the game server.
 * All errors should be caught at the SocketEventRouter level and converted
 * to ACTION_REJECTED payloads. Never let raw errors reach the client.
 */
export declare class DomainError extends Error {
    constructor(message: string);
}
/** Player tried to act outside the allowed TurnPhase */
export declare class PhaseViolationError extends DomainError {
    readonly currentPhase: string;
    readonly action: string;
    constructor(currentPhase: string, action: string);
}
/** Action sent by a player who is not the current turn holder */
export declare class NotYourTurnError extends DomainError {
    readonly playerId: string;
    constructor(playerId: string);
}
/** Monetary operation would leave a player with insufficient funds */
export declare class InsufficientFundsError extends DomainError {
    readonly playerId: string;
    readonly required: number;
    readonly available: number;
    constructor(playerId: string, required: number, available: number);
}
/** Generic rule violation (e.g. building rules, trade constraints) */
export declare class RuleViolationError extends DomainError {
    constructor(message: string);
}
/** Requested entity (room, player, tile, trade, auction) was not found */
export declare class NotFoundError extends DomainError {
    constructor(entity: string, id: string | number);
}
/** Operation blocked due to auction bid lock */
export declare class BidLockedError extends DomainError {
    readonly lockedAmount: number;
    constructor(lockedAmount: number);
}
/** JWT authentication failed */
export declare class AuthError extends DomainError {
    constructor(reason: string);
}
/** Attempted to perform an action on a game that is not in IN_PROGRESS state */
export declare class GameNotActiveError extends DomainError {
    readonly gameStatus: string;
    constructor(gameStatus: string);
}
//# sourceMappingURL=errors.d.ts.map