export type GameStatus = 'LOBBY' | 'STARTING' | 'IN_PROGRESS' | 'PAUSED' | 'FINISHED';

export type TurnPhase =
  | 'WAITING_FOR_ACTION'
  | 'ROLLING_DICE'
  | 'MOVING'
  | 'EVENT_TRIGGER'
  | 'AUCTION_IN_PROGRESS'
  | 'JAIL_DECISION'
  | 'DYING_RESCUE'
  | 'END_TURN_PENDING'
  | 'TURN_TRANSITIONING';

export type PlayerStatus = 'ACTIVE' | 'DYING' | 'BANKRUPT' | 'DISCONNECTED';

export type AuctionStatus = 'OPEN' | 'RESOLVED' | 'NO_SALE' | 'CANCELLED';
export type BuildingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TileType =
  | 'PROPERTY'
  | 'AIRPORT'
  | 'TEMPLE'
  | 'CASINO'
  | 'TAX'
  | 'SURPRISE'
  | 'GO'
  | 'JAIL'
  | 'GO_TO_JAIL'
  | 'FREE';

export enum PropCardType {
  FORCED_TRADE = 'FORCED_TRADE',
  REMOTE_DICE = 'REMOTE_DICE',
  PLUNDER = 'PLUNDER',
  IMMUNITY = 'IMMUNITY',
  AUDIT = 'AUDIT',
  PRICE_HIKE = 'PRICE_HIKE',
}

export type BankruptcyType = 'TYPE_A' | 'TYPE_B';
export type TradeVoidReason =
  | 'PLAYER_ROLLED'
  | 'PLAYER_JAILED'
  | 'PLAYER_DYING'
  | 'PLAYER_BANKRUPT'
  | 'PLAYER_DISCONNECTED'
  | 'GAME_ENDED';

export type TileId = number;
export type PlayerId = string;

export interface RoomSummary {
  id: string;
  hostNickname: string;
  playerCount: number;
  status: GameStatus;
  createdAt: number;
}

export interface TilePublicView {
  id: TileId;
  type: TileType;
  name: string;
  colorGroup?: string;
  basePrice?: number;
  mortgageValue?: number;
  ownerId?: PlayerId | null;
  buildingLevel?: BuildingLevel;
  buildCost?: number;
  isMortgaged?: boolean;
  isLit?: boolean;
  baseRent?: number;
  baseRentWithMonopoly?: number;
  rentByLevel?: [number, number, number, number, number, number, number];
  rentTable?: number[];
  prayFee?: number;
  passThruToll?: number;
  betMultiple?: number;
  maxBet?: number;
}

export interface PlayerPublicView {
  id: PlayerId;
  nickname: string;
  avatarIndex: number;
  color: string;
  position: TileId;
  previousPosition: TileId;
  inJail: boolean;
  jailTurnsWaited: number;
  status: PlayerStatus;
  isConnected: boolean;
}

export interface PropCard {
  id: string;
  type: PropCardType;
}

export interface PlayerSelfView extends PlayerPublicView {
  cash: number;
  propCards: PropCard[];
  hasImmunity: boolean;
  priceHikeActive: boolean;
  constructibleTileIds: TileId[];
}

export interface AuctionPublicView {
  id: string;
  tileId: TileId;
  status: AuctionStatus;
  currentBid: number;
  currentLeaderId: PlayerId | null;
  activePlayerIds: PlayerId[];
  passedPlayerIds: PlayerId[];
  winnerId: PlayerId | null;
  finalPrice: number | null;
  roundDeadlineAt: number;
}

export interface TradeOffer {
  cash?: number;
  tileIds: TileId[];
  propCardIds?: string[];
}

export interface TradePublicView {
  tradeId: string;
  proposerId: PlayerId;
  responderId: PlayerId;
  proposerTileIds: TileId[];
  responderTileIds: TileId[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'VOIDED';
  proposedAt: number;
}

export interface TradeDetail {
  tradeId: string;
  proposerOffer: TradeOffer;
  responderOffer: TradeOffer;
}

export interface DyingRescuePublicView {
  playerId: PlayerId;
  rescueDeadlineAt: number;
}

export interface DyingRescueDetail {
  amountOwed: number;
  creditorId: PlayerId | null;
  bankruptcyType: BankruptcyType;
  rescueDeadlineAt: number;
  availableActions: string[];
}

export interface DesensitizedGameState {
  roomId: string;
  hostId: PlayerId;
  status: GameStatus;
  currentPhase: TurnPhase;
  currentTurnPlayerId: PlayerId | null;
  turnNumber: number;
  playerOrder: PlayerId[];
  board: TilePublicView[];
  players: PlayerPublicView[];
  activeAuction: AuctionPublicView | null;
  pendingTrades: TradePublicView[];
  dyingRescue: DyingRescuePublicView | null;
  pause: {
    disconnectedPlayerId: PlayerId;
    reconnectDeadlineAt: number;
  } | null;
  winners: PlayerId[];
}

export interface ProposeTrade {
  responderId: PlayerId;
  proposerOffer: TradeOffer;
  responderOffer: TradeOffer;
}

export interface UsePropCard {
  cardId: string;
  cardType: PropCardType;
  targetPlayerId?: PlayerId;
  targetTileId?: TileId;
  steps?: 5 | 6 | 7;
}
