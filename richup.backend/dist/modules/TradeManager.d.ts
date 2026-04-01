/**
 * Free-trade system.
 *
 * Rules (per PRD):
 *  - Either party can propose a trade at almost any phase
 *  - Entering DYING_RESCUE voids existing outgoing trades for the dying player
 *  - The dying player can still INITIATE new trades
 *  - Cash amounts in TRADE_PROPOSED are private (directed to both parties only)
 *  - TRADE_COMPLETED reveals cash amount publicly
 *  - Forced-trade card cannot target tiles with buildings (enforced in PropCardHandler)
 */
import type { Server } from 'socket.io';
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import type { TradeOffer } from '../types/Trade.types';
import { TradeVoidReason } from '../types/Trade.types';
export declare function proposeTrade(session: GameSession, proposerId: PlayerId, responderId: PlayerId, proposerOffer: TradeOffer, responderOffer: TradeOffer, io: Server): string;
export declare function acceptTrade(session: GameSession, tradeId: string, responderId: PlayerId, io: Server): void;
export declare function rejectTrade(session: GameSession, tradeId: string, responderId: PlayerId, io: Server): void;
export declare function cancelTrade(session: GameSession, tradeId: string, proposerId: PlayerId, io: Server): void;
/**
 * Void all outgoing pending trades from a specific proposer.
 * Called when a player enters DYING_RESCUE.
 */
export declare function voidOutgoingTrades(session: GameSession, proposerId: PlayerId, reason: TradeVoidReason, io: Server): void;
//# sourceMappingURL=TradeManager.d.ts.map