/**
 * Surprise card deck management and effect application.
 *
 * Deck is a shuffled stack; when empty the discard pile is reshuffled.
 */
import type { Server } from 'socket.io';
import type { PlayerId, Money } from '../types/Common.types';
import type { GameSession, SurpriseCard } from '../types/GameSession.types';
/** Create a freshly shuffled surprise deck for a new game. */
export declare function initSurpriseDeck(): SurpriseCard[];
export interface SurpriseEffectResult {
    rampage: boolean;
    propCardDrawn: boolean;
    requiresRescue: boolean;
    amountOwed: Money;
}
/**
 * Draw and apply a surprise card for the given player.
 * Emits SURPRISE_RESULT (and SURPRISE_RAMPAGE / PROP_CARD_DRAWN if applicable).
 */
export declare function applySurpriseCard(session: GameSession, playerId: PlayerId, io: Server): SurpriseEffectResult;
//# sourceMappingURL=SurpriseHandler.d.ts.map