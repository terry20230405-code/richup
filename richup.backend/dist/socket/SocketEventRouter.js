"use strict";
/**
 * Socket.io event router — central dispatch point for all client actions.
 *
 * Pattern for every handler:
 *   1. Resolve session + playerId from socket context
 *   2. Guard: phase check, turn check, Zod validation
 *   3. Execute module function
 *   4. Handle errors → emit ACTION_REJECTED
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketEvents = registerSocketEvents;
const zod_1 = require("zod");
const GameSession_types_1 = require("../types/GameSession.types");
const GameSession_types_2 = require("../types/GameSession.types");
const Player_types_1 = require("../types/Player.types");
const PropCard_types_1 = require("../types/PropCard.types");
const RoomManager_1 = require("../state/RoomManager");
const GameSession_1 = require("../state/GameSession");
const StateMachine_1 = require("../state/StateMachine");
const GameStateSerializer_1 = require("../serialization/GameStateSerializer");
const DiceEngine_1 = require("../modules/DiceEngine");
const MovementEngine_1 = require("../modules/MovementEngine");
const RentCalculator_1 = require("../modules/RentCalculator");
const SurpriseHandler_1 = require("../modules/SurpriseHandler");
const JailManager_1 = require("../modules/JailManager");
const AuctionManager_1 = require("../modules/AuctionManager");
const BuildingManager_1 = require("../modules/BuildingManager");
const BankruptcyResolver_1 = require("../modules/BankruptcyResolver");
const ConnectionLifecycle_1 = require("../modules/ConnectionLifecycle");
const TradeManager_1 = require("../modules/TradeManager");
const PropCardHandler_1 = require("../modules/PropCardHandler");
const TempleManager_1 = require("../modules/TempleManager");
const CasinoManager_1 = require("../modules/CasinoManager");
const TurnFlow_1 = require("../modules/TurnFlow");
const broadcast_1 = require("./emitters/broadcast");
const direct_1 = require("./emitters/direct");
const phaseGuard_1 = require("./guards/phaseGuard");
const playerTurnGuard_1 = require("./guards/playerTurnGuard");
const inputValidator_1 = require("./guards/inputValidator");
const timerUtils_1 = require("../utils/timerUtils");
const Trade_types_1 = require("../types/Trade.types");
const Tile_types_1 = require("../types/Tile.types");
const GameSession_2 = require("../state/GameSession");
const Common_types_1 = require("../types/Common.types");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
// ─── Zod schemas ──────────────────────────────────────────────────────────────
const AuctionBidSchema = zod_1.z.object({ amount: zod_1.z.number().int().positive() });
const BuildSchema = zod_1.z.object({ tileId: zod_1.z.number().int().min(0) });
const TradeOfferSchema = zod_1.z.object({
    cash: zod_1.z.number().int().min(0).optional(),
    tileIds: zod_1.z.array(zod_1.z.number().int().min(0)),
    propCardIds: zod_1.z.array(zod_1.z.string()).optional(),
});
const ProposeTradeSchema = zod_1.z.object({
    responderId: zod_1.z.string(),
    proposerOffer: TradeOfferSchema,
    responderOffer: TradeOfferSchema,
});
const TradeIdSchema = zod_1.z.object({ tradeId: zod_1.z.string() });
const UsePropCardSchema = zod_1.z.object({
    cardId: zod_1.z.string(),
    cardType: zod_1.z.nativeEnum(PropCard_types_1.PropCardType),
    targetPlayerId: zod_1.z.string().optional(),
    targetTileId: zod_1.z.number().int().min(0).optional(),
    steps: zod_1.z.union([zod_1.z.literal(5), zod_1.z.literal(6), zod_1.z.literal(7)]).optional(),
});
const CasinoBetSchema = zod_1.z.object({ amount: zod_1.z.number().int().positive() });
const ReconnectSchema = zod_1.z.object({ sessionToken: zod_1.z.string(), roomId: zod_1.z.string() });
// ─── Error utility ────────────────────────────────────────────────────────────
function rejectAction(socket, action, err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const code = err instanceof errors_1.DomainError ? domainErrorCode(err) : 'RULE_VIOLATION';
    const payload = { action, reason: msg, code };
    (0, direct_1.emitToSocket)(socket, 'ACTION_REJECTED', payload);
    logger_1.logger.debug({ action, reason: msg }, 'Action rejected');
}
function domainErrorCode(err) {
    const name = err.constructor.name;
    if (name === 'PhaseViolationError')
        return 'WRONG_PHASE';
    if (name === 'NotYourTurnError')
        return 'NOT_YOUR_TURN';
    if (name === 'InsufficientFundsError')
        return 'INSUFFICIENT_FUNDS';
    if (name === 'BidLockedError')
        return 'BID_LOCKED';
    return 'RULE_VIOLATION';
}
// ─── Context helpers ──────────────────────────────────────────────────────────
function getContext(socket) {
    const ctx = (0, RoomManager_1.getSocketContext)(socket.id);
    if (!ctx)
        return null;
    const session = (0, RoomManager_1.getSession)(ctx.roomId);
    if (!session)
        return null;
    return { ...ctx, session };
}
// ─── Router registration ──────────────────────────────────────────────────────
function registerSocketEvents(io, socket) {
    // ── action:START_GAME ─────────────────────────────────────────────────────
    socket.on('action:START_GAME', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (session.hostId !== playerId) {
            (0, direct_1.emitToSocket)(socket, 'ACTION_REJECTED', { action: 'START_GAME', reason: 'Only the host can start', code: 'RULE_VIOLATION' });
            return;
        }
        if (session.status !== GameSession_types_1.GameStatus.LOBBY) {
            (0, direct_1.emitToSocket)(socket, 'ACTION_REJECTED', { action: 'START_GAME', reason: 'Already started', code: 'WRONG_PHASE' });
            return;
        }
        try {
            (0, GameSession_1.startGame)(session);
            const board = (0, GameStateSerializer_1.serializeBoard)(session);
            const mapPayload = { board, playerOrder: session.playerOrder };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'MAP_GENERATED', mapPayload);
            // Existing sockets (especially the host) may have joined before the
            // final player roster was complete. Refresh each private snapshot before
            // the first turn so every client has the same player identities/state.
            for (const player of session.players.values()) {
                if (!player.isConnected)
                    continue;
                (0, direct_1.emitToPlayer)(io, player.id, 'RECONNECT_SUCCESS', (0, GameStateSerializer_1.buildReconnectSnapshot)(session, player.id));
            }
            (0, TurnFlow_1.emitTurnStarted)(io, session);
        }
        catch (err) {
            rejectAction(socket, 'START_GAME', err);
        }
    });
    // ── action:ROLL_DICE ──────────────────────────────────────────────────────
    socket.on('action:ROLL_DICE', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        const player = session.players.get(playerId);
        if (!player)
            return;
        const allowedPhases = player.inJail
            ? [GameSession_types_1.TurnPhase.JAIL_DECISION]
            : [GameSession_types_1.TurnPhase.WAITING_FOR_ACTION];
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, allowedPhases, 'ROLL_DICE'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'ROLL_DICE'))
            return;
        try {
            if (player.inJail) {
                StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.ROLLING_DICE);
                const result = (0, DiceEngine_1.rollForJailDouble)(session, playerId, io);
                const released = (0, JailManager_1.resolveJailRoll)(session, playerId, result.isDouble, io);
                if (released) {
                    StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.MOVING);
                    const moveResult = (0, MovementEngine_1.movePlayer)(session, playerId, result.total, io);
                    handleLanding(session, playerId, moveResult.newPosition, io);
                }
                else {
                    (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
                }
            }
            else {
                StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.ROLLING_DICE);
                const result = (0, DiceEngine_1.performRoll)(session, playerId, io);
                session.pendingExtraRoll = result.isDouble;
                if (result.jailTriggered) {
                    session.pendingExtraRoll = false;
                    (0, JailManager_1.sendToJail)(session, playerId, io);
                    (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
                }
                else {
                    StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.MOVING);
                    const moveResult = (0, MovementEngine_1.movePlayer)(session, playerId, result.total, io);
                    handleLanding(session, playerId, moveResult.newPosition, io);
                }
            }
        }
        catch (err) {
            rejectAction(socket, 'ROLL_DICE', err);
        }
    });
    // ── action:END_TURN ───────────────────────────────────────────────────────
    socket.on('action:END_TURN', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.END_TURN_PENDING], 'END_TURN'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'END_TURN'))
            return;
        try {
            const endPayload = { playerId };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'TURN_ENDED', endPayload);
            (0, DiceEngine_1.resetDoublesTracker)(session.id, playerId);
            (0, TurnFlow_1.advanceToNextTurn)(session, io);
        }
        catch (err) {
            rejectAction(socket, 'END_TURN', err);
        }
    });
    // ── action:BUY_PROPERTY ───────────────────────────────────────────────────
    socket.on('action:BUY_PROPERTY', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.EVENT_TRIGGER], 'BUY_PROPERTY'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'BUY_PROPERTY'))
            return;
        try {
            if (!session.pendingTileEvent?.availableActions.includes('BUY_PROPERTY')) {
                throw new Error('No pending property purchase');
            }
            const tile = (0, MovementEngine_1.getPlayerTile)(session, playerId);
            if (!('basePrice' in tile) || !('ownerId' in tile)) {
                throw new Error('Current tile is not purchasable');
            }
            const purchasable = tile;
            if (purchasable.ownerId !== null)
                throw new Error('Tile is already owned');
            const player = (0, GameSession_1.requirePlayer)(session, playerId);
            const price = purchasable.basePrice;
            if (player.cash < price)
                throw new Error('Insufficient funds');
            purchasable.ownerId = playerId;
            (0, GameSession_2.cashChange)(session, playerId, -price, 'PROPERTY_PURCHASE', io);
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'PROPERTY_PURCHASED', {
                tileId: tile.id,
                buyerId: playerId,
                price,
            });
            (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
        }
        catch (err) {
            rejectAction(socket, 'BUY_PROPERTY', err);
        }
    });
    // ── action:CHOOSE_AUCTION ─────────────────────────────────────────────────
    socket.on('action:CHOOSE_AUCTION', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.EVENT_TRIGGER], 'CHOOSE_AUCTION'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'CHOOSE_AUCTION'))
            return;
        try {
            if (!session.pendingTileEvent?.availableActions.includes('CHOOSE_AUCTION')) {
                throw new Error('No pending auction choice');
            }
            const tile = (0, MovementEngine_1.getPlayerTile)(session, playerId);
            (0, AuctionManager_1.startAuction)(session, tile.id, io);
        }
        catch (err) {
            rejectAction(socket, 'CHOOSE_AUCTION', err);
        }
    });
    // ── action:SKIP_PURCHASE ──────────────────────────────────────────────────
    socket.on('action:SKIP_PURCHASE', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.EVENT_TRIGGER], 'SKIP_PURCHASE'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'SKIP_PURCHASE'))
            return;
        try {
            if (!session.pendingTileEvent?.availableActions.includes('SKIP_PURCHASE')) {
                throw new Error('This tile cannot be skipped');
            }
            (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
        }
        catch (err) {
            rejectAction(socket, 'SKIP_PURCHASE', err);
        }
    });
    // ── action:AUCTION_BID ────────────────────────────────────────────────────
    socket.on('action:AUCTION_BID', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.AUCTION_IN_PROGRESS], 'AUCTION_BID'))
            return;
        const validated = (0, inputValidator_1.validateInput)(socket, AuctionBidSchema, data, 'AUCTION_BID');
        if (!validated)
            return;
        try {
            (0, AuctionManager_1.placeBid)(session, playerId, validated.amount, io);
        }
        catch (err) {
            rejectAction(socket, 'AUCTION_BID', err);
        }
    });
    // ── action:AUCTION_PASS ───────────────────────────────────────────────────
    socket.on('action:AUCTION_PASS', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.AUCTION_IN_PROGRESS], 'AUCTION_PASS'))
            return;
        try {
            (0, AuctionManager_1.passAuction)(session, playerId, io);
        }
        catch (err) {
            rejectAction(socket, 'AUCTION_PASS', err);
        }
    });
    // ── action:BUILD_HOUSE ────────────────────────────────────────────────────
    socket.on('action:BUILD_HOUSE', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.WAITING_FOR_ACTION, GameSession_types_1.TurnPhase.END_TURN_PENDING], 'BUILD_HOUSE'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'BUILD_HOUSE'))
            return;
        const validated = (0, inputValidator_1.validateInput)(socket, BuildSchema, data, 'BUILD_HOUSE');
        if (!validated)
            return;
        try {
            (0, BuildingManager_1.buildHouse)(session, playerId, validated.tileId, io);
        }
        catch (err) {
            rejectAction(socket, 'BUILD_HOUSE', err);
        }
    });
    // ── action:BUILD_HOTEL ────────────────────────────────────────────────────
    socket.on('action:BUILD_HOTEL', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.WAITING_FOR_ACTION, GameSession_types_1.TurnPhase.END_TURN_PENDING], 'BUILD_HOTEL'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'BUILD_HOTEL'))
            return;
        const validated = (0, inputValidator_1.validateInput)(socket, BuildSchema, data, 'BUILD_HOTEL');
        if (!validated)
            return;
        try {
            (0, BuildingManager_1.buildHotel)(session, playerId, validated.tileId, io);
        }
        catch (err) {
            rejectAction(socket, 'BUILD_HOTEL', err);
        }
    });
    // ── action:SELL_BUILDING ──────────────────────────────────────────────────
    socket.on('action:SELL_BUILDING', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.WAITING_FOR_ACTION, GameSession_types_1.TurnPhase.DYING_RESCUE, GameSession_types_1.TurnPhase.END_TURN_PENDING], 'SELL_BUILDING'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'SELL_BUILDING'))
            return;
        const validated = (0, inputValidator_1.validateInput)(socket, BuildSchema, data, 'SELL_BUILDING');
        if (!validated)
            return;
        try {
            if (session.currentPhase === GameSession_types_1.TurnPhase.DYING_RESCUE) {
                (0, BankruptcyResolver_1.refreshDyingRescueActivity)(session, playerId);
            }
            (0, BuildingManager_1.sellBuilding)(session, playerId, validated.tileId, io);
            if (session.currentPhase === GameSession_types_1.TurnPhase.DYING_RESCUE && (0, BankruptcyResolver_1.rescueDyingPlayer)(session, playerId, io)) {
                (0, TurnFlow_1.advanceToNextTurn)(session, io);
            }
        }
        catch (err) {
            rejectAction(socket, 'SELL_BUILDING', err);
        }
    });
    // ── action:MORTGAGE ───────────────────────────────────────────────────────
    socket.on('action:MORTGAGE', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.WAITING_FOR_ACTION, GameSession_types_1.TurnPhase.DYING_RESCUE, GameSession_types_1.TurnPhase.END_TURN_PENDING], 'MORTGAGE'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'MORTGAGE'))
            return;
        const validated = (0, inputValidator_1.validateInput)(socket, BuildSchema, data, 'MORTGAGE');
        if (!validated)
            return;
        try {
            if (session.currentPhase === GameSession_types_1.TurnPhase.DYING_RESCUE) {
                (0, BankruptcyResolver_1.refreshDyingRescueActivity)(session, playerId);
            }
            (0, BuildingManager_1.mortgageProperty)(session, playerId, validated.tileId, io);
            if (session.currentPhase === GameSession_types_1.TurnPhase.DYING_RESCUE && (0, BankruptcyResolver_1.rescueDyingPlayer)(session, playerId, io)) {
                (0, TurnFlow_1.advanceToNextTurn)(session, io);
            }
        }
        catch (err) {
            rejectAction(socket, 'MORTGAGE', err);
        }
    });
    // ── action:UNMORTGAGE ─────────────────────────────────────────────────────
    socket.on('action:UNMORTGAGE', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.WAITING_FOR_ACTION, GameSession_types_1.TurnPhase.END_TURN_PENDING], 'UNMORTGAGE'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'UNMORTGAGE'))
            return;
        const validated = (0, inputValidator_1.validateInput)(socket, BuildSchema, data, 'UNMORTGAGE');
        if (!validated)
            return;
        try {
            (0, BuildingManager_1.unmortgageProperty)(session, playerId, validated.tileId, io);
        }
        catch (err) {
            rejectAction(socket, 'UNMORTGAGE', err);
        }
    });
    // ── action:PROPOSE_TRADE ──────────────────────────────────────────────────
    socket.on('action:PROPOSE_TRADE', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        const validated = (0, inputValidator_1.validateInput)(socket, ProposeTradeSchema, data, 'PROPOSE_TRADE');
        if (!validated)
            return;
        try {
            (0, TradeManager_1.proposeTrade)(session, playerId, validated.responderId, { cash: validated.proposerOffer.cash ?? 0, tileIds: validated.proposerOffer.tileIds, propCardIds: validated.proposerOffer.propCardIds ?? [] }, { cash: validated.responderOffer.cash ?? 0, tileIds: validated.responderOffer.tileIds, propCardIds: validated.responderOffer.propCardIds ?? [] }, io);
        }
        catch (err) {
            rejectAction(socket, 'PROPOSE_TRADE', err);
        }
    });
    // ── action:ACCEPT_TRADE ───────────────────────────────────────────────────
    socket.on('action:ACCEPT_TRADE', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        const validated = (0, inputValidator_1.validateInput)(socket, TradeIdSchema, data, 'ACCEPT_TRADE');
        if (!validated)
            return;
        try {
            (0, TradeManager_1.acceptTrade)(session, validated.tradeId, playerId, io);
        }
        catch (err) {
            rejectAction(socket, 'ACCEPT_TRADE', err);
        }
    });
    // ── action:REJECT_TRADE ───────────────────────────────────────────────────
    socket.on('action:REJECT_TRADE', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        const validated = (0, inputValidator_1.validateInput)(socket, TradeIdSchema, data, 'REJECT_TRADE');
        if (!validated)
            return;
        try {
            (0, TradeManager_1.rejectTrade)(session, validated.tradeId, playerId, io);
        }
        catch (err) {
            rejectAction(socket, 'REJECT_TRADE', err);
        }
    });
    // ── action:CANCEL_TRADE ───────────────────────────────────────────────────
    socket.on('action:CANCEL_TRADE', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        const validated = (0, inputValidator_1.validateInput)(socket, TradeIdSchema, data, 'CANCEL_TRADE');
        if (!validated)
            return;
        try {
            (0, TradeManager_1.cancelTrade)(session, validated.tradeId, playerId, io);
        }
        catch (err) {
            rejectAction(socket, 'CANCEL_TRADE', err);
        }
    });
    // ── action:PAY_BAIL ───────────────────────────────────────────────────────
    socket.on('action:PAY_BAIL', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.JAIL_DECISION], 'PAY_BAIL'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'PAY_BAIL'))
            return;
        try {
            (0, JailManager_1.payBail)(session, playerId, io);
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'TURN_READY', {
                playerId,
                phase: GameSession_types_1.TurnPhase.WAITING_FOR_ACTION,
                availableActions: ['ROLL_DICE'],
            });
        }
        catch (err) {
            rejectAction(socket, 'PAY_BAIL', err);
        }
    });
    // ── action:PAY_TAX ────────────────────────────────────────────────────────
    socket.on('action:PAY_TAX', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.EVENT_TRIGGER], 'PAY_TAX'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'PAY_TAX'))
            return;
        const taxAmount = session.pendingTileEvent?.taxAmount;
        if (!taxAmount) {
            (0, direct_1.emitToSocket)(socket, 'ACTION_REJECTED', { action: 'PAY_TAX', reason: 'No pending tax amount', code: 'RULE_VIOLATION' });
            return;
        }
        const player = (0, GameSession_1.requirePlayer)(session, playerId);
        session.pendingTileEvent = null;
        if (player.cash >= taxAmount) {
            (0, GameSession_2.cashChange)(session, playerId, -taxAmount, 'TAX', io);
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'TAX_PAID', { playerId, amount: taxAmount });
            (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
        }
        else {
            (0, BankruptcyResolver_1.enterDyingRescue)(session, playerId, GameSession_types_2.BankruptcyType.TYPE_A, null, taxAmount, io);
            (0, TradeManager_1.voidTradesInvolvingPlayer)(session, playerId, Trade_types_1.TradeVoidReason.PLAYER_DYING, io);
        }
    });
    // ── action:ROLL_FOR_DOUBLE (in jail) ──────────────────────────────────────
    socket.on('action:ROLL_FOR_DOUBLE', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.JAIL_DECISION], 'ROLL_FOR_DOUBLE'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'ROLL_FOR_DOUBLE'))
            return;
        // Handled by ROLL_DICE when inJail — kept here for explicit event support
        try {
            StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.ROLLING_DICE);
            const result = (0, DiceEngine_1.rollForJailDouble)(session, playerId, io);
            const released = (0, JailManager_1.resolveJailRoll)(session, playerId, result.isDouble, io);
            if (released) {
                StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.MOVING);
                const moveResult = (0, MovementEngine_1.movePlayer)(session, playerId, result.total, io);
                handleLanding(session, playerId, moveResult.newPosition, io);
            }
            else {
                (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
            }
        }
        catch (err) {
            rejectAction(socket, 'ROLL_FOR_DOUBLE', err);
        }
    });
    // ── action:USE_PROP_CARD ──────────────────────────────────────────────────
    socket.on('action:USE_PROP_CARD', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.WAITING_FOR_ACTION, GameSession_types_1.TurnPhase.END_TURN_PENDING], 'USE_PROP_CARD'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'USE_PROP_CARD'))
            return;
        const validated = (0, inputValidator_1.validateInput)(socket, UsePropCardSchema, data, 'USE_PROP_CARD');
        if (!validated)
            return;
        if (validated.cardType === PropCard_types_1.PropCardType.REMOTE_DICE && session.currentPhase !== GameSession_types_1.TurnPhase.WAITING_FOR_ACTION) {
            (0, direct_1.emitToSocket)(socket, 'ACTION_REJECTED', {
                action: 'USE_PROP_CARD',
                reason: 'REMOTE_DICE must be used before the next roll',
                code: 'WRONG_PHASE',
            });
            return;
        }
        try {
            (0, PropCardHandler_1.usePropCard)(session, playerId, validated.cardId, validated.cardType, {
                targetPlayerId: validated.targetPlayerId,
                targetTileId: validated.targetTileId,
                steps: validated.steps,
            }, io);
        }
        catch (err) {
            rejectAction(socket, 'USE_PROP_CARD', err);
        }
    });
    // ── action:TEMPLE_PRAY ────────────────────────────────────────────────────
    socket.on('action:TEMPLE_PRAY', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.EVENT_TRIGGER], 'TEMPLE_PRAY'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'TEMPLE_PRAY'))
            return;
        try {
            if (!session.pendingTileEvent?.availableActions.includes('TEMPLE_PRAY')) {
                throw new Error('No pending temple prayer');
            }
            const tile = (0, MovementEngine_1.getPlayerTile)(session, playerId);
            (0, TempleManager_1.ownerPrays)(session, playerId, tile.id, io);
            (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
        }
        catch (err) {
            rejectAction(socket, 'TEMPLE_PRAY', err);
        }
    });
    // ── action:CASINO_BET ─────────────────────────────────────────────────────
    socket.on('action:CASINO_BET', (data) => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.EVENT_TRIGGER], 'CASINO_BET'))
            return;
        if (!(0, playerTurnGuard_1.playerTurnGuard)(socket, session, playerId, 'CASINO_BET'))
            return;
        const validated = (0, inputValidator_1.validateInput)(socket, CasinoBetSchema, data, 'CASINO_BET');
        if (!validated)
            return;
        try {
            const tileId = session.pendingTileEvent?.tileId;
            if (tileId === undefined)
                throw new Error('No pending casino event');
            (0, CasinoManager_1.handleCasinoBet)(session, playerId, tileId, validated.amount, io);
            session.pendingTileEvent = null;
            (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
        }
        catch (err) {
            rejectAction(socket, 'CASINO_BET', err);
        }
    });
    // ── action:DECLARE_BANKRUPTCY ─────────────────────────────────────────────
    socket.on('action:DECLARE_BANKRUPTCY', () => {
        const ctx = getContext(socket);
        if (!ctx)
            return;
        const { session, playerId } = ctx;
        if (!(0, phaseGuard_1.phaseGuard)(socket, session, [GameSession_types_1.TurnPhase.DYING_RESCUE], 'DECLARE_BANKRUPTCY'))
            return;
        if (session.dyingRescue?.playerId !== playerId) {
            (0, direct_1.emitToSocket)(socket, 'ACTION_REJECTED', { action: 'DECLARE_BANKRUPTCY', reason: 'You are not in dying rescue', code: 'RULE_VIOLATION' });
            return;
        }
        try {
            (0, BankruptcyResolver_1.declareBankruptcy)(session, playerId, io);
        }
        catch (err) {
            rejectAction(socket, 'DECLARE_BANKRUPTCY', err);
        }
    });
    // ── action:RECONNECT ──────────────────────────────────────────────────────
    socket.on('action:RECONNECT', async (data) => {
        const validated = (0, inputValidator_1.validateInput)(socket, ReconnectSchema, data, 'RECONNECT');
        if (!validated)
            return;
        try {
            const payload = (0, RoomManager_1.verifyToken)(validated.sessionToken);
            const session = (0, RoomManager_1.getSession)(payload.roomId);
            if (!session) {
                (0, direct_1.emitToSocket)(socket, 'ACTION_REJECTED', { action: 'RECONNECT', reason: 'Room not found', code: 'RULE_VIOLATION' });
                return;
            }
            const player = session.players.get(payload.playerId);
            if (!player) {
                (0, direct_1.emitToSocket)(socket, 'ACTION_REJECTED', { action: 'RECONNECT', reason: 'Player not found', code: 'RULE_VIOLATION' });
                return;
            }
            // A socket may authenticate again with another token. Remove its old room
            // subscriptions before replacing the registry entry.
            const previousContext = (0, RoomManager_1.getSocketContext)(socket.id);
            if (previousContext && (previousContext.roomId !== payload.roomId ||
                previousContext.playerId !== payload.playerId)) {
                await socket.leave(previousContext.roomId);
                await socket.leave((0, direct_1.playerRoom)(previousContext.playerId));
            }
            // Register new socket
            (0, RoomManager_1.registerSocket)(socket.id, payload.playerId, payload.roomId);
            socket.join(payload.roomId);
            socket.join((0, direct_1.playerRoom)(payload.playerId));
            // Cancel only connection timers. Rescue/auction timers use independent
            // namespaces and must not be affected by a network reconnection.
            (0, timerUtils_1.cancelTimer)(timerUtils_1.TimerNS.lobbyReconnect(session.id, payload.playerId));
            (0, timerUtils_1.cancelTimer)(timerUtils_1.TimerNS.reconnect(session.id, payload.playerId));
            // Update player state
            player.isConnected = true;
            player.status = player.status === Player_types_1.PlayerStatus.DISCONNECTED ? Player_types_1.PlayerStatus.ACTIVE : player.status;
            player.lastSeenAt = Date.now();
            // Was this the disconnected current-turn player?
            const wasCurrentPlayer = session.disconnectedCurrentPlayerId === payload.playerId;
            if (wasCurrentPlayer) {
                session.disconnectedCurrentPlayerId = null;
                session.pausedAt = null;
                session.status = GameSession_types_1.GameStatus.IN_PROGRESS;
                const resumePayload = {
                    currentTurnPlayerId: (0, GameSession_1.getCurrentPlayerId)(session),
                    currentTurnPhase: session.currentPhase,
                };
                (0, broadcast_1.broadcastToRoom)(io, session.id, 'GAME_RESUMED', resumePayload);
            }
            const reconnectedPayload = {
                playerId: payload.playerId,
                status: player.status,
            };
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLAYER_RECONNECTED', reconnectedPayload);
            if (session.status === GameSession_types_1.GameStatus.LOBBY) {
                (0, ConnectionLifecycle_1.broadcastLobbyState)(session, io);
            }
            const snapshot = (0, GameStateSerializer_1.buildReconnectSnapshot)(session, payload.playerId);
            const successPayload = snapshot;
            (0, direct_1.emitToSocket)(socket, 'RECONNECT_SUCCESS', successPayload);
            logger_1.logger.info({ roomId: payload.roomId, playerId: payload.playerId }, 'Player reconnected');
        }
        catch (err) {
            rejectAction(socket, 'RECONNECT', err);
        }
    });
    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
        const entry = (0, RoomManager_1.unregisterSocket)(socket.id);
        if (!entry)
            return;
        const { playerId, roomId } = entry;
        if ((0, RoomManager_1.hasConnectedSocket)(roomId, playerId))
            return;
        const session = (0, RoomManager_1.getSession)(roomId);
        if (!session)
            return;
        (0, ConnectionLifecycle_1.handleLastSocketDisconnect)(session, playerId, io);
    });
}
// ─── Landing handler ──────────────────────────────────────────────────────────
function handleLanding(session, playerId, position, io) {
    const tile = session.board[position];
    if (!(0, MovementEngine_1.needsTileEvent)(tile)) {
        (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
        return;
    }
    switch (tile.type) {
        case Tile_types_1.TileType.PROPERTY:
        case Tile_types_1.TileType.AIRPORT: {
            if (!('ownerId' in tile) || !tile.ownerId) {
                // Unowned — offer purchase
                session.pendingTileEvent = {
                    tileId: tile.id,
                    availableActions: ['BUY_PROPERTY', 'CHOOSE_AUCTION', 'SKIP_PURCHASE'],
                };
                StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.EVENT_TRIGGER);
                (0, broadcast_1.broadcastToRoom)(io, session.id, 'TILE_EVENT', {
                    playerId,
                    tileId: tile.id,
                    tileType: tile.type,
                    phase: GameSession_types_1.TurnPhase.EVENT_TRIGGER,
                    availableActions: ['BUY_PROPERTY', 'CHOOSE_AUCTION', 'SKIP_PURCHASE'],
                });
            }
            else if (tile.ownerId === playerId) {
                // Own property — no event
                (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
            }
            else {
                // Pay rent
                const rentResult = (0, RentCalculator_1.computeRent)(session, tile.id, playerId);
                if (rentResult.amount > 0) {
                    const player = (0, GameSession_1.requirePlayer)(session, playerId);
                    // Check immunity
                    if (player.hasImmunity) {
                        player.hasImmunity = false;
                        (0, broadcast_1.broadcastToRoom)(io, session.id, 'IMMUNITY_USED', { playerId, tileId: tile.id });
                        (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
                        return;
                    }
                    if (player.cash >= rentResult.amount) {
                        (0, GameSession_2.cashChange)(session, playerId, -rentResult.amount, 'RENT_PAID', io);
                        if (rentResult.recipient !== Common_types_1.BANK_ID) {
                            (0, GameSession_2.cashChange)(session, rentResult.recipient, rentResult.amount, 'RENT_RECEIVED', io);
                        }
                        (0, broadcast_1.broadcastToRoom)(io, session.id, 'RENT_CHARGED', {
                            from: playerId,
                            to: rentResult.recipient,
                            tileId: tile.id,
                            amount: rentResult.amount,
                            phase: session.pendingExtraRoll ? GameSession_types_1.TurnPhase.WAITING_FOR_ACTION : GameSession_types_1.TurnPhase.END_TURN_PENDING,
                            availableActions: session.pendingExtraRoll ? ['ROLL_DICE'] : ['END_TURN'],
                        });
                        (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
                    }
                    else {
                        // Can't pay → enter dying rescue
                        (0, BankruptcyResolver_1.enterDyingRescue)(session, playerId, GameSession_types_2.BankruptcyType.TYPE_B, rentResult.recipient !== Common_types_1.BANK_ID ? rentResult.recipient : null, rentResult.amount, io);
                        (0, TradeManager_1.voidTradesInvolvingPlayer)(session, playerId, Trade_types_1.TradeVoidReason.PLAYER_DYING, io);
                    }
                }
                else {
                    (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
                }
            }
            break;
        }
        case Tile_types_1.TileType.TAX: {
            const player = (0, GameSession_1.requirePlayer)(session, playerId);
            // Random tax rate between 5% and 15% of current cash
            const taxRate = 0.05 + Math.random() * 0.10;
            const taxAmount = Math.max(1, Math.floor(player.cash * taxRate));
            // Hold the amount — deduction happens when player confirms via PAY_TAX action
            session.pendingTileEvent = { tileId: tile.id, availableActions: ['PAY_TAX'], taxAmount };
            StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.EVENT_TRIGGER);
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'TILE_EVENT', {
                playerId,
                tileId: tile.id,
                tileType: tile.type,
                phase: GameSession_types_1.TurnPhase.EVENT_TRIGGER,
                availableActions: ['PAY_TAX'],
                taxAmount,
            });
            break;
        }
        case Tile_types_1.TileType.SURPRISE: {
            StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.EVENT_TRIGGER);
            const surpriseResult = (0, SurpriseHandler_1.applySurpriseCard)(session, playerId, io);
            if (surpriseResult.requiresRescue) {
                (0, BankruptcyResolver_1.enterDyingRescue)(session, playerId, GameSession_types_2.BankruptcyType.TYPE_A, null, surpriseResult.amountOwed, io);
                (0, TradeManager_1.voidTradesInvolvingPlayer)(session, playerId, Trade_types_1.TradeVoidReason.PLAYER_DYING, io);
            }
            else {
                session.pendingExtraRoll = session.pendingExtraRoll || surpriseResult.rampage;
                (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
            }
            break;
        }
        case Tile_types_1.TileType.JAIL:
            // Just visiting — no effect
            (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
            break;
        case Tile_types_1.TileType.TEMPLE: {
            const templeResult = (0, TempleManager_1.handleTempleLanding)(session, playerId, tile.id, io);
            if (templeResult.requiresRescue) {
                const rentResult = (0, RentCalculator_1.computeRent)(session, tile.id, playerId);
                (0, BankruptcyResolver_1.enterDyingRescue)(session, playerId, GameSession_types_2.BankruptcyType.TYPE_B, rentResult.recipient !== Common_types_1.BANK_ID ? rentResult.recipient : null, templeResult.amountOwed, io);
                (0, TradeManager_1.voidTradesInvolvingPlayer)(session, playerId, Trade_types_1.TradeVoidReason.PLAYER_DYING, io);
            }
            else if (!templeResult.rentCharged && !templeResult.propCardDrawn) {
                const isUnowned = !tile.ownerId;
                const isOwner = tile.ownerId === playerId;
                const availableActions = isUnowned
                    ? ['BUY_PROPERTY', 'SKIP_PURCHASE']
                    : isOwner
                        ? ['TEMPLE_PRAY', 'SKIP_PURCHASE']
                        : ['SKIP_PURCHASE'];
                session.pendingTileEvent = { tileId: tile.id, availableActions };
                StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.EVENT_TRIGGER);
                (0, broadcast_1.broadcastToRoom)(io, session.id, 'TILE_EVENT', {
                    playerId,
                    tileId: tile.id,
                    tileType: tile.type,
                    phase: GameSession_types_1.TurnPhase.EVENT_TRIGGER,
                    availableActions,
                });
            }
            else {
                (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
            }
            break;
        }
        case Tile_types_1.TileType.CASINO: {
            session.pendingTileEvent = { tileId: tile.id, availableActions: ['CASINO_BET', 'SKIP_PURCHASE'] };
            StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.EVENT_TRIGGER);
            (0, broadcast_1.broadcastToRoom)(io, session.id, 'TILE_EVENT', {
                playerId,
                tileId: tile.id,
                tileType: tile.type,
                phase: GameSession_types_1.TurnPhase.EVENT_TRIGGER,
                availableActions: ['CASINO_BET', 'SKIP_PURCHASE'],
            });
            break;
        }
        default:
            (0, TurnFlow_1.resolveAfterLanding)(session, playerId, io);
    }
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
//# sourceMappingURL=SocketEventRouter.js.map