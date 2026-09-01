import type { Server } from 'socket.io';
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { TradeVoidReason } from '../types/Trade.types';
/** Void every pending trade where the player is either party. */
export declare function voidTradesInvolvingPlayer(session: GameSession, playerId: PlayerId, reason: TradeVoidReason, io: Server): void;
/** Void all pending trades, used when the match reaches a terminal state. */
export declare function voidAllPendingTrades(session: GameSession, reason: TradeVoidReason, io: Server): void;
//# sourceMappingURL=TradeLifecycle.d.ts.map