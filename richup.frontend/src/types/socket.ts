import type {
  AuctionPublicView,
  BankruptcyType,
  DesensitizedGameState,
  PlayerId,
  PlayerSelfView,
  PropCardType,
  TileId,
  TilePublicView,
  TileType,
  TradeDetail,
  TradePublicView,
  TradeVoidReason,
  TurnPhase,
} from '@/types';

export interface SocketSessionAuth {
  roomId: string;
  sessionToken?: string;
  nickname?: string;
}

export interface ReconnectActionPayload {
  sessionToken: string;
  roomId: string;
}

/** Sent only to the reconnecting player. Replaces the old flat payload. */
export interface ReconnectSuccessPayload {
  selfView: PlayerSelfView;
  gameSnapshot: DesensitizedGameState;
}

export interface CashUpdatedPayload {
  newBalance: number;
  delta: number;
  reason: string;
}

export interface MapGeneratedPayload {
  board: TilePublicView[];
  playerOrder: PlayerId[];
}

export interface TurnStartedPayload {
  playerId: PlayerId;
  turnNumber: number;
  phase: TurnPhase;
  timeoutMs?: number;
}

export interface TurnEndedPayload {
  playerId: PlayerId;
}

export interface PlayerMovedPayload {
  playerId: PlayerId;
  fromPosition: number;
  toPosition: number;
  passedGo: boolean;
}

export interface GameOverPayload {
  winnerIds: PlayerId[];
  standings: Array<{
    playerId: PlayerId;
    rank: number;
  }>;
}

export interface TileEventPayload {
  playerId: PlayerId;
  tileId: TileId;
  tileType: TileType;
  phase: TurnPhase;
  availableActions: string[];
  taxAmount?: number;
}

export interface PropertyPurchasedPayload {
  tileId: TileId;
  buyerId: PlayerId;
  price: number;
}

export interface PropertyMortgagedPayload {
  playerId: PlayerId;
  tileId: TileId;
  mortgageValue: number;
}

export interface PropertyUnmortgagedPayload {
  playerId: PlayerId;
  tileId: TileId;
  redemptionCost: number;
}

export interface PropertyFreedPayload {
  tileId: TileId;
  previousOwnerId: PlayerId;
  newOwnerId: null;
}

export interface BuildingBuiltPayload {
  tileId: TileId;
  ownerId: PlayerId;
  cost: number;
  newBuildingLevel: number;
}

export interface BuildingSoldPayload {
  tileId: TileId;
  ownerId: PlayerId;
  refund: number;
  newBuildingLevel: number;
}

export interface ImmunityUsedPayload {
  playerId: PlayerId;
  tileId: TileId;
}

export interface PriceHikeExpiredPayload {
  playerId: PlayerId;
}

export interface JailAutoReleasedPayload {
  playerId: PlayerId;
}

export interface PlayerDyingPayload {
  playerId: PlayerId;
  rescueWindowMs: number;
}

export interface PlayerRescuedPayload {
  playerId: PlayerId;
}

export interface PlayerBankruptPayload {
  playerId: PlayerId;
  bankruptType: BankruptcyType;
  creditorId?: PlayerId;
}

export interface PlayerDisconnectedPayload {
  playerId: PlayerId;
  afkWarningMs: number;
}

export interface PlayerReconnectedPayload {
  playerId: PlayerId;
}

export interface GamePausedPayload {
  disconnectedPlayerId: PlayerId;
  reconnectWindowSeconds: number;
}

export interface GameResumedPayload {
  currentTurnPlayerId: PlayerId;
  currentTurnPhase: TurnPhase;
}

export interface TempleLitPayload {
  tileId: TileId;
  isLit: true;
}

export interface DiceRolledPayload {
  playerId: PlayerId;
  die1: number;
  die2: number;
  isDouble: boolean;
  totalSteps: number;
}

export interface DiceOverridePayload {
  playerId: PlayerId;
  steps: number;
  source: 'REMOTE_DICE';
}

export interface SurpriseRampagePayload {
  playerId: PlayerId;
}

