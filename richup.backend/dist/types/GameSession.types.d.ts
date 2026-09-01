import type { PlayerId, RoomId, TileId, Money, Timestamp } from './Common.types';
import type { Player } from './Player.types';
import type { Tile } from './Tile.types';
import type { AuctionSession } from './Auction.types';
import type { Trade } from './Trade.types';
/**
 * The state machine phase for the current turn.
 * StateMachine.ts is the sole writer of session.currentPhase.
 */
export declare enum TurnPhase {
    WAITING_FOR_ACTION = "WAITING_FOR_ACTION",
    ROLLING_DICE = "ROLLING_DICE",
    MOVING = "MOVING",
    EVENT_TRIGGER = "EVENT_TRIGGER",
    AUCTION_IN_PROGRESS = "AUCTION_IN_PROGRESS",
    JAIL_DECISION = "JAIL_DECISION",
    DYING_RESCUE = "DYING_RESCUE",
    END_TURN_PENDING = "END_TURN_PENDING",
    TURN_TRANSITIONING = "TURN_TRANSITIONING"
}
export declare enum GameStatus {
    LOBBY = "LOBBY",
    STARTING = "STARTING",
    IN_PROGRESS = "IN_PROGRESS",
    PAUSED = "PAUSED",// Current-turn player disconnected
    FINISHED = "FINISHED"
}
export declare enum BankruptcyType {
    TYPE_A = "TYPE_A",// Owes tax/system: assets liquidated and destroyed
    TYPE_B = "TYPE_B"
}
export declare enum SurpriseCardType {
    CASH_GAIN = "CASH_GAIN",// Receive fixed cash from Bank
    CASH_LOSS = "CASH_LOSS",// Pay fixed cash to Bank
    PROP_CARD = "PROP_CARD",// Draw one random PropCard
    RAMPAGE = "RAMPAGE"
}
export interface SurpriseCard {
    id: string;
    type: SurpriseCardType;
    amount: Money;
    description: string;
}
/**
 * All numeric game constants — NO hardcoded values here.
 * Populated from config/GameConfig.ts with placeholder defaults.
 */
export interface GameConfig {
    startingCash: Money;
    goSalary: Money;
    goLandBonus: Money;
    bailCost: Money;
    jailAutoReleaseAfterTurns: number;
    mortgageInterestRate: number;
    buildingRefundRate: number;
    auctionRoundMs: number;
    startingBid: Money;
    dyingRescueTotalMs: number;
    dyingRescueAfkWarningMs: number;
    dyingRescueAfkKickMs: number;
    lobbyReconnectWindowMs: number;
    reconnectWindowMs: number;
    casinoBetMultiple: Money;
    templeLitThreshold: number;
    templePrayFee: Money;
    templePassThruToll: Money;
    priceHikeMultiplier: number;
}
/** Context for the current tile event awaiting a player decision */
export interface PendingTileEvent {
    tileId: TileId;
    availableActions: string[];
    taxAmount?: number;
}
/** Context for a pending bankruptcy resolution */
export interface PendingBankruptcy {
    playerId: PlayerId;
    type: BankruptcyType;
    creditorId: PlayerId | null;
    amountOwed: Money;
}
export interface DyingRescueState {
    playerId: PlayerId;
    startedAt: Timestamp;
    lastActionAt: Timestamp;
    afkWarningSentAt: Timestamp | null;
}
export interface GameSession {
    id: RoomId;
    status: GameStatus;
    config: GameConfig;
    board: Tile[];
    players: Map<PlayerId, Player>;
    playerOrder: PlayerId[];
    currentPlayerIndex: number;
    currentPhase: TurnPhase;
    phaseEnteredAt: Timestamp;
    turnNumber: number;
    roundNumber: number;
    lastDiceRoll: {
        die1: number;
        die2: number;
        isDouble: boolean;
        total: number;
    } | null;
    pendingExtraRoll: boolean;
    remoteDiceOverride: {
        playerId: PlayerId;
        steps: 5 | 6 | 7;
    } | null;
    pendingTileEvent: PendingTileEvent | null;
    activeAuction: AuctionSession | null;
    activeTrades: Map<string, Trade>;
    surpriseDeck: SurpriseCard[];
    surpriseDiscardPile: SurpriseCard[];
    dyingRescue: DyingRescueState | null;
    pendingBankruptcy: PendingBankruptcy | null;
    hostId: PlayerId;
    createdAt: Timestamp;
    startedAt: Timestamp | null;
    finishedAt: Timestamp | null;
    winnerIds: PlayerId[];
    pausedAt: Timestamp | null;
    disconnectedCurrentPlayerId: PlayerId | null;
}
//# sourceMappingURL=GameSession.types.d.ts.map