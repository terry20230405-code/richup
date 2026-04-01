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
import type { Tile } from '../types/Tile.types';
import type { AuctionPublicView } from '../types/Auction.types';
import type { TradePublicView } from '../types/Trade.types';
import { getOwnedTileIds } from '../state/GameSession';

// ─── Player views ─────────────────────────────────────────────────────────────

/** ⚠ Safe to broadcast: contains NO cash, propCards, immunity, or priceHike. */
export function toPublicView(player: Player): PlayerPublicView {
  return {
    id: player.id,
    nickname: player.nickname,
    avatarIndex: player.avatarIndex,
    color: player.color,
    position: player.position,
    previousPosition: player.previousPosition,
    inJail: player.inJail,
    jailTurnsWaited: player.jailTurnsWaited,
    status: player.status,
    isConnected: player.isConnected,
    // cash:            OMITTED
    // propCards:       OMITTED
    // propCardCount:   OMITTED
    // hasImmunity:     OMITTED
    // priceHikeActive: OMITTED
  };
}

/** Private: sent only to the owning player (RECONNECT_SUCCESS, etc.). */
export function toSelfView(player: Player, session: GameSession): PlayerSelfView {
  return {
    id: player.id,
    nickname: player.nickname,
    avatarIndex: player.avatarIndex,
    color: player.color,
    position: player.position,
    previousPosition: player.previousPosition,
    inJail: player.inJail,
    jailTurnsWaited: player.jailTurnsWaited,
    status: player.status,
    isConnected: player.isConnected,
    cash: player.cash,
    propCards: player.propCards,
    hasImmunity: player.hasImmunity,
    priceHikeActive: player.priceHikeActive,
    constructibleTileIds: getOwnedTileIds(session, player.id),
  };
}

/** Returns public views for all players — safe to broadcast. */
export function serializePublicPlayers(session: GameSession): PlayerPublicView[] {
  return [...session.players.values()].map(toPublicView);
}

// ─── Board views ──────────────────────────────────────────────────────────────

/**
 * Serialize the board for broadcast.
 * Tiles have no secret state — all tile fields are safe to broadcast.
 * (Tile.ownerId identifies the owner but reveals no financial info.)
 */
export function serializeBoard(session: GameSession): object[] {
  return session.board.map(serializeTile);
}

function serializeTile(tile: Tile): object {
  // Tiles are already serializable; just return as plain object.
  return tile as unknown as object;
}

function serializeActiveAuction(session: GameSession): AuctionPublicView | null {
  const auction = session.activeAuction;
  if (!auction) {
    return null;
  }

  return {
    id: auction.id,
    tileId: auction.tileId,
    currentBid: auction.currentBid,
    currentLeaderId: auction.currentLeaderId,
    activePlayerIds: [...auction.activePlayerIds],
    passedPlayerIds: [...auction.passedPlayerIds],
    status: auction.status,
    winnerId: auction.winnerId,
    finalPrice: auction.finalPrice,
    roundDeadlineAt: auction.roundDeadlineAt,
  };
}

function serializePendingTrades(session: GameSession): TradePublicView[] {
  return [...session.activeTrades.values()].map((trade) => ({
    tradeId: trade.id,
    proposerId: trade.proposerId,
    responderId: trade.responderId,
    proposerTileIds: [...trade.proposerOffer.tileIds],
    responderTileIds: [...trade.responderOffer.tileIds],
    status: trade.status,
    proposedAt: trade.proposedAt,
  }));
}

// ─── Snapshot for reconnection ────────────────────────────────────────────────

/**
 * Build the reconnect payload for a specific player.
 * Includes the player's own private data plus a fully desensitised game state.
 */
export function buildReconnectSnapshot(session: GameSession, playerId: PlayerId) {
  const player = session.players.get(playerId);
  if (!player) throw new Error(`Player ${playerId} not found in session`);

  return {
    selfView: toSelfView(player, session),
    gameSnapshot: {
      roomId: session.id,
      status: session.status,
      currentPhase: session.currentPhase,
      currentTurnPlayerId: session.playerOrder[session.currentPlayerIndex] ?? null,
      turnNumber: session.turnNumber,
      playerOrder: [...session.playerOrder],
      board: serializeBoard(session),
      players: serializePublicPlayers(session),
      activeAuction: serializeActiveAuction(session),
      pendingTrades: serializePendingTrades(session),
      winners: [...session.winnerIds],
    },
  };
}
