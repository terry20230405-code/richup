/**
 * Complete Socket.io event payload definitions.
 *
 * Naming conventions:
 *   C2S_* = Client to Server (action:SCREAMING_SNAKE_CASE)
 *   S2C_* = Server to Client (SCREAMING_SNAKE_CASE)
 *
 * Information asymmetry rules (enforced by GameStateSerializer):
 *   ✗ player.cash MUST NOT appear in any broadcast (S2C) payload
 *   ✗ player.propCards and count MUST NOT appear in any broadcast payload
 *   ✓ Cash DELTAS (amounts) are allowed in broadcast payloads
 *   ✓ CASH_UPDATED is directed (private) only
 */
import type { PlayerId, TileId, Money, DiceValue, CasinoOutcome, PlayerOrBank } from './Common.types';
import type { PlayerStatus } from './Player.types';
import type { BuildingLevel, TilePublicView, TileType } from './Tile.types';
import type { PropCard, PropCardType } from './PropCard.types';
import type { TurnPhase, BankruptcyType, GameStatus } from './GameSession.types';
import type { AuctionPublicView } from './Auction.types';
import type { TradeOffer, TradePublicView, TradeVoidReason } from './Trade.types';
import type { PlayerSelfView, PlayerPublicView } from './Player.types';
export interface C2S_RollDice {
}
export interface C2S_EndTurn {
}
export interface C2S_DeclareBankruptcy {
}
export interface C2S_StartGame {
}
export interface C2S_PayTax {
}
export interface C2S_BuyProperty {
}
export interface C2S_ChooseAuction {
}
export interface C2S_SkipPurchase {
}
export interface C2S_AuctionBid {
    amount: Money;
}
export interface C2S_AuctionPass {
}
export interface C2S_BuildHouse {
    tileId: TileId;
}
export interface C2S_BuildHotel {
    tileId: TileId;
}
export interface C2S_SellBuilding {
    tileId: TileId;
}
export interface C2S_Mortgage {
    tileId: TileId;
}
export interface C2S_Unmortgage {
    tileId: TileId;
}
export interface C2S_ProposeTrade {
    responderId: PlayerId;
    proposerOffer: C2S_TradeOffer;
    responderOffer: C2S_TradeOffer;
}
export interface C2S_TradeOffer {
    cash?: Money;
    tileIds: TileId[];
    propCardIds?: string[];
}
export interface C2S_AcceptTrade {
    tradeId: string;
}
export interface C2S_RejectTrade {
    tradeId: string;
}
export interface C2S_CancelTrade {
    tradeId: string;
}
export interface C2S_PayBail {
}
export interface C2S_RollForDouble {
}
export interface C2S_UsePropCard {
    cardId: string;
    cardType: PropCardType;
    targetPlayerId?: PlayerId;
    targetTileId?: TileId;
    steps?: 5 | 6 | 7;
}
export interface C2S_TemplePray {
}
export interface C2S_CasinoBet {
    amount: Money;
}
export interface C2S_Reconnect {
    sessionToken: string;
    roomId: string;
}
/** Compile-time action contract. Every client action has exactly one payload. */
export interface ClientActionPayloads {
    'action:START_GAME': C2S_StartGame;
    'action:ROLL_DICE': C2S_RollDice;
    'action:ROLL_FOR_DOUBLE': C2S_RollForDouble;
    'action:END_TURN': C2S_EndTurn;
    'action:DECLARE_BANKRUPTCY': C2S_DeclareBankruptcy;
    'action:BUY_PROPERTY': C2S_BuyProperty;
    'action:CHOOSE_AUCTION': C2S_ChooseAuction;
    'action:SKIP_PURCHASE': C2S_SkipPurchase;
    'action:TEMPLE_PRAY': C2S_TemplePray;
    'action:CASINO_BET': C2S_CasinoBet;
    'action:PAY_BAIL': C2S_PayBail;
    'action:PAY_TAX': C2S_PayTax;
    'action:AUCTION_BID': C2S_AuctionBid;
    'action:AUCTION_PASS': C2S_AuctionPass;
    'action:BUILD_HOUSE': C2S_BuildHouse;
    'action:BUILD_HOTEL': C2S_BuildHotel;
    'action:SELL_BUILDING': C2S_SellBuilding;
    'action:MORTGAGE': C2S_Mortgage;
    'action:UNMORTGAGE': C2S_Unmortgage;
    'action:PROPOSE_TRADE': C2S_ProposeTrade;
    'action:ACCEPT_TRADE': C2S_AcceptTrade;
    'action:REJECT_TRADE': C2S_RejectTrade;
    'action:CANCEL_TRADE': C2S_CancelTrade;
    'action:USE_PROP_CARD': C2S_UsePropCard;
    'action:RECONNECT': C2S_Reconnect;
}
export interface S2C_MapGenerated {
    board: TilePublicView[];
    playerOrder: PlayerId[];
}
export interface S2C_TurnStarted {
    playerId: PlayerId;
    turnNumber: number;
    phase: TurnPhase;
    timeoutMs: number;
}
export interface S2C_TurnEnded {
    playerId: PlayerId;
}
/**
 * Broadcast when a landing auto-resolves straight to END_TURN_PENDING with no
 * player action required (empty lot, own property, just-visiting jail, surprise,
 * temple with no effect, immunity, zero rent). Lets the client show End Turn.
 */
