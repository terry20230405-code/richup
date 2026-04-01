/**
 * Prop-card effect dispatcher — 6 card types.
 *
 *  FORCED_TRADE  — buy any non-built tile from any player at its basePrice
 *  REMOTE_DICE   — choose steps (5/6/7), overrides next roll
 *  PLUNDER       — steal max(0, floor(target.cash / 2)) from a target player
 *  IMMUNITY      — next time you must pay rent, it's waived (one use)
 *  AUDIT         — private: see all players' current cash balances
 *  PRICE_HIKE    — your rent is ×1.5 until the start of your next turn
 */
import type { Server } from 'socket.io';
import type { PlayerId, TileId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { PropCardType } from '../types/PropCard.types';
export interface PropCardParams {
    targetPlayerId?: PlayerId;
    targetTileId?: TileId;
    steps?: 5 | 6 | 7;
}
/**
 * Execute a prop card effect.
 * Removes the card from the player's hand if successful.
 */
export declare function usePropCard(session: GameSession, playerId: PlayerId, cardId: string, cardType: PropCardType, params: PropCardParams, io: Server): void;
//# sourceMappingURL=PropCardHandler.d.ts.map