export interface RentChargedPayload {
  from: PlayerId;
  to: string;
  tileId: TileId;
  amount: number;
}

export interface TaxPaidPayload {
  playerId: PlayerId;
  amount: number;
}

export interface SurpriseResultPayload {
  playerId: PlayerId;
  cashDelta?: number;
  cardDescription: string;
}

export interface CasinoResultPayload {
  playerId: PlayerId;
  betAmount: number;
  outcome: 'WIN' | 'LOSE' | 'BREAK_EVEN';
  cashDelta: number;
}

export interface ActionRejectedPayload {
  action: string;
  reason: string;
  code: 'WRONG_PHASE' | 'NOT_YOUR_TURN' | 'INVALID_INPUT' | 'INSUFFICIENT_FUNDS' | 'BID_LOCKED' | 'RULE_VIOLATION';
}

export interface AuctionStartedPayload {
  auction: AuctionPublicView;
}

export interface AuctionBidPlacedPayload {
  auctionId: string;
  bidderId: PlayerId;
  bidAmount: number;
  currentLeaderId: PlayerId;
  roundDeadlineAt: number;
}

export interface AuctionPlayerPassedPayload {
  auctionId: string;
  passedPlayerId: PlayerId;
  remainingActiveCount: number;
}

export interface AuctionHammerDownPayload {
  auctionId: string;
  winnerId: PlayerId;
  finalPrice: number;
  tileId: TileId;
}

export interface AuctionNoSalePayload {
  auctionId: string;
  tileId: TileId;
}

export interface AuctionBidRejectedPayload {
  reason: 'INSUFFICIENT_FUNDS' | 'BID_NOT_HIGHER' | 'AUCTION_CLOSED';
  currentBid?: number;
}

export interface StartPassedPayload {
  playerId: PlayerId;
  bonusAmount: number;
}

export interface StartLandedPayload {
  playerId: PlayerId;
  passBonusAmount: number;
  landBonusAmount: number;
}

// ── Trade events ──────────────────────────────────────────────────────────

/** Broadcast: new trade proposal. Payload matches TradePublicView. */
export type TradeProposedPayload = TradePublicView;

export interface TradeAcceptedPayload {
  tradeId: string;
}

export interface TradeRejectedPayload {
  tradeId: string;
}

export interface TradeCancelledPayload {
  tradeId: string;
}

export interface TradeCompletedPayload {
  tradeId: string;
  tileTransfers: Array<{ tileId: TileId; newOwnerId: PlayerId }>;
  cashAmount: number;
}

export interface TradeVoidedPayload {
  tradeId: string;
  reason: TradeVoidReason;
}

/** Private (to trade parties only): full offer details including cash. */
export type TradeDetailPayload = TradeDetail;

// ── Prop card events ──────────────────────────────────────────────────────

/** Broadcast: who used a card and what type (no private details). */
export interface PropCardUsedPayload {
  playerId: PlayerId;
  cardType: PropCardType;
  targetPlayerId?: PlayerId;
  targetTileId?: TileId;
}

/** Broadcast: who drew a card (card type is private, no card details). */
export interface PropCardDrawnPayload {
  playerId: PlayerId;
}

export interface ForcedTradeExecutedPayload {
  from: PlayerId;
  to: PlayerId;
  tileId: TileId;
  price: number;
}

export interface PlunderExecutedPayload {
  from: PlayerId;
  to: PlayerId;
  amount: number;
}

// ── Game status events ────────────────────────────────────────────────────

export interface WhaleFallPayload {
  playerId: PlayerId;
  reason: 'DISCONNECT_TIMEOUT' | 'AFK_IN_RESCUE';
}

export interface DyingRescueAfkWarningPayload {
  playerId: PlayerId;
  remainingSeconds: number;
}

// ── Error / blocked events ────────────────────────────────────────────────

export interface OperationBlockedPayload {
  reason: 'BID_LOCKED';
  lockedAmount: number;
}

export interface AuditResultPayload {
  playerCashMap: Record<PlayerId, number>;
}
