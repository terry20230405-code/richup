import type { PlayerId, RoomId, TileId, Money, Timestamp } from './Common.types';
import type { Player } from './Player.types';
import type { Tile } from './Tile.types';
import type { AuctionSession } from './Auction.types';
import type { Trade } from './Trade.types';

// ─── Turn Phase ───────────────────────────────────────────────────────────────

/**
 * The state machine phase for the current turn.
 * StateMachine.ts is the sole writer of session.currentPhase.
 */
export enum TurnPhase {
  WAITING_FOR_ACTION  = 'WAITING_FOR_ACTION',
  ROLLING_DICE        = 'ROLLING_DICE',
  MOVING              = 'MOVING',
  EVENT_TRIGGER       = 'EVENT_TRIGGER',
  AUCTION_IN_PROGRESS = 'AUCTION_IN_PROGRESS',
  BUILD_PHASE         = 'BUILD_PHASE',
  JAIL_DECISION       = 'JAIL_DECISION',
  DYING_RESCUE        = 'DYING_RESCUE',
  END_TURN_PENDING    = 'END_TURN_PENDING',
  TURN_TRANSITIONING  = 'TURN_TRANSITIONING',
}

// ─── Game Status ─────────────────────────────────────────────────────────────

export enum GameStatus {
  LOBBY       = 'LOBBY',
  STARTING    = 'STARTING',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED      = 'PAUSED',       // Current-turn player disconnected
  FINISHED    = 'FINISHED',
}

// ─── Bankruptcy ───────────────────────────────────────────────────────────────

export enum BankruptcyType {
  TYPE_A = 'TYPE_A',  // Owes tax/system: assets liquidated and destroyed
  TYPE_B = 'TYPE_B',  // Owes rent to another player: partial transfer
}

// ─── Surprise Card ───────────────────────────────────────────────────────────

export enum SurpriseCardType {
  CASH_GAIN   = 'CASH_GAIN',   // Receive fixed cash from Bank
  CASH_LOSS   = 'CASH_LOSS',   // Pay fixed cash to Bank
  PROP_CARD   = 'PROP_CARD',   // Draw one random PropCard
  RAMPAGE     = 'RAMPAGE',     // Extra dice roll, move again
}

export interface SurpriseCard {
  id: string;
  type: SurpriseCardType;
  amount: Money;          // 0 for PROP_CARD and RAMPAGE
  description: string;    // Localizable display text
}

// ─── Game Config ─────────────────────────────────────────────────────────────

/**
 * All numeric game constants — NO hardcoded values here.
 * Populated from config/GameConfig.ts with placeholder defaults.
 */
export interface GameConfig {
  startingCash: Money;
  goSalary: Money;                // Pass GO bonus
  goLandBonus: Money;             // Extra bonus for exactly landing on GO
  bailCost: Money;                // Cost to pay bail (escape jail immediately)
  jailAutoReleaseAfterTurns: number; // Auto-release after N full turns waited (PRD = 2)
  mortgageInterestRate: number;   // Redemption cost = mortgageValue × (1 + rate)
  buildingRefundRate: number;     // Sell building back at this fraction of build cost (PRD = 0.75)

  // Auction
  auctionRoundMs: number;         // Per-round timer for each bid opportunity
  startingBid: Money;             // Always 0 per PRD

  // Dying rescue
  dyingRescueTotalMs: number;     // Max window to self-rescue (PRD = 10 min)
  dyingRescueAfkWarningMs: number; // AFK warning sent at this point before kick (PRD = 2 min before)
  dyingRescueAfkKickMs: number;   // AFK kick threshold (PRD = 10 min total)

  // Disconnect
  reconnectWindowMs: number;      // How long to wait before whale-fall (PRD = 5 min)

  // Casino
  casinoBetMultiple: Money;       // Bets must be multiples of this (PRD = 50)

  // Temple
  templeLitThreshold: number;     // Number of prayers to light (PRD = 3)
  templePrayFee: Money;           // Cost per prayer

  // Price Hike card
  priceHikeMultiplier: number;    // Rent multiplier while active (PRD = 1.5)
}

// ─── Pending Action ──────────────────────────────────────────────────────────

/** Context for the current tile event awaiting a player decision */
export interface PendingTileEvent {
  tileId: TileId;
  availableActions: string[];  // e.g. ['BUY_PROPERTY', 'CHOOSE_AUCTION', 'SKIP_PURCHASE']
  taxAmount?: number;          // Set for TAX tiles — stored until PAY_TAX action arrives
}

/** Context for a pending bankruptcy resolution */
export interface PendingBankruptcy {
  playerId: PlayerId;
  type: BankruptcyType;
  creditorId: PlayerId | null;  // null for TYPE_A
  amountOwed: Money;
}

// ─── Dying Rescue State ──────────────────────────────────────────────────────

export interface DyingRescueState {
  playerId: PlayerId;
  startedAt: Timestamp;
  lastActionAt: Timestamp;      // Resets the AFK timer on any valid action
  afkWarningSentAt: Timestamp | null;
}

// ─── Game Session ─────────────────────────────────────────────────────────────

export interface GameSession {
  id: RoomId;
  status: GameStatus;
  config: GameConfig;

  // Board
  board: Tile[];               // Array of length 56, indexed by TileId

  // Players
  players: Map<PlayerId, Player>;
  playerOrder: PlayerId[];     // Active turn order; bankrupt players are removed
  currentPlayerIndex: number;  // Index into playerOrder

  // Turn tracking
  currentPhase: TurnPhase;
  phaseEnteredAt: Timestamp;
  turnNumber: number;          // Increments each time currentPlayerIndex wraps
  roundNumber: number;         // Full circuits through all players

  // Current move context
  lastDiceRoll: { die1: number; die2: number; isDouble: boolean; total: number } | null;
  pendingTileEvent: PendingTileEvent | null;

  // Sub-systems
  activeAuction: AuctionSession | null;
  activeTrades: Map<string, Trade>;  // tradeId → Trade

  // Card decks
  surpriseDeck: SurpriseCard[];
  surpriseDiscardPile: SurpriseCard[];

  // Dying rescue
  dyingRescue: DyingRescueState | null;

  // Pending bankruptcy (set when player enters DYING_RESCUE, resolved on DECLARE_BANKRUPTCY)
  pendingBankruptcy: PendingBankruptcy | null;

  // Game metadata
  hostId: PlayerId;
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  finishedAt: Timestamp | null;
  winnerIds: PlayerId[];

  // Pause state (for current-turn player disconnection)
  pausedAt: Timestamp | null;
  disconnectedCurrentPlayerId: PlayerId | null;
}
