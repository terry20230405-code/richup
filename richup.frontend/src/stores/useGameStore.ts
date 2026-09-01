import { defineStore } from 'pinia';

import type {
  AuctionPublicView,
  BuildingLevel,
  DesensitizedGameState,
  DyingRescueDetail,
  GameStatus,
  PlayerId,
  TradeDetail,
  TradePublicView,
  TilePublicView,
  TurnPhase,
} from '@/types';

interface DiceUiState {
  isRolling: boolean;
  isResolving: boolean;
  rollingSince: number | null;
  result: [number, number] | null;
  nonce: number;
}

type DirectorEffect =
  | {
      type: 'DICE_REVEAL';
      payload: {
        phase: TurnPhase;
        availableActions: string[];
        logType: 'info';
        logMessage: string;
      };
    }
  | {
      type: 'PLAYER_MOVED';
      payload: {
        playerId: PlayerId;
        toPosition: number;
        fromPosition: number;
      };
    }
  | {
      type: 'TILE_EVENT';
      payload: {
        playerId: PlayerId;
        tileId: number;
        phase: TurnPhase;
        availableActions: string[];
        taxAmount: number | null;
        logType: 'info';
        logMessage: string;
      };
    }
  | {
      type: 'TURN_READY';
      payload: {
        playerId: PlayerId;
        phase: TurnPhase;
        availableActions: string[];
      };
    }
  | {
      type: 'RENT_CHARGED';
      payload: {
        phase: TurnPhase | null;
        availableActions: string[];
        logType: 'warn' | 'positive' | 'info';
        logMessage: string;
      };
    };

export type { DirectorEffect };

interface DirectorState {
  activeSequence: 'dice-roll' | null;
  sequenceId: number;
  windowStartedAt: number | null;
  windowEndsAt: number | null;
  durationMs: number;
  isBlockingSpoilers: boolean;
  pendingEffects: DirectorEffect[];
}