export interface S2C_TurnReady {
    playerId: PlayerId;
    phase: TurnPhase;
    availableActions: string[];
}
export interface S2C_DiceRolled {
    playerId: PlayerId;
    die1: DiceValue;
    die2: DiceValue;
    isDouble: boolean;
    totalSteps: number;
}
export interface S2C_DiceOverride {
    playerId: PlayerId;
    steps: 5 | 6 | 7;
    source: 'REMOTE_DICE';
}
export interface S2C_PlayerMoved {
    playerId: PlayerId;
    fromPosition: TileId;
    toPosition: TileId;
    passedGo: boolean;
}
export interface S2C_StartPassed {
    playerId: PlayerId;
    bonusAmount: Money;
}
export interface S2C_StartLanded {
    playerId: PlayerId;
    passBonusAmount: Money;
    landBonusAmount: Money;
}
export interface S2C_TileEvent {
    playerId: PlayerId;
    tileId: TileId;
    tileType: TileType;
    phase: TurnPhase;
    availableActions: string[];
    taxAmount?: Money;
}
export interface S2C_PropertyPurchased {
    tileId: TileId;
    buyerId: PlayerId;
    price: Money;
}
export interface S2C_PropertyMortgaged {
    tileId: TileId;
    playerId: PlayerId;
    mortgageValue: Money;
}
export interface S2C_PropertyUnmortgaged {
    tileId: TileId;
    playerId: PlayerId;
    redemptionCost: Money;
}
export interface S2C_PropertyFreed {
    tileId: TileId;
    previousOwnerId: PlayerId;
    newOwnerId: null;
}
export interface S2C_BuildingBuilt {
    tileId: TileId;
    ownerId: PlayerId;
    cost: Money;
    newBuildingLevel: BuildingLevel;
}
export interface S2C_BuildingSold {
    tileId: TileId;
    ownerId: PlayerId;
    refund: Money;
    newBuildingLevel: BuildingLevel;
}
export interface S2C_RentCharged {
    from: PlayerId;
    to: PlayerOrBank;
    tileId: TileId;
    amount: Money;
    phase?: TurnPhase;
    availableActions?: string[];
}
export interface S2C_TaxPaid {
    playerId: PlayerId;
    amount: Money;
}
export interface S2C_CasinoResult {
    playerId: PlayerId;
    betAmount: Money;
    outcome: CasinoOutcome;
    cashDelta: Money;
    phase: TurnPhase;
    availableActions: string[];
}
export interface S2C_SurpriseResult {
    playerId: PlayerId;
    cashDelta?: Money;
    cardDescription: string;
}
export interface S2C_SurpriseRampage {
    playerId: PlayerId;
}
export interface S2C_TempleLit {
    tileId: TileId;
    isLit: true;
}
export interface S2C_AuctionStarted {
    auction: AuctionPublicView;
}
export interface S2C_AuctionBidPlaced {
    auctionId: string;
    bidderId: PlayerId;
    bidAmount: Money;
    currentLeaderId: PlayerId;
    roundDeadlineAt: number;
}
export interface S2C_AuctionPlayerPassed {
    auctionId: string;
    passedPlayerId: PlayerId;
    remainingActiveCount: number;
    activePlayerIds: PlayerId[];
    passedPlayerIds: PlayerId[];
    currentLeaderId: PlayerId | null;
    currentBid: Money;
}
export interface S2C_AuctionHammerDown {
    auctionId: string;
    winnerId: PlayerId;
    finalPrice: Money;
    tileId: TileId;
}
export interface S2C_AuctionNoSale {
    auctionId: string;
    tileId: TileId;
}
export interface S2C_AuctionBidCancelled {
    auctionId: string;
    bidderId: PlayerId;
    reason: string;
}
export type S2C_TradeProposed = TradePublicView;
export interface S2C_TradeAccepted {
    tradeId: string;
}
export interface S2C_TradeRejected {
    tradeId: string;
}
export interface S2C_TradeCancelled {
    tradeId: string;
    reason?: string;
}
export interface S2C_TradeCompleted {
    tradeId: string;
    tileTransfers: Array<{
        tileId: TileId;
        newOwnerId: PlayerId;
    }>;
    cashAmount: Money;
}
export interface S2C_TradeVoided {
    tradeId: string;
    reason: TradeVoidReason;
}
export interface S2C_PropCardUsed {
    playerId: PlayerId;
    cardType: PropCardType;
    targetPlayerId?: PlayerId;
    targetTileId?: TileId;
}
export interface S2C_PropCardDrawn {
    playerId: PlayerId;
}
/** Directed private hand snapshot. Never broadcast this payload to the room. */
export interface S2C_PropCardsUpdated {
    propCards: PropCard[];
}
export interface S2C_ImmunityUsed {
    playerId: PlayerId;
    tileId: TileId;
}
export interface S2C_PriceHikeExpired {
    playerId: PlayerId;
}
export interface S2C_ForcedTradeExecuted {
    fromPlayerId: PlayerId;
    toPlayerId: PlayerId;
    tileId: TileId;
    price: Money;
}
export interface S2C_PlunderExecuted {
    fromPlayerId: PlayerId;
    toPlayerId: PlayerId;
    amount: Money;
}
export interface S2C_JailAutoReleased {
    playerId: PlayerId;
}
export interface S2C_JailReleased {
    playerId: PlayerId;
}
export interface S2C_PlayerDying {
    playerId: PlayerId;
    rescueWindowMs: number;
    rescueDeadlineAt: number;
    phase: TurnPhase.DYING_RESCUE;
}
export interface DyingRescuePublicView {
    playerId: PlayerId;
    rescueDeadlineAt: number;
}
export interface S2C_DyingRescueDetail {
    amountOwed: Money;
    creditorId: PlayerId | null;
    bankruptcyType: BankruptcyType;
    rescueDeadlineAt: number;
    availableActions: string[];
}
export interface S2C_PlayerRescued {
    playerId: PlayerId;
}
export interface S2C_DyingRescueAfkWarning {
    playerId: PlayerId;
    remainingSeconds: number;
}
export interface S2C_PlayerBankrupt {
    playerId: PlayerId;
    bankruptType: BankruptcyType;
    creditorId: PlayerId | null;
}
export interface S2C_WhaleFall {
    playerId: PlayerId;
    reason: 'DISCONNECT_TIMEOUT' | 'AFK_IN_RESCUE';
}
export interface S2C_GamePaused {
    disconnectedPlayerId: PlayerId;
    reconnectWindowSeconds: number;
    reconnectDeadlineAt: number;
}
export interface S2C_GameResumed {
    currentTurnPlayerId: PlayerId;
    currentTurnPhase: TurnPhase;
}
export interface S2C_PlayerDisconnected {
    playerId: PlayerId;
    afkWarningMs: number;
    status: PlayerStatus;
}
export interface S2C_PlayerReconnected {
    playerId: PlayerId;
    status: PlayerStatus;
}
export interface S2C_LobbyStateUpdated {
    hostId: PlayerId;
    players: PlayerPublicView[];
}
export interface S2C_GameOver {
    winnerIds: PlayerId[];
    standings: Array<{
        playerId: PlayerId;
        rank: number;
    }>;
}
export interface S2C_CashUpdated {
    newBalance: Money;
    delta: Money;
    reason: string;
}
export interface S2C_ReconnectSuccess {
    selfView: PlayerSelfView;
    rescueDetail: S2C_DyingRescueDetail | null;
    tradeDetails: S2C_TradeDetail[];
    gameSnapshot: {
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
    };
}
export interface S2C_AuctionBidRejected {
    reason: 'INSUFFICIENT_FUNDS' | 'BID_NOT_HIGHER' | 'AUCTION_CLOSED';
    currentBid?: Money;
}
export interface S2C_ActionRejected {
    action: string;
    reason: string;
    code: 'WRONG_PHASE' | 'NOT_YOUR_TURN' | 'INVALID_INPUT' | 'INSUFFICIENT_FUNDS' | 'BID_LOCKED' | 'RULE_VIOLATION';
}
export interface S2C_OperationBlocked {
    reason: 'BID_LOCKED';
    lockedAmount: Money;
}
/** Full trade details with cash — sent directed to both parties only */
export interface S2C_TradeDetail {
    tradeId: string;
    proposerOffer: TradeOffer;
    responderOffer: TradeOffer;
}
/** Audit card result — sent only to the card user */
export interface S2C_AuditResult {
    requestedByPlayerId: PlayerId;
    playerCashMap: Record<PlayerId, Money>;
}
/**
 * Compile-time server event contract used by every broadcast/direct emitter.
 * Runtime payload validation remains mandatory for untrusted client input.
 */
