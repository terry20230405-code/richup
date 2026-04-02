import { defineStore } from 'pinia';

import type {
  AuctionPublicView,
  DesensitizedGameState,
  GameStatus,
  PlayerId,
  TradeDetail,
  TradePublicView,
  TilePublicView,
  TurnPhase,
} from '@/types';

interface GameState {
  roomId: string;
  status: GameStatus;
  currentPhase: TurnPhase;
  currentTurnPlayerId: PlayerId | null;
  turnNumber: number;
  playerOrder: PlayerId[];
  board: TilePublicView[];
  activeAuction: AuctionPublicView | null;
  pendingTrades: TradePublicView[];
  winners: PlayerId[];
  availableActions: string[];
  activeTradeDetail: TradeDetail | null;
  /** Set when status === 'PAUSED'. Cleared on GAME_RESUMED. */
  pausedByPlayerId: PlayerId | null;
  pauseCountdownSeconds: number;
  /** Set when a player enters DYING phase. Cleared on PLAYER_RESCUED / PLAYER_BANKRUPT. */
  dyingPlayerId: PlayerId | null;
  rescueWindowEndsAt: number | null;
  /** Set when landing on a TAX tile. Cleared on TAX_PAID or turn start. */
  pendingTaxAmount: number | null;
}

const cloneTile = (tile: TilePublicView): TilePublicView => ({
  ...tile,
});

const cloneAuction = (auction: AuctionPublicView): AuctionPublicView => ({
  ...auction,
  activePlayerIds: [...auction.activePlayerIds],
  passedPlayerIds: [...auction.passedPlayerIds],
});

const cloneTrade = (trade: TradePublicView): TradePublicView => ({
  ...trade,
  proposerTileIds: [...trade.proposerTileIds],
  responderTileIds: [...trade.responderTileIds],
});

const createInitialGameState = (): GameState => ({
  roomId: '',
  status: 'LOBBY',
  currentPhase: 'WAITING_FOR_ACTION',
  currentTurnPlayerId: null,
  turnNumber: 0,
  playerOrder: [],
  board: [],
  activeAuction: null,
  pendingTrades: [],
  winners: [],
  availableActions: [],
  activeTradeDetail: null,
  pausedByPlayerId: null,
  pauseCountdownSeconds: 0,
  dyingPlayerId: null,
  rescueWindowEndsAt: null,
  pendingTaxAmount: null,
});