interface GameState {
  roomId: string;
  hostId: PlayerId | null;
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
  tradeDetails: Record<string, TradeDetail>;
  /** Set when status === 'PAUSED'. Cleared on GAME_RESUMED. */
  pausedByPlayerId: PlayerId | null;
  pauseDeadlineAt: number | null;
  /** Set when a player enters DYING phase. Cleared on PLAYER_RESCUED / PLAYER_BANKRUPT. */
  dyingPlayerId: PlayerId | null;
  rescueWindowEndsAt: number | null;
  rescueAmountOwed: number | null;
  rescueCreditorId: PlayerId | null;
  /** Set when landing on a TAX tile. Cleared on TAX_PAID or turn start. */
  pendingTaxAmount: number | null;
  diceUi: DiceUiState;
  director: DirectorState;
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

const cloneTradeDetail = (detail: TradeDetail): TradeDetail => ({
  tradeId: detail.tradeId,
  proposerOffer: {
    ...detail.proposerOffer,
    tileIds: [...detail.proposerOffer.tileIds],
    propCardIds: [...(detail.proposerOffer.propCardIds ?? [])],
  },
  responderOffer: {
    ...detail.responderOffer,
    tileIds: [...detail.responderOffer.tileIds],
    propCardIds: [...(detail.responderOffer.propCardIds ?? [])],
  },
});

const createInitialDiceUiState = (): DiceUiState => ({
  isRolling: false,
  isResolving: false,
  rollingSince: null,
  result: null,
  nonce: 0,
});

const createInitialDirectorState = (): DirectorState => ({
  activeSequence: null,
  sequenceId: 0,
  windowStartedAt: null,
  windowEndsAt: null,
  durationMs: 0,
  isBlockingSpoilers: false,
  pendingEffects: [],
});

const defaultActionsForPhase = (phase: TurnPhase): string[] => {
  if (phase === 'JAIL_DECISION') return ['PAY_BAIL', 'ROLL_FOR_DOUBLE'];
  if (phase === 'WAITING_FOR_ACTION') return ['ROLL_DICE'];
  if (phase === 'END_TURN_PENDING') return ['END_TURN'];
  return [];
};

const createInitialGameState = (): GameState => ({
  roomId: '',
  hostId: null,
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
  tradeDetails: {},
  pausedByPlayerId: null,
  pauseDeadlineAt: null,
  dyingPlayerId: null,
  rescueWindowEndsAt: null,
  rescueAmountOwed: null,
  rescueCreditorId: null,
  pendingTaxAmount: null,
  diceUi: createInitialDiceUiState(),
  director: createInitialDirectorState(),
});

const DIRECTOR_REVEAL_MS = 2000;
const DICE_UI_FAILSAFE_MS = 4200;
let directorTimer: ReturnType<typeof setTimeout> | null = null;
let diceUiFailsafeTimer: ReturnType<typeof setTimeout> | null = null;

export const useGameStore = defineStore('game', {
  state: (): GameState => createInitialGameState(),
  getters: {
    hasBoard: (state) => state.board.length > 0,
    boardById: (state) => Object.fromEntries(state.board.map((tile) => [tile.id, tile])),
    isDirectorBlocking: (state) => state.director.isBlockingSpoilers,
  },
  actions: {
    clearDirectorTimer() {
      if (directorTimer) {
        clearTimeout(directorTimer);
        directorTimer = null;
      }
    },
    resetDirector() {
      this.clearDirectorTimer();
      this.director = createInitialDirectorState();
    },
    clearDiceUiFailsafe() {
      if (diceUiFailsafeTimer) {
        clearTimeout(diceUiFailsafeTimer);
        diceUiFailsafeTimer = null;
      }
    },
    armDiceUiFailsafe() {
      this.clearDiceUiFailsafe();
      diceUiFailsafeTimer = setTimeout(() => {
        diceUiFailsafeTimer = null;
        this.diceUi.isRolling = false;
        this.diceUi.isResolving = false;
        this.diceUi.rollingSince = null;
      }, DICE_UI_FAILSAFE_MS);
    },
    queueDirectorEffect(effect: DirectorEffect) {
      this.director.pendingEffects = [...this.director.pendingEffects, effect];
    },
    beginDirectedDiceSequence(result: [number, number]) {
      this.clearDirectorTimer();
      const startedAt = Date.now();
      const endsAt = startedAt + DIRECTOR_REVEAL_MS;
      this.director = {
        activeSequence: 'dice-roll',
        sequenceId: this.director.sequenceId + 1,
        windowStartedAt: startedAt,
        windowEndsAt: endsAt,
        durationMs: DIRECTOR_REVEAL_MS,
        isBlockingSpoilers: true,
        pendingEffects: [],
      };
      this.resolveDiceRoll(result);
    },
    flushDirectorEffects() {
      this.director.pendingEffects = [];
      this.director.activeSequence = null;
      this.director.windowStartedAt = null;
      this.director.windowEndsAt = null;
      this.director.durationMs = 0;
      this.director.isBlockingSpoilers = false;
      this.clearDirectorTimer();
    },
    reset() {
      this.clearDirectorTimer();
      this.clearDiceUiFailsafe();
      Object.assign(this, createInitialGameState());
    },
    hydrate(snapshot: DesensitizedGameState) {
      this.resetDirector();
      this.roomId = snapshot.roomId;
      this.hostId = snapshot.hostId;
      this.status = snapshot.status;
      this.currentPhase = snapshot.currentPhase;
      this.currentTurnPlayerId = snapshot.currentTurnPlayerId;
      this.turnNumber = snapshot.turnNumber;
      this.playerOrder = [...snapshot.playerOrder];
      this.board = snapshot.board.map(cloneTile);
      this.activeAuction = snapshot.activeAuction ? cloneAuction(snapshot.activeAuction) : null;
      this.pendingTrades = snapshot.pendingTrades.map(cloneTrade);
      this.winners = [...snapshot.winners];
      this.availableActions = defaultActionsForPhase(snapshot.currentPhase);
      this.tradeDetails = {};
      this.pausedByPlayerId = snapshot.pause?.disconnectedPlayerId ?? null;
      this.pauseDeadlineAt = snapshot.pause?.reconnectDeadlineAt ?? null;
      this.dyingPlayerId = snapshot.dyingRescue?.playerId ?? null;
      this.rescueWindowEndsAt = snapshot.dyingRescue?.rescueDeadlineAt ?? null;
      this.rescueAmountOwed = null;
      this.rescueCreditorId = null;
      this.pendingTaxAmount = null;
      this.resetDiceUi();
    },
    setMap(board: TilePublicView[], playerOrder: PlayerId[]) {
      this.board = board.map(cloneTile);
      this.playerOrder = [...playerOrder];
    },
    startTurn(playerId: PlayerId, turnNumber: number, phase: TurnPhase) {
      this.resetDirector();
      this.currentTurnPlayerId = playerId;
      this.turnNumber = turnNumber;
      this.currentPhase = phase;
      this.availableActions = defaultActionsForPhase(phase);
      this.pendingTaxAmount = null;
      this.resetDiceUi();
    },
    beginDiceRoll() {
      this.diceUi.isRolling = true;
      this.diceUi.isResolving = false;
      this.diceUi.rollingSince = Date.now();
      this.diceUi.result = null;
      this.diceUi.nonce += 1;
      this.armDiceUiFailsafe();
    },
    resolveDiceRoll(result: [number, number]) {
      if (!this.diceUi.isRolling) {
        this.diceUi.isRolling = true;
        this.diceUi.rollingSince = Date.now();
        this.diceUi.nonce += 1;
      }
      this.diceUi.isResolving = true;
      this.diceUi.result = result;
      this.armDiceUiFailsafe();
    },
    finishDiceRollAnimation() {
      this.clearDiceUiFailsafe();
      this.diceUi.isRolling = false;
      this.diceUi.isResolving = false;
      this.diceUi.rollingSince = null;
    },
    resetDiceUi() {
      this.clearDiceUiFailsafe();
      this.diceUi = createInitialDiceUiState();
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
    setHostId(hostId: PlayerId) {
      this.hostId = hostId;
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
      const { [tradeId]: _removed, ...remainingDetails } = this.tradeDetails;
      this.tradeDetails = remainingDetails;
    },
    setTradeDetail(detail: TradeDetail) {
      this.tradeDetails = {
        ...this.tradeDetails,
        [detail.tradeId]: cloneTradeDetail(detail),
      };
    },
    setTradeDetails(details: TradeDetail[]) {
      this.tradeDetails = Object.fromEntries(
        details.map(detail => [detail.tradeId, cloneTradeDetail(detail)]),
      );
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
    setTileBuildingLevel(tileId: number, buildingLevel: BuildingLevel) {
      const tile = this.board.find((item) => item.id === tileId);
      if (tile) tile.buildingLevel = buildingLevel;
    },
    setTileLit(tileId: number, isLit: boolean) {
      const tile = this.board.find((item) => item.id === tileId);
      if (tile) tile.isLit = isLit;
    },
    setPausedInfo(playerId: PlayerId, reconnectDeadlineAt: number) {
      this.pausedByPlayerId = playerId;
      this.pauseDeadlineAt = reconnectDeadlineAt;
    },
    clearPausedInfo() {
      this.pausedByPlayerId = null;
      this.pauseDeadlineAt = null;
    },
    setDyingPlayer(playerId: PlayerId, rescueDeadlineAt: number) {
      this.dyingPlayerId = playerId;
      this.rescueWindowEndsAt = rescueDeadlineAt;
    },
    setSelfRescueDetail(detail: DyingRescueDetail | null) {
      this.rescueAmountOwed = detail?.amountOwed ?? null;
      this.rescueCreditorId = detail?.creditorId ?? null;
      if (detail) {
        this.rescueWindowEndsAt = detail.rescueDeadlineAt;
        this.availableActions = [...detail.availableActions];
      }
    },
    clearDyingPlayer() {
      this.dyingPlayerId = null;
      this.rescueWindowEndsAt = null;
      this.rescueAmountOwed = null;
      this.rescueCreditorId = null;
    },
  },
});
