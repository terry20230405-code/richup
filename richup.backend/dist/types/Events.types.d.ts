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
import type { TileType } from './Tile.types';
import type { PropCardType } from './PropCard.types';
import type { TurnPhase, BankruptcyType } from './GameSession.types';
import type { AuctionPublicView } from './Auction.types';
import type { TradeOffer, TradePublicView } from './Trade.types';
import type { PlayerSelfView, PlayerPublicView } from './Player.types';
export interface C2S_RollDice {
}
export interface C2S_EndTurn {
}
export interface C2S_DeclareBankruptcy {
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
    proposerOffer: TradeOffer;
    responderOffer: TradeOffer;
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
export interface S2C_MapGenerated {
    board: object[];
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
    newBuildingLevel: number;
}
export interface S2C_BuildingSold {
    tileId: TileId;
    ownerId: PlayerId;
    refund: Money;
    newBuildingLevel: number;
}
export interface S2C_RentCharged {
    from: PlayerId;
    to: PlayerOrBank;
    tileId: TileId;
    amount: Money;
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
export interface S2C_TradeProposed {
    trade: TradePublicView;
}
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
    reason: string;
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
export interface S2C_PlayerDying {
    playerId: PlayerId;
    rescueWindowMs: number;
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
}
export interface S2C_GameResumed {
    currentTurnPlayerId: PlayerId;
    currentTurnPhase: TurnPhase;
}
export interface S2C_PlayerDisconnected {
    playerId: PlayerId;
    afkWarningMs: number;
}
export interface S2C_PlayerReconnected {
    playerId: PlayerId;
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
    gameSnapshot: {
        roomId: string;
        status: string;
        currentPhase: TurnPhase;
        currentTurnPlayerId: PlayerId | null;
        turnNumber: number;
        playerOrder: PlayerId[];
        board: object[];
        players: PlayerPublicView[];
        activeAuction: AuctionPublicView | null;
        pendingTrades: TradePublicView[];
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
//# sourceMappingURL=Events.types.d.ts.map