export const useGameStore = defineStore('game', {
  state: (): GameState => createInitialGameState(),
  getters: {
    hasBoard: (state) => state.board.length > 0,
    boardById: (state) => Object.fromEntries(state.board.map((tile) => [tile.id, tile])),
  },
  actions: {
    reset() {
      Object.assign(this, createInitialGameState());
    },
    hydrate(snapshot: DesensitizedGameState) {
      this.roomId = snapshot.roomId;
      this.status = snapshot.status;
      this.currentPhase = snapshot.currentPhase;
      this.currentTurnPlayerId = snapshot.currentTurnPlayerId;
      this.turnNumber = snapshot.turnNumber;
      this.playerOrder = [...snapshot.playerOrder];
      this.board = snapshot.board.map(cloneTile);
      this.activeAuction = snapshot.activeAuction ? cloneAuction(snapshot.activeAuction) : null;
      this.pendingTrades = snapshot.pendingTrades.map(cloneTrade);
      this.winners = [...snapshot.winners];
      this.activeTradeDetail = null;
      this.pausedByPlayerId = null;
      this.pauseCountdownSeconds = 0;
      this.dyingPlayerId = null;
      this.rescueWindowEndsAt = null;
    },
    setMap(board: TilePublicView[], playerOrder: PlayerId[]) {
      this.board = board.map(cloneTile);
      this.playerOrder = [...playerOrder];
    },
    startTurn(playerId: PlayerId, turnNumber: number, phase: TurnPhase) {
      this.currentTurnPlayerId = playerId;
      this.turnNumber = turnNumber;
      this.currentPhase = phase;
      this.availableActions = [];
      this.pendingTaxAmount = null;
    },
    setPendingTaxAmount(amount: number | null) {
      this.pendingTaxAmount = amount;
    },
    setAvailableActions(actions: string[]) {
      this.availableActions = [...actions];
    },
    setStatus(status: GameStatus) {
      this.status = status;
    },
    setCurrentPhase(phase: TurnPhase) {
      this.currentPhase = phase;
    },
    setCurrentTurnPlayerId(playerId: PlayerId | null) {
      this.currentTurnPlayerId = playerId;
    },
    setActiveAuction(auction: AuctionPublicView | null) {
      this.activeAuction = auction ? cloneAuction(auction) : null;
    },
    patchAuction(patch: Partial<AuctionPublicView>) {
      if (!this.activeAuction) return;
      if (patch.currentBid !== undefined) this.activeAuction.currentBid = patch.currentBid;
      if (patch.currentLeaderId !== undefined) this.activeAuction.currentLeaderId = patch.currentLeaderId;
      if (patch.roundDeadlineAt !== undefined) this.activeAuction.roundDeadlineAt = patch.roundDeadlineAt;
      if (patch.status !== undefined) this.activeAuction.status = patch.status;
      if (patch.activePlayerIds) this.activeAuction.activePlayerIds = [...patch.activePlayerIds];
      if (patch.passedPlayerIds) this.activeAuction.passedPlayerIds = [...patch.passedPlayerIds];
      if (patch.winnerId !== undefined) this.activeAuction.winnerId = patch.winnerId;
      if (patch.finalPrice !== undefined) this.activeAuction.finalPrice = patch.finalPrice;
    },
    setPendingTrades(trades: TradePublicView[]) {
      this.pendingTrades = trades.map(cloneTrade);
    },
    addTrade(trade: TradePublicView) {
      if (this.pendingTrades.some((t) => t.tradeId === trade.tradeId)) return;
      this.pendingTrades = [...this.pendingTrades, cloneTrade(trade)];
    },
    updateTradeStatus(tradeId: string, status: TradePublicView['status']) {
      const trade = this.pendingTrades.find((t) => t.tradeId === tradeId);
      if (trade) trade.status = status;
    },
    removeTrade(tradeId: string) {
      this.pendingTrades = this.pendingTrades.filter((t) => t.tradeId !== tradeId);
    },
    setActiveTradeDetail(detail: TradeDetail | null) {
      if (!detail) {
        this.activeTradeDetail = null;
        return;
      }
      this.activeTradeDetail = {
        tradeId: detail.tradeId,
        proposerOffer: { ...detail.proposerOffer, tileIds: [...detail.proposerOffer.tileIds] },
        responderOffer: { ...detail.responderOffer, tileIds: [...detail.responderOffer.tileIds] },
      };
    },
    setWinners(winners: PlayerId[]) {
      this.winners = [...winners];
    },
    setTileOwner(tileId: number, ownerId: PlayerId | null) {
      const tile = this.board.find((item) => item.id === tileId);
      if (tile) tile.ownerId = ownerId;
    },
    setTileMortgage(tileId: number, isMortgaged: boolean) {
      const tile = this.board.find((item) => item.id === tileId);
      if (tile) tile.isMortgaged = isMortgaged;
    },
    setTileBuildingLevel(tileId: number, buildingLevel: number) {
      const tile = this.board.find((item) => item.id === tileId);
      if (tile) tile.buildingLevel = buildingLevel;
    },
    setTileLit(tileId: number, isLit: boolean) {
      const tile = this.board.find((item) => item.id === tileId);
      if (tile) tile.isLit = isLit;
    },
    setPausedInfo(playerId: PlayerId, seconds: number) {
      this.pausedByPlayerId = playerId;
      this.pauseCountdownSeconds = seconds;
    },
    clearPausedInfo() {
      this.pausedByPlayerId = null;
      this.pauseCountdownSeconds = 0;
    },
    setDyingPlayer(playerId: PlayerId, rescueWindowMs: number) {
      this.dyingPlayerId = playerId;
      this.rescueWindowEndsAt = Date.now() + rescueWindowMs;
    },
    clearDyingPlayer() {
      this.dyingPlayerId = null;
      this.rescueWindowEndsAt = null;
    },
  },
});
