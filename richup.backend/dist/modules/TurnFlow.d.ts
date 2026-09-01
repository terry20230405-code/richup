import type { Server } from 'socket.io';
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
/** Complete a landing event and either grant an extra roll or end the turn. */
export declare function resolveAfterLanding(session: GameSession, playerId: PlayerId, io: Server): void;
/** Advance after a completed turn or an exceptional resolution. */
export declare function advanceToNextTurn(session: GameSession, io: Server): void;
export declare function emitTurnStarted(io: Server, session: GameSession): void;
//# sourceMappingURL=TurnFlow.d.ts.map