/**
 * Information asymmetry enforcement.
 *
 * ALL data sent to clients must pass through this module.
 * Private player fields (cash, propCards, hasImmunity, priceHikeActive)
 * are NEVER present in any broadcast payload.
 */

import type { PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { GameStatus } from '../types/GameSession.types';
import type { Player, PlayerPublicView, PlayerSelfView } from '../types/Player.types';
import type { Tile, TilePublicView } from '../types/Tile.types';
import type { AuctionPublicView } from '../types/Auction.types';
import type { TradePublicView } from '../types/Trade.types';
import type { S2C_TradeDetail } from '../types/Events.types';
import { getConstructibleTileIds } from '../state/GameSession';
import { buildDyingRescueDetail } from '../modules/BankruptcyResolver';

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
    constructibleTileIds: getConstructibleTileIds(session, player.id),
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
export function serializeBoard(session: GameSession): TilePublicView[] {
  return session.board.map(tile => serializeTile(session, tile));
}

function serializeTile(session: GameSession, tile: Tile): TilePublicView {
  switch (tile.type) {
    case 'TEMPLE':
      return {
        id: tile.id,
        name: tile.name,
        type: tile.type,
        ownerId: tile.ownerId,
        isMortgaged: tile.isMortgaged,
        basePrice: tile.basePrice,
        mortgageValue: tile.mortgageValue,
        isLit: tile.isLit,
        litThreshold: session.config.templeLitThreshold,
        prayFee: session.config.templePrayFee,
        passThruToll: session.config.templePassThruToll,
      };
    default:
      return { ...tile };
  }
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

function serializePrivateTradeDetails(
  session: GameSession,
  playerId: PlayerId,
): S2C_TradeDetail[] {
  return [...session.activeTrades.values()]
    .filter(trade => trade.proposerId === playerId || trade.responderId === playerId)
    .map(trade => ({
      tradeId: trade.id,
      proposerOffer: {
        ...trade.proposerOffer,
        tileIds: [...trade.proposerOffer.tileIds],
        propCardIds: [...(trade.proposerOffer.propCardIds ?? [])],
      },
      responderOffer: {
        ...trade.responderOffer,
        tileIds: [...trade.responderOffer.tileIds],
        propCardIds: [...(trade.responderOffer.propCardIds ?? [])],
      },
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

  const publicDyingRescue = session.dyingRescue
    ? {
        playerId: session.dyingRescue.playerId,
        rescueDeadlineAt: session.dyingRescue.startedAt + session.config.dyingRescueTotalMs,
      }
    : null;
  const publicPause = session.status === GameStatus.PAUSED &&
    session.pausedAt !== null &&
    session.disconnectedCurrentPlayerId
    ? {
        disconnectedPlayerId: session.disconnectedCurrentPlayerId,
        reconnectDeadlineAt: session.pausedAt + session.config.reconnectWindowMs,
      }
    : null;

  return {
    selfView: toSelfView(player, session),
    rescueDetail: buildDyingRescueDetail(session, playerId),
    tradeDetails: serializePrivateTradeDetails(session, playerId),
    gameSnapshot: {
      roomId: session.id,
      hostId: session.hostId,
      status: session.status,
      currentPhase: session.currentPhase,
      currentTurnPlayerId: session.playerOrder[session.currentPlayerIndex] ?? null,
      turnNumber: session.turnNumber,
      playerOrder: [...session.playerOrder],
      board: serializeBoard(session),
      players: serializePublicPlayers(session),
      activeAuction: serializeActiveAuction(session),
      pendingTrades: serializePendingTrades(session),
      dyingRescue: publicDyingRescue,
      pause: publicPause,
      winners: [...session.winnerIds],
    },
  };
}