export interface ServerEventPayloads {
    MAP_GENERATED: S2C_MapGenerated;
    TURN_STARTED: S2C_TurnStarted;
    TURN_ENDED: S2C_TurnEnded;
    TURN_READY: S2C_TurnReady;
    DICE_ROLLED: S2C_DiceRolled;
    DICE_OVERRIDE: S2C_DiceOverride;
    PLAYER_MOVED: S2C_PlayerMoved;
    START_PASSED: S2C_StartPassed;
    START_LANDED: S2C_StartLanded;
    TILE_EVENT: S2C_TileEvent;
    PROPERTY_PURCHASED: S2C_PropertyPurchased;
    PROPERTY_MORTGAGED: S2C_PropertyMortgaged;
    PROPERTY_UNMORTGAGED: S2C_PropertyUnmortgaged;
    PROPERTY_FREED: S2C_PropertyFreed;
    BUILDING_BUILT: S2C_BuildingBuilt;
    BUILDING_SOLD: S2C_BuildingSold;
    RENT_CHARGED: S2C_RentCharged;
    TAX_PAID: S2C_TaxPaid;
    CASINO_RESULT: S2C_CasinoResult;
    SURPRISE_RESULT: S2C_SurpriseResult;
    SURPRISE_RAMPAGE: S2C_SurpriseRampage;
    TEMPLE_LIT: S2C_TempleLit;
    AUCTION_STARTED: S2C_AuctionStarted;
    AUCTION_BID_PLACED: S2C_AuctionBidPlaced;
    AUCTION_PLAYER_PASSED: S2C_AuctionPlayerPassed;
    AUCTION_HAMMER_DOWN: S2C_AuctionHammerDown;
    AUCTION_NO_SALE: S2C_AuctionNoSale;
    AUCTION_BID_CANCELLED: S2C_AuctionBidCancelled;
    TRADE_PROPOSED: S2C_TradeProposed;
    TRADE_ACCEPTED: S2C_TradeAccepted;
    TRADE_REJECTED: S2C_TradeRejected;
    TRADE_CANCELLED: S2C_TradeCancelled;
    TRADE_COMPLETED: S2C_TradeCompleted;
    TRADE_VOIDED: S2C_TradeVoided;
    PROP_CARD_USED: S2C_PropCardUsed;
    PROP_CARD_DRAWN: S2C_PropCardDrawn;
    PROP_CARDS_UPDATED: S2C_PropCardsUpdated;
    IMMUNITY_USED: S2C_ImmunityUsed;
    PRICE_HIKE_EXPIRED: S2C_PriceHikeExpired;
    FORCED_TRADE_EXECUTED: S2C_ForcedTradeExecuted;
    PLUNDER_EXECUTED: S2C_PlunderExecuted;
    JAIL_AUTO_RELEASED: S2C_JailAutoReleased;
    JAIL_RELEASED: S2C_JailReleased;
    PLAYER_DYING: S2C_PlayerDying;
    DYING_RESCUE_DETAIL: S2C_DyingRescueDetail;
    PLAYER_RESCUED: S2C_PlayerRescued;
    DYING_RESCUE_AFK_WARNING: S2C_DyingRescueAfkWarning;
    PLAYER_BANKRUPT: S2C_PlayerBankrupt;
    WHALE_FALL: S2C_WhaleFall;
    GAME_PAUSED: S2C_GamePaused;
    GAME_RESUMED: S2C_GameResumed;
    PLAYER_DISCONNECTED: S2C_PlayerDisconnected;
    PLAYER_RECONNECTED: S2C_PlayerReconnected;
    LOBBY_STATE_UPDATED: S2C_LobbyStateUpdated;
    GAME_OVER: S2C_GameOver;
    CASH_UPDATED: S2C_CashUpdated;
    RECONNECT_SUCCESS: S2C_ReconnectSuccess;
    AUCTION_BID_REJECTED: S2C_AuctionBidRejected;
    ACTION_REJECTED: S2C_ActionRejected;
    OPERATION_BLOCKED: S2C_OperationBlocked;
    TRADE_DETAIL: S2C_TradeDetail;
    AUDIT_RESULT: S2C_AuditResult;
}
//# sourceMappingURL=Events.types.d.ts.map