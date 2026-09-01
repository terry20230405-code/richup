/**
 * GameSession lifecycle helpers.
 *
 * - startGame()     transitions a LOBBY session to IN_PROGRESS
 * - cashChange()    the single authoritative cash mutation + CASH_UPDATED emit
 * - getActivePlayers() / getCurrentPlayer() convenience queries
 */
import type { Server } from 'socket.io';
import type { PlayerId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import type { Player } from '../types/Player.types';
/**
 * Transition a LOBBY session to IN_PROGRESS.
 * Generates the board, shuffles player order, deals starting cash.
 * Call this when the host clicks "Start Game".
 */
export declare function startGame(session: GameSession): void;
/**
 * The single authoritative function for changing a player's cash.
 * Always emits CASH_UPDATED directed to the player only.
 *
 * @param delta Positive = gain, negative = loss.
 * @returns The player's new cash balance.
 */
export declare function cashChange(session: GameSession, playerId: PlayerId, delta: Money, reason: string, io: Server): Money;
/**
 * Send the authoritative prop-card hand to its owner only.
 * Call this after every successful server-side hand mutation.
 */
export declare function syncPropCards(session: GameSession, playerId: PlayerId, io: Server): void;
export declare function requirePlayer(session: GameSession, playerId: PlayerId): Player;
export declare function getCurrentPlayer(session: GameSession): Player;
export declare function getCurrentPlayerId(session: GameSession): PlayerId;
/** Active players = not bankrupt */
export declare function getActivePlayers(session: GameSession): Player[];
/**
 * Advance to the next player's turn.
 * Skips bankrupt/disconnected players.
 * Updates turnNumber and roundNumber.
 */
export declare function advanceTurn(session: GameSession): void;
/**
 * Returns the winner's PlayerId if only one active player remains, else null.
 */
export declare function checkVictory(session: GameSession): PlayerId | null;
/** Returns property TileIds that the player can manage during their turn. */
export declare function getConstructibleTileIds(session: GameSession, playerId: PlayerId): number[];
/** Returns all ownable TileIds owned by the given player. */
export declare function getOwnedTileIds(session: GameSession, playerId: PlayerId): number[];
//# sourceMappingURL=GameSession.d.ts.map