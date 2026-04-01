/**
 * Domain error hierarchy for the game server.
 * All errors should be caught at the SocketEventRouter level and converted
 * to ACTION_REJECTED payloads. Never let raw errors reach the client.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/** Player tried to act outside the allowed TurnPhase */
export class PhaseViolationError extends DomainError {
  constructor(public readonly currentPhase: string, public readonly action: string) {
    super(`Action "${action}" is not allowed in phase "${currentPhase}"`);
  }
}

/** Action sent by a player who is not the current turn holder */
export class NotYourTurnError extends DomainError {
  constructor(public readonly playerId: string) {
    super(`It is not player "${playerId}"'s turn`);
  }
}

/** Monetary operation would leave a player with insufficient funds */
export class InsufficientFundsError extends DomainError {
  constructor(
    public readonly playerId: string,
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Player "${playerId}" needs ${required} but only has ${available}`);
  }
}

/** Generic rule violation (e.g. building rules, trade constraints) */
export class RuleViolationError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}

/** Requested entity (room, player, tile, trade, auction) was not found */
export class NotFoundError extends DomainError {
  constructor(entity: string, id: string | number) {
    super(`${entity} with id "${id}" not found`);
  }
}

/** Operation blocked due to auction bid lock */
export class BidLockedError extends DomainError {
  constructor(public readonly lockedAmount: number) {
    super(`Operation blocked: ${lockedAmount} is locked in an active auction bid`);
  }
}

/** JWT authentication failed */
export class AuthError extends DomainError {
  constructor(reason: string) {
    super(`Authentication failed: ${reason}`);
  }
}

/** Attempted to perform an action on a game that is not in IN_PROGRESS state */
export class GameNotActiveError extends DomainError {
  constructor(public readonly gameStatus: string) {
    super(`Game is not active (current status: ${gameStatus})`);
  }
}
