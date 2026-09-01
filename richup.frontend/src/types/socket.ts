import type {
  AuctionPublicView,
  BankruptcyType,
  DesensitizedGameState,
  DyingRescueDetail,
  PlayerId,
  PlayerPublicView,
  PlayerStatus,
  PlayerSelfView,
  ProposeTrade,
  PropCard,
  PropCardType,
  TileId,
  TilePublicView,
  TileType,
  TradeDetail,
  TradePublicView,
  TradeVoidReason,
  TurnPhase,
  UsePropCard,
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
  rescueDetail: DyingRescueDetail | null;
  tradeDetails: TradeDetail[];
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
  timeoutMs: number;
}

export interface TurnEndedPayload {
  playerId: PlayerId;
}

export interface TurnReadyPayload {
  playerId: PlayerId;
  phase: TurnPhase;
  availableActions: string[];
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
  newBuildingLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

export interface BuildingSoldPayload {
  tileId: TileId;
  ownerId: PlayerId;
  refund: number;
  newBuildingLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
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

export interface JailReleasedPayload {
  playerId: PlayerId;
}

export interface PlayerDyingPayload {
  playerId: PlayerId;
  rescueWindowMs: number;
  rescueDeadlineAt: number;
  phase: 'DYING_RESCUE';
}

export type DyingRescueDetailPayload = DyingRescueDetail;

export interface PlayerRescuedPayload {
  playerId: PlayerId;
}

export interface PlayerBankruptPayload {
  playerId: PlayerId;
  bankruptType: BankruptcyType;
  creditorId: PlayerId | null;
}

export interface PlayerDisconnectedPayload {
  playerId: PlayerId;
  afkWarningMs: number;
  status: PlayerStatus;
}

export interface PlayerReconnectedPayload {
  playerId: PlayerId;
  status: PlayerStatus;
}

export interface LobbyStateUpdatedPayload {
  hostId: PlayerId;
  players: PlayerPublicView[];
}

export interface GamePausedPayload {
  disconnectedPlayerId: PlayerId;
  reconnectWindowSeconds: number;
  reconnectDeadlineAt: number;
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
  steps: 5 | 6 | 7;
  source: 'REMOTE_DICE';
}

export interface SurpriseRampagePayload {
  playerId: PlayerId;
}

export interface RentChargedPayload {
  from: PlayerId;
  to: PlayerId | 'BANK';
  tileId: TileId;
  amount: number;
  phase?: TurnPhase;
  availableActions?: string[];
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
  phase: TurnPhase;
  availableActions: string[];
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
  activePlayerIds: PlayerId[];
  passedPlayerIds: PlayerId[];
  currentLeaderId: PlayerId | null;
  currentBid: number;
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
  reason?: string;
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

/** Private: authoritative hand snapshot for the current player. */
export interface PropCardsUpdatedPayload {
  propCards: PropCard[];
}

export interface ForcedTradeExecutedPayload {
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
  tileId: TileId;
  price: number;
}

export interface PlunderExecutedPayload {
  fromPlayerId: PlayerId;
  toPlayerId: PlayerId;
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
  requestedByPlayerId: PlayerId;
  playerCashMap: Record<PlayerId, number>;
}

type EmptyActionPayload = Record<string, never>;
type AmountActionPayload = { amount: number };
type TileActionPayload = { tileId: TileId };
type TradeDecisionPayload = { tradeId: string };

/** Client action name and payload must move together. */
export interface ClientActionPayloads {
  'action:START_GAME': EmptyActionPayload;
  'action:ROLL_DICE': EmptyActionPayload;
  'action:ROLL_FOR_DOUBLE': EmptyActionPayload;
  'action:END_TURN': EmptyActionPayload;
  'action:DECLARE_BANKRUPTCY': EmptyActionPayload;
  'action:BUY_PROPERTY': EmptyActionPayload;
  'action:CHOOSE_AUCTION': EmptyActionPayload;
  'action:SKIP_PURCHASE': EmptyActionPayload;
  'action:TEMPLE_PRAY': EmptyActionPayload;
  'action:CASINO_BET': AmountActionPayload;
  'action:PAY_BAIL': EmptyActionPayload;
  'action:PAY_TAX': EmptyActionPayload;
  'action:AUCTION_BID': AmountActionPayload;
  'action:AUCTION_PASS': EmptyActionPayload;
  'action:BUILD_HOUSE': TileActionPayload;
  'action:BUILD_HOTEL': TileActionPayload;
  'action:SELL_BUILDING': TileActionPayload;
  'action:MORTGAGE': TileActionPayload;
  'action:UNMORTGAGE': TileActionPayload;
  'action:PROPOSE_TRADE': ProposeTrade;
  'action:ACCEPT_TRADE': TradeDecisionPayload;
  'action:REJECT_TRADE': TradeDecisionPayload;
  'action:CANCEL_TRADE': TradeDecisionPayload;
  'action:USE_PROP_CARD': UsePropCard;
  'action:RECONNECT': ReconnectActionPayload;
}

/** Server event name and payload must move together. */
export interface ServerEventPayloads {
  MAP_GENERATED: MapGeneratedPayload;
  TURN_STARTED: TurnStartedPayload;
  TURN_ENDED: TurnEndedPayload;
  TURN_READY: TurnReadyPayload;
  DICE_ROLLED: DiceRolledPayload;
  DICE_OVERRIDE: DiceOverridePayload;
  PLAYER_MOVED: PlayerMovedPayload;
  GAME_OVER: GameOverPayload;
  START_PASSED: StartPassedPayload;
  START_LANDED: StartLandedPayload;
  TILE_EVENT: TileEventPayload;
  PROPERTY_PURCHASED: PropertyPurchasedPayload;
  PROPERTY_MORTGAGED: PropertyMortgagedPayload;
  PROPERTY_UNMORTGAGED: PropertyUnmortgagedPayload;
  PROPERTY_FREED: PropertyFreedPayload;
  BUILDING_BUILT: BuildingBuiltPayload;
  BUILDING_SOLD: BuildingSoldPayload;
  IMMUNITY_USED: ImmunityUsedPayload;
  PRICE_HIKE_EXPIRED: PriceHikeExpiredPayload;
  JAIL_AUTO_RELEASED: JailAutoReleasedPayload;
  JAIL_RELEASED: JailReleasedPayload;
  PLAYER_DYING: PlayerDyingPayload;
  DYING_RESCUE_DETAIL: DyingRescueDetailPayload;
  PLAYER_RESCUED: PlayerRescuedPayload;
  PLAYER_BANKRUPT: PlayerBankruptPayload;
  PLAYER_DISCONNECTED: PlayerDisconnectedPayload;
  PLAYER_RECONNECTED: PlayerReconnectedPayload;
  LOBBY_STATE_UPDATED: LobbyStateUpdatedPayload;
  GAME_PAUSED: GamePausedPayload;
  GAME_RESUMED: GameResumedPayload;
  TEMPLE_LIT: TempleLitPayload;
  SURPRISE_RAMPAGE: SurpriseRampagePayload;
  RENT_CHARGED: RentChargedPayload;
  TAX_PAID: TaxPaidPayload;
  SURPRISE_RESULT: SurpriseResultPayload;
  CASINO_RESULT: CasinoResultPayload;
  AUCTION_STARTED: AuctionStartedPayload;
  AUCTION_BID_PLACED: AuctionBidPlacedPayload;
  AUCTION_PLAYER_PASSED: AuctionPlayerPassedPayload;
  AUCTION_HAMMER_DOWN: AuctionHammerDownPayload;
  AUCTION_NO_SALE: AuctionNoSalePayload;
  TRADE_PROPOSED: TradeProposedPayload;
  TRADE_ACCEPTED: TradeAcceptedPayload;
  TRADE_REJECTED: TradeRejectedPayload;
  TRADE_CANCELLED: TradeCancelledPayload;
  TRADE_COMPLETED: TradeCompletedPayload;
  TRADE_VOIDED: TradeVoidedPayload;
  PROP_CARDS_UPDATED: PropCardsUpdatedPayload;
  PROP_CARD_USED: PropCardUsedPayload;
  PROP_CARD_DRAWN: PropCardDrawnPayload;
  FORCED_TRADE_EXECUTED: ForcedTradeExecutedPayload;
  PLUNDER_EXECUTED: PlunderExecutedPayload;
  WHALE_FALL: WhaleFallPayload;
  DYING_RESCUE_AFK_WARNING: DyingRescueAfkWarningPayload;
  CASH_UPDATED: CashUpdatedPayload;
  RECONNECT_SUCCESS: ReconnectSuccessPayload;
  AUCTION_BID_REJECTED: AuctionBidRejectedPayload;
  ACTION_REJECTED: ActionRejectedPayload;
  OPERATION_BLOCKED: OperationBlockedPayload;
  TRADE_DETAIL: TradeDetailPayload;
  AUDIT_RESULT: AuditResultPayload;
}

export type GameActionEvent = keyof ClientActionPayloads;
export type ClientToServerEvents = {
  [TEvent in keyof ClientActionPayloads]: (payload: ClientActionPayloads[TEvent]) => void;
};
export type ServerToClientEvents = {
  [TEvent in keyof ServerEventPayloads]: (payload: ServerEventPayloads[TEvent]) => void;
};
