/**
 * Information asymmetry enforcement.
 *
 * ALL data sent to clients must pass through this module.
 * Private player fields (cash, propCards, hasImmunity, priceHikeActive)
 * are NEVER present in any broadcast payload.
 */
import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import type { Player, PlayerPublicView, PlayerSelfView } from '../types/Player.types';
import type { AuctionPublicView } from '../types/Auction.types';
import type { TradePublicView } from '../types/Trade.types';
/** ⚠ Safe to broadcast: contains NO cash, propCards, immunity, or priceHike. */
export declare function toPublicView(player: Player): PlayerPublicView;
/** Private: sent only to the owning player (RECONNECT_SUCCESS, etc.). */
export declare function toSelfView(player: Player, session: GameSession): PlayerSelfView;
/** Returns public views for all players — safe to broadcast. */
export declare function serializePublicPlayers(session: GameSession): PlayerPublicView[];
/**
 * Serialize the board for broadcast.
 * Tiles have no secret state — all tile fields are safe to broadcast.
 * (Tile.ownerId identifies the owner but reveals no financial info.)
 */
export declare function serializeBoard(session: GameSession): object[];
/**
 * Build the reconnect payload for a specific player.
 * Includes the player's own private data plus a fully desensitised game state.
 */
export declare function buildReconnectSnapshot(session: GameSession, playerId: PlayerId): {
    selfView: PlayerSelfView;
    gameSnapshot: {
        roomId: string;
        status: import("../types/GameSession.types").GameStatus;
        currentPhase: import("../types/GameSession.types").TurnPhase;
        currentTurnPlayerId: string;
        turnNumber: number;
        playerOrder: string[];
        board: object[];
        players: PlayerPublicView[];
        activeAuction: AuctionPublicView | null;
        pendingTrades: TradePublicView[];
        winners: string[];
    };
};
//# sourceMappingURL=GameStateSerializer.d.ts.map