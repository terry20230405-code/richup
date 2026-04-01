/**
 * Socket.io event router — central dispatch point for all client actions.
 *
 * Pattern for every handler:
 *   1. Resolve session + playerId from socket context
 *   2. Guard: phase check, turn check, Zod validation
 *   3. Execute module function
 *   4. Handle errors → emit ACTION_REJECTED
 */

import { z } from 'zod';
import type { Server, Socket } from 'socket.io';
import type { PlayerId, Money, TileId } from '../types/Common.types';
import { TurnPhase, GameStatus } from '../types/GameSession.types';
import { BankruptcyType } from '../types/GameSession.types';
import { PlayerStatus } from '../types/Player.types';
import type { S2C_ActionRejected, S2C_TurnStarted, S2C_TurnEnded, S2C_MapGenerated, S2C_GamePaused, S2C_GameResumed, S2C_PlayerDisconnected, S2C_PlayerReconnected, S2C_ReconnectSuccess } from '../types/Events.types';
import { PropCardType } from '../types/PropCard.types';
import {
  getSocketContext,
  registerSocket,
  unregisterSocket,
  getSession,
  verifyToken,
} from '../state/RoomManager';
import {
  startGame,
  requirePlayer,
  getCurrentPlayerId,
  getActivePlayers,
  advanceTurn,
  checkVictory,
} from '../state/GameSession';
import { StateMachine } from '../state/StateMachine';
import { buildReconnectSnapshot, serializeBoard, toPublicView } from '../serialization/GameStateSerializer';
import { performRoll as _performRoll, rollForJailDouble as _rollForJailDouble, resetDoublesTracker } from '../modules/DiceEngine';
import { movePlayer as _movePlayer, getPlayerTile, needsTileEvent } from '../modules/MovementEngine';
import { computeRent } from '../modules/RentCalculator';
import { applySurpriseCard } from '../modules/SurpriseHandler';
import { sendToJail, payBail, resolveJailRoll } from '../modules/JailManager';
import { startAuction, placeBid, passAuction } from '../modules/AuctionManager';
import { buildHouse, buildHotel, sellBuilding, mortgageProperty, unmortgageProperty } from '../modules/BuildingManager';
import { enterDyingRescue, declareBankruptcy, triggerWhaleFall, refreshDyingRescueActivity } from '../modules/BankruptcyResolver';
import { proposeTrade, acceptTrade, rejectTrade, cancelTrade, voidOutgoingTrades } from '../modules/TradeManager';
import { usePropCard } from '../modules/PropCardHandler';
import { ownerPrays, handleTempleLanding } from '../modules/TempleManager';
import { handleCasinoBet } from '../modules/CasinoManager';
import { broadcastToRoom } from './emitters/broadcast';
import { emitToPlayer, playerRoom } from './emitters/direct';
import { phaseGuard } from './guards/phaseGuard';
import { playerTurnGuard } from './guards/playerTurnGuard';
import { validateInput } from './guards/inputValidator';
import { cancelAllTimers, scheduleTimer, TimerNS } from '../utils/timerUtils';
import { TradeVoidReason } from '../types/Trade.types';
import { TileType } from '../types/Tile.types';
import type { PropertyTile } from '../types/Tile.types';
import type { GameSession } from '../types/GameSession.types';
import { cashChange } from '../state/GameSession';
import { BANK_ID } from '../types/Common.types';
import { DomainError } from '../utils/errors';
import { logger } from '../utils/logger';

const _DiceEngine = { performRoll: _performRoll, rollForJailDouble: _rollForJailDouble };
const _MovementEngine = { movePlayer: _movePlayer };

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const AuctionBidSchema = z.object({ amount: z.number().int().positive() });
const BuildSchema = z.object({ tileId: z.number().int().min(0) });
const TradeOfferSchema = z.object({
  cash: z.number().int().min(0).optional(),
  tileIds: z.array(z.number().int().min(0)),
  propCardIds: z.array(z.string()).optional(),
});
const ProposeTradeSchema = z.object({
  responderId: z.string(),
  proposerOffer: TradeOfferSchema,
  responderOffer: TradeOfferSchema,
});
const TradeIdSchema = z.object({ tradeId: z.string() });
const UsePropCardSchema = z.object({
  cardId: z.string(),
  cardType: z.nativeEnum(PropCardType),
  targetPlayerId: z.string().optional(),
  targetTileId: z.number().int().min(0).optional(),
  steps: z.union([z.literal(5), z.literal(6), z.literal(7)]).optional(),
});
const CasinoBetSchema = z.object({ amount: z.number().int().positive() });
const ReconnectSchema = z.object({ sessionToken: z.string(), roomId: z.string() });

// ─── Error utility ────────────────────────────────────────────────────────────

function rejectAction(socket: Socket, action: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  const code = err instanceof DomainError ? domainErrorCode(err) : 'RULE_VIOLATION';
  const payload: S2C_ActionRejected = { action, reason: msg, code };
  socket.emit('ACTION_REJECTED', payload);
  logger.debug({ action, reason: msg }, 'Action rejected');
}

function domainErrorCode(err: DomainError): S2C_ActionRejected['code'] {
  const name = err.constructor.name;
  if (name === 'PhaseViolationError') return 'WRONG_PHASE';
  if (name === 'NotYourTurnError') return 'NOT_YOUR_TURN';
  if (name === 'InsufficientFundsError') return 'INSUFFICIENT_FUNDS';
  if (name === 'BidLockedError') return 'BID_LOCKED';
  return 'RULE_VIOLATION';
}

// ─── Context helpers ──────────────────────────────────────────────────────────

function getContext(socket: Socket) {
  const ctx = getSocketContext(socket.id);
  if (!ctx) return null;
  const session = getSession(ctx.roomId);
  if (!session) return null;
  return { ...ctx, session };
}

// ─── Router registration ──────────────────────────────────────────────────────

export function registerSocketEvents(io: Server, socket: Socket): void {

  // ── action:START_GAME ─────────────────────────────────────────────────────
  socket.on('action:START_GAME', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (session.hostId !== playerId) {
      socket.emit('ACTION_REJECTED', { action: 'START_GAME', reason: 'Only the host can start', code: 'RULE_VIOLATION' });
      return;
    }
    if (session.status !== GameStatus.LOBBY) {
      socket.emit('ACTION_REJECTED', { action: 'START_GAME', reason: 'Already started', code: 'WRONG_PHASE' });
      return;
    }

    try {
      startGame(session);

      const board = serializeBoard(session);
      const mapPayload: S2C_MapGenerated = { board, playerOrder: session.playerOrder };
      broadcastToRoom(io, session.id, 'MAP_GENERATED', mapPayload);

      emitTurnStarted(io, session);
    } catch (err) {
      rejectAction(socket, 'START_GAME', err);
    }
  });

  // ── action:ROLL_DICE ──────────────────────────────────────────────────────
  socket.on('action:ROLL_DICE', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    const player = session.players.get(playerId);
    if (!player) return;

    const allowedPhases = player.inJail
      ? [TurnPhase.JAIL_DECISION]
      : [TurnPhase.WAITING_FOR_ACTION];

    if (!phaseGuard(socket, session, allowedPhases, 'ROLL_DICE')) return;
    if (!playerTurnGuard(socket, session, playerId, 'ROLL_DICE')) return;

    try {
      if (player.inJail) {
        StateMachine.transition(session, TurnPhase.ROLLING_DICE);
        const result = _DiceEngine.rollForJailDouble(session, playerId, io);
        const released = resolveJailRoll(session, playerId, result.isDouble, io);
        if (released) {
          StateMachine.transition(session, TurnPhase.MOVING);
          const moveResult = _MovementEngine.movePlayer(session, playerId, result.total, io);
          handleLanding(session, playerId, moveResult.newPosition, io, socket);
        } else {
          StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
        }
      } else {
        StateMachine.transition(session, TurnPhase.ROLLING_DICE);
        const result = _DiceEngine.performRoll(session, playerId, io);

        if (result.jailTriggered) {
          sendToJail(session, playerId, io);
          StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
        } else {
          StateMachine.transition(session, TurnPhase.MOVING);
          const moveResult = _MovementEngine.movePlayer(session, playerId, result.total, io);
          handleLanding(session, playerId, moveResult.newPosition, io, socket);

          // Doubles: allow another roll (stay in WAITING_FOR_ACTION) unless game handled it
          if (result.isDouble && session.currentPhase === TurnPhase.END_TURN_PENDING) {
            // Doubles after landing: stay in END_TURN so player still ends turn
          }
        }
      }
    } catch (err) {
      rejectAction(socket, 'ROLL_DICE', err);
    }
  });

  // ── action:END_TURN ───────────────────────────────────────────────────────
  socket.on('action:END_TURN', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.END_TURN_PENDING], 'END_TURN')) return;
    if (!playerTurnGuard(socket, session, playerId, 'END_TURN')) return;

    try {
      const endPayload: S2C_TurnEnded = { playerId };
      broadcastToRoom(io, session.id, 'TURN_ENDED', endPayload);

      // Check price-hike card expiry
      const player = requirePlayer(session, playerId);
      if (player.priceHikeActive && player.priceHikeExpiresOnTurn !== null
          && session.turnNumber >= player.priceHikeExpiresOnTurn) {
        player.priceHikeActive = false;
        player.priceHikeExpiresOnTurn = null;
        broadcastToRoom(io, session.id, 'PRICE_HIKE_EXPIRED', { playerId });
      }

      resetDoublesTracker(session.id, playerId);

      StateMachine.transition(session, TurnPhase.TURN_TRANSITIONING);
      advanceTurn(session);

      const nextPlayer = session.players.get(getCurrentPlayerId(session))!;
      const nextPhase = nextPlayer.inJail ? TurnPhase.JAIL_DECISION : TurnPhase.WAITING_FOR_ACTION;
      StateMachine.transition(session, nextPhase);

      emitTurnStarted(io, session);
    } catch (err) {
      rejectAction(socket, 'END_TURN', err);
    }
  });

  // ── action:BUY_PROPERTY ───────────────────────────────────────────────────
  socket.on('action:BUY_PROPERTY', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.EVENT_TRIGGER], 'BUY_PROPERTY')) return;
    if (!playerTurnGuard(socket, session, playerId, 'BUY_PROPERTY')) return;

    try {
      const tile = getPlayerTile(session, playerId);
      if (!('basePrice' in tile) || !('ownerId' in tile)) {
        throw new Error('Current tile is not purchasable');
      }
      const purchasable = tile as PropertyTile & { basePrice: number; ownerId: PlayerId | null };
      if (purchasable.ownerId !== null) throw new Error('Tile is already owned');

      const player = requirePlayer(session, playerId);
      const price = purchasable.basePrice as Money;
      if (player.cash < price) throw new Error('Insufficient funds');

      purchasable.ownerId = playerId;
      cashChange(session, playerId, -price, 'PROPERTY_PURCHASE', io);

      broadcastToRoom(io, session.id, 'PROPERTY_PURCHASED', {
        tileId: tile.id,
        buyerId: playerId,
        price,
      });

      StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
    } catch (err) {
      rejectAction(socket, 'BUY_PROPERTY', err);
    }
  });

  // ── action:CHOOSE_AUCTION ─────────────────────────────────────────────────
  socket.on('action:CHOOSE_AUCTION', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.EVENT_TRIGGER], 'CHOOSE_AUCTION')) return;
    if (!playerTurnGuard(socket, session, playerId, 'CHOOSE_AUCTION')) return;

    try {
      const tile = getPlayerTile(session, playerId);
      startAuction(session, tile.id, io);
    } catch (err) {
      rejectAction(socket, 'CHOOSE_AUCTION', err);
    }
  });

  // ── action:SKIP_PURCHASE ──────────────────────────────────────────────────
  socket.on('action:SKIP_PURCHASE', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.EVENT_TRIGGER], 'SKIP_PURCHASE')) return;
    if (!playerTurnGuard(socket, session, playerId, 'SKIP_PURCHASE')) return;

    try {
      StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
    } catch (err) {
      rejectAction(socket, 'SKIP_PURCHASE', err);
    }
  });

  // ── action:AUCTION_BID ────────────────────────────────────────────────────
  socket.on('action:AUCTION_BID', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.AUCTION_IN_PROGRESS], 'AUCTION_BID')) return;
    const validated = validateInput(socket, AuctionBidSchema, data, 'AUCTION_BID');
    if (!validated) return;

    try {
      placeBid(session, playerId, validated.amount as Money, io);
    } catch (err) {
      rejectAction(socket, 'AUCTION_BID', err);
    }
  });

  // ── action:AUCTION_PASS ───────────────────────────────────────────────────
  socket.on('action:AUCTION_PASS', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.AUCTION_IN_PROGRESS], 'AUCTION_PASS')) return;

    try {
      passAuction(session, playerId, io);
    } catch (err) {
      rejectAction(socket, 'AUCTION_PASS', err);
    }
  });

  // ── action:BUILD_HOUSE ────────────────────────────────────────────────────
  socket.on('action:BUILD_HOUSE', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.WAITING_FOR_ACTION, TurnPhase.END_TURN_PENDING], 'BUILD_HOUSE')) return;
    const validated = validateInput(socket, BuildSchema, data, 'BUILD_HOUSE');
    if (!validated) return;

    try {
      buildHouse(session, playerId, validated.tileId as TileId, io);
    } catch (err) {
      rejectAction(socket, 'BUILD_HOUSE', err);
    }
  });

  // ── action:BUILD_HOTEL ────────────────────────────────────────────────────
  socket.on('action:BUILD_HOTEL', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.WAITING_FOR_ACTION, TurnPhase.END_TURN_PENDING], 'BUILD_HOTEL')) return;
    const validated = validateInput(socket, BuildSchema, data, 'BUILD_HOTEL');
    if (!validated) return;

    try {
      buildHotel(session, playerId, validated.tileId as TileId, io);
    } catch (err) {
      rejectAction(socket, 'BUILD_HOTEL', err);
    }
  });

  // ── action:SELL_BUILDING ──────────────────────────────────────────────────
  socket.on('action:SELL_BUILDING', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.WAITING_FOR_ACTION, TurnPhase.DYING_RESCUE, TurnPhase.END_TURN_PENDING], 'SELL_BUILDING')) return;
    const validated = validateInput(socket, BuildSchema, data, 'SELL_BUILDING');
    if (!validated) return;

    try {
      if (session.currentPhase === TurnPhase.DYING_RESCUE) {
        refreshDyingRescueActivity(session, playerId);
      }
      sellBuilding(session, playerId, validated.tileId as TileId, io);
    } catch (err) {
      rejectAction(socket, 'SELL_BUILDING', err);
    }
  });

  // ── action:MORTGAGE ───────────────────────────────────────────────────────
  socket.on('action:MORTGAGE', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.WAITING_FOR_ACTION, TurnPhase.DYING_RESCUE, TurnPhase.END_TURN_PENDING], 'MORTGAGE')) return;
    const validated = validateInput(socket, BuildSchema, data, 'MORTGAGE');
    if (!validated) return;

    try {
      if (session.currentPhase === TurnPhase.DYING_RESCUE) {
        refreshDyingRescueActivity(session, playerId);
      }
      mortgageProperty(session, playerId, validated.tileId as TileId, io);
    } catch (err) {
      rejectAction(socket, 'MORTGAGE', err);
    }
  });

  // ── action:UNMORTGAGE ─────────────────────────────────────────────────────
  socket.on('action:UNMORTGAGE', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.WAITING_FOR_ACTION, TurnPhase.END_TURN_PENDING], 'UNMORTGAGE')) return;
    const validated = validateInput(socket, BuildSchema, data, 'UNMORTGAGE');
    if (!validated) return;

    try {
      unmortgageProperty(session, playerId, validated.tileId as TileId, io);
    } catch (err) {
      rejectAction(socket, 'UNMORTGAGE', err);
    }
  });

  // ── action:PROPOSE_TRADE ──────────────────────────────────────────────────
  socket.on('action:PROPOSE_TRADE', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    const validated = validateInput(socket, ProposeTradeSchema, data, 'PROPOSE_TRADE');
    if (!validated) return;

    try {
      if (session.currentPhase === TurnPhase.DYING_RESCUE) {
        refreshDyingRescueActivity(session, playerId);
      }
      proposeTrade(
        session, playerId, validated.responderId,
        { cash: validated.proposerOffer.cash ?? 0, tileIds: validated.proposerOffer.tileIds, propCardIds: validated.proposerOffer.propCardIds ?? [] },
        { cash: validated.responderOffer.cash ?? 0, tileIds: validated.responderOffer.tileIds, propCardIds: validated.responderOffer.propCardIds ?? [] },
        io,
      );
    } catch (err) {
      rejectAction(socket, 'PROPOSE_TRADE', err);
    }
  });

  // ── action:ACCEPT_TRADE ───────────────────────────────────────────────────
  socket.on('action:ACCEPT_TRADE', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    const validated = validateInput(socket, TradeIdSchema, data, 'ACCEPT_TRADE');
    if (!validated) return;

    try {
      if (session.currentPhase === TurnPhase.DYING_RESCUE) {
        refreshDyingRescueActivity(session, playerId);
      }
      acceptTrade(session, validated.tradeId, playerId, io);
    } catch (err) {
      rejectAction(socket, 'ACCEPT_TRADE', err);
    }
  });

  // ── action:REJECT_TRADE ───────────────────────────────────────────────────
  socket.on('action:REJECT_TRADE', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    const validated = validateInput(socket, TradeIdSchema, data, 'REJECT_TRADE');
    if (!validated) return;

    try {
      rejectTrade(session, validated.tradeId, playerId, io);
    } catch (err) {
      rejectAction(socket, 'REJECT_TRADE', err);
    }
  });

  // ── action:CANCEL_TRADE ───────────────────────────────────────────────────
  socket.on('action:CANCEL_TRADE', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    const validated = validateInput(socket, TradeIdSchema, data, 'CANCEL_TRADE');
    if (!validated) return;

    try {
      cancelTrade(session, validated.tradeId, playerId, io);
    } catch (err) {
      rejectAction(socket, 'CANCEL_TRADE', err);
    }
  });

  // ── action:PAY_BAIL ───────────────────────────────────────────────────────
  socket.on('action:PAY_BAIL', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.JAIL_DECISION], 'PAY_BAIL')) return;
    if (!playerTurnGuard(socket, session, playerId, 'PAY_BAIL')) return;

    try {
      payBail(session, playerId, io);
    } catch (err) {
      rejectAction(socket, 'PAY_BAIL', err);
    }
  });

  // ── action:ROLL_FOR_DOUBLE (in jail) ──────────────────────────────────────
  socket.on('action:ROLL_FOR_DOUBLE', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.JAIL_DECISION], 'ROLL_FOR_DOUBLE')) return;
    if (!playerTurnGuard(socket, session, playerId, 'ROLL_FOR_DOUBLE')) return;

    // Handled by ROLL_DICE when inJail — kept here for explicit event support
    try {
      StateMachine.transition(session, TurnPhase.ROLLING_DICE);
      const result = _DiceEngine.rollForJailDouble(session, playerId, io);
      const released = resolveJailRoll(session, playerId, result.isDouble, io);
      if (released) {
        StateMachine.transition(session, TurnPhase.MOVING);
        const moveResult = _MovementEngine.movePlayer(session, playerId, result.total, io);
        handleLanding(session, playerId, moveResult.newPosition, io, socket);
      } else {
        StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
      }
    } catch (err) {
      rejectAction(socket, 'ROLL_FOR_DOUBLE', err);
    }
  });

  // ── action:USE_PROP_CARD ──────────────────────────────────────────────────
  socket.on('action:USE_PROP_CARD', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.WAITING_FOR_ACTION, TurnPhase.END_TURN_PENDING], 'USE_PROP_CARD')) return;
    const validated = validateInput(socket, UsePropCardSchema, data, 'USE_PROP_CARD');
    if (!validated) return;

    try {
      usePropCard(session, playerId, validated.cardId, validated.cardType, {
        targetPlayerId: validated.targetPlayerId,
        targetTileId: validated.targetTileId as TileId | undefined,
        steps: validated.steps,
      }, io);
    } catch (err) {
      rejectAction(socket, 'USE_PROP_CARD', err);
    }
  });

  // ── action:TEMPLE_PRAY ────────────────────────────────────────────────────
  socket.on('action:TEMPLE_PRAY', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.EVENT_TRIGGER], 'TEMPLE_PRAY')) return;
    if (!playerTurnGuard(socket, session, playerId, 'TEMPLE_PRAY')) return;

    try {
      const tile = getPlayerTile(session, playerId);
      ownerPrays(session, playerId, tile.id, io);
      StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
    } catch (err) {
      rejectAction(socket, 'TEMPLE_PRAY', err);
    }
  });

  // ── action:CASINO_BET ─────────────────────────────────────────────────────
  socket.on('action:CASINO_BET', (data: unknown) => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.EVENT_TRIGGER], 'CASINO_BET')) return;
    if (!playerTurnGuard(socket, session, playerId, 'CASINO_BET')) return;

    const validated = validateInput(socket, CasinoBetSchema, data, 'CASINO_BET');
    if (!validated) return;

    try {
      handleCasinoBet(session, playerId, validated.amount as Money, io);
      StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
    } catch (err) {
      rejectAction(socket, 'CASINO_BET', err);
    }
  });

  // ── action:DECLARE_BANKRUPTCY ─────────────────────────────────────────────
  socket.on('action:DECLARE_BANKRUPTCY', () => {
    const ctx = getContext(socket);
    if (!ctx) return;
    const { session, playerId } = ctx;

    if (!phaseGuard(socket, session, [TurnPhase.DYING_RESCUE], 'DECLARE_BANKRUPTCY')) return;
    if (session.dyingRescue?.playerId !== playerId) {
      socket.emit('ACTION_REJECTED', { action: 'DECLARE_BANKRUPTCY', reason: 'You are not in dying rescue', code: 'RULE_VIOLATION' });
      return;
    }

    try {
      declareBankruptcy(session, playerId, io);
    } catch (err) {
      rejectAction(socket, 'DECLARE_BANKRUPTCY', err);
    }
  });

  // ── action:RECONNECT ──────────────────────────────────────────────────────
  socket.on('action:RECONNECT', (data: unknown) => {
    const validated = validateInput(socket, ReconnectSchema, data, 'RECONNECT');
    if (!validated) return;

    try {
      const payload = verifyToken(validated.sessionToken);
      const session = getSession(payload.roomId);
      if (!session) {
        socket.emit('ACTION_REJECTED', { action: 'RECONNECT', reason: 'Room not found', code: 'RULE_VIOLATION' });
        return;
      }

      const player = session.players.get(payload.playerId);
      if (!player) {
        socket.emit('ACTION_REJECTED', { action: 'RECONNECT', reason: 'Player not found', code: 'RULE_VIOLATION' });
        return;
      }

      // Register new socket
      registerSocket(socket.id, payload.playerId, payload.roomId);
      socket.join(payload.roomId);
      socket.join(playerRoom(payload.playerId));

      // Cancel reconnect timer
      cancelAllTimers(`${session.id}:${payload.playerId}:reconnect`);

      // Update player state
      player.isConnected = true;
      player.status = player.status === PlayerStatus.DISCONNECTED ? PlayerStatus.ACTIVE : player.status;
      player.lastSeenAt = Date.now();

      // Was this the disconnected current-turn player?
      const wasCurrentPlayer = session.disconnectedCurrentPlayerId === payload.playerId;
      if (wasCurrentPlayer) {
        session.disconnectedCurrentPlayerId = null;
        session.pausedAt = null;
        session.status = GameStatus.IN_PROGRESS;

        const resumePayload: S2C_GameResumed = {
          currentTurnPlayerId: getCurrentPlayerId(session),
          currentTurnPhase: session.currentPhase,
        };
        broadcastToRoom(io, session.id, 'GAME_RESUMED', resumePayload);
      }

      const reconnectedPayload: S2C_PlayerReconnected = { playerId: payload.playerId };
      broadcastToRoom(io, session.id, 'PLAYER_RECONNECTED', reconnectedPayload);

      const snapshot = buildReconnectSnapshot(session, payload.playerId);
      const successPayload: S2C_ReconnectSuccess = snapshot;
      socket.emit('RECONNECT_SUCCESS', successPayload);

      logger.info({ roomId: payload.roomId, playerId: payload.playerId }, 'Player reconnected');
    } catch (err) {
      rejectAction(socket, 'RECONNECT', err);
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const entry = unregisterSocket(socket.id);
    if (!entry) return;

    const { playerId, roomId } = entry;
    const session = getSession(roomId);
    if (!session || session.status !== GameStatus.IN_PROGRESS) return;

    const player = session.players.get(playerId);
    if (!player) return;

    player.isConnected = false;
    player.lastSeenAt = Date.now();
    player.status = PlayerStatus.DISCONNECTED;

    const isCurrentPlayer = getCurrentPlayerId(session) === playerId;

    const disconnectedPayload: S2C_PlayerDisconnected = {
      playerId,
      afkWarningMs: session.config.reconnectWindowMs,
    };
    broadcastToRoom(io, session.id, 'PLAYER_DISCONNECTED', disconnectedPayload);

    if (isCurrentPlayer) {
      // Pause game
      session.status = GameStatus.PAUSED;
      session.pausedAt = Date.now();
      session.disconnectedCurrentPlayerId = playerId;

      const pausePayload: S2C_GamePaused = {
        disconnectedPlayerId: playerId,
        reconnectWindowSeconds: Math.ceil(session.config.reconnectWindowMs / 1000),
      };
      broadcastToRoom(io, session.id, 'GAME_PAUSED', pausePayload);

      // Start whale-fall timer
      scheduleTimer(
        TimerNS.reconnect(session.id, playerId),
        session.config.reconnectWindowMs,
        () => {
          if (session.disconnectedCurrentPlayerId === playerId) {
            triggerWhaleFall(session, playerId, 'DISCONNECT_TIMEOUT', io);
          }
        },
        `Reconnect timer for player ${playerId}`,
      );
    } else {
      // Non-current player disconnected — just start AFK timer, game continues
      scheduleTimer(
        TimerNS.reconnect(session.id, playerId),
        session.config.reconnectWindowMs,
        () => {
          const p = session.players.get(playerId);
          if (p && !p.isConnected) {
            triggerWhaleFall(session, playerId, 'DISCONNECT_TIMEOUT', io);
          }
        },
        `Reconnect timer for non-current player ${playerId}`,
      );
    }

    logger.info({ roomId, playerId, isCurrentPlayer }, 'Player disconnected');
  });
}

// ─── Landing handler ──────────────────────────────────────────────────────────

function handleLanding(
  session: GameSession,
  playerId: PlayerId,
  position: number,
  io: Server,
  socket: Socket,
): void {
  const tile = session.board[position]!;

  if (!needsTileEvent(tile)) {
    StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
    return;
  }

  switch (tile.type) {
    case TileType.PROPERTY:
    case TileType.AIRPORT: {
      if (!('ownerId' in tile) || !tile.ownerId) {
        // Unowned — offer purchase
        session.pendingTileEvent = {
          tileId: tile.id,
          availableActions: ['BUY_PROPERTY', 'CHOOSE_AUCTION', 'SKIP_PURCHASE'],
        };
        StateMachine.transition(session, TurnPhase.EVENT_TRIGGER);
        broadcastToRoom(io, session.id, 'TILE_EVENT', {
          playerId,
          tileId: tile.id,
          tileType: tile.type,
          phase: TurnPhase.EVENT_TRIGGER,
          availableActions: ['BUY_PROPERTY', 'CHOOSE_AUCTION', 'SKIP_PURCHASE'],
        });
      } else if (tile.ownerId === playerId) {
        // Own property — no event
        StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
      } else {
        // Pay rent
        const rentResult = computeRent(session, tile.id, playerId);
        if (rentResult.amount > 0) {
          const player = requirePlayer(session, playerId);

          // Check immunity
          if (player.hasImmunity) {
            player.hasImmunity = false;
            broadcastToRoom(io, session.id, 'IMMUNITY_USED', { playerId, tileId: tile.id });
            StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
            return;
          }

          if (player.cash >= rentResult.amount) {
            cashChange(session, playerId, -(rentResult.amount as Money), 'RENT_PAID', io);
            if (rentResult.recipient !== BANK_ID) {
              cashChange(session, rentResult.recipient, rentResult.amount, 'RENT_RECEIVED', io);
            }
            broadcastToRoom(io, session.id, 'RENT_CHARGED', {
              from: playerId,
              to: rentResult.recipient,
              tileId: tile.id,
              amount: rentResult.amount,
            });
            StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
          } else {
            // Can't pay → enter dying rescue
            enterDyingRescue(session, playerId, BankruptcyType.TYPE_B, rentResult.recipient !== BANK_ID ? rentResult.recipient : null, rentResult.amount, io);
            voidOutgoingTrades(session, playerId, TradeVoidReason.PLAYER_DYING, io);
          }
        } else {
          StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
        }
      }
      break;
    }

    case TileType.TAX: {
      // Tax amount placeholder — per PRD Phase 2
      const taxAmount = 500 as Money;
      const player = requirePlayer(session, playerId);

      if (player.cash >= taxAmount) {
        cashChange(session, playerId, -taxAmount, 'TAX', io);
        broadcastToRoom(io, session.id, 'TAX_PAID', { playerId, amount: taxAmount });
        StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
      } else {
        enterDyingRescue(session, playerId, BankruptcyType.TYPE_A, null, taxAmount, io);
        voidOutgoingTrades(session, playerId, TradeVoidReason.PLAYER_DYING, io);
      }
      break;
    }

    case TileType.SURPRISE: {
      StateMachine.transition(session, TurnPhase.EVENT_TRIGGER);
      const result = applySurpriseCard(session, playerId, io);
      if (result.rampage) {
        // Extra roll: stay in EVENT_TRIGGER then process roll
        StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
      } else {
        StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
      }
      break;
    }

    case TileType.JAIL:
      // Just visiting — no effect
      StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
      break;

    case TileType.TEMPLE: {
      const templeResult = handleTempleLanding(session, playerId, tile.id, io);
      if (!templeResult.rentCharged && !templeResult.propCardDrawn) {
        // Owner on unlit temple: offer to pray
        session.pendingTileEvent = {
          tileId: tile.id,
          availableActions: tile.ownerId === playerId ? ['TEMPLE_PRAY', 'SKIP_PURCHASE'] : ['SKIP_PURCHASE'],
        };
        StateMachine.transition(session, TurnPhase.EVENT_TRIGGER);
      } else {
        StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
      }
      break;
    }

    case TileType.CASINO: {
      session.pendingTileEvent = { tileId: tile.id, availableActions: ['CASINO_BET'] };
      StateMachine.transition(session, TurnPhase.EVENT_TRIGGER);
      broadcastToRoom(io, session.id, 'TILE_EVENT', {
        playerId,
        tileId: tile.id,
        tileType: tile.type,
        phase: TurnPhase.EVENT_TRIGGER,
        availableActions: ['CASINO_BET'],
      });
      break;
    }

    default:
      StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emitTurnStarted(io: Server, session: GameSession): void {
  const currentPlayerId = getCurrentPlayerId(session);
  const payload: S2C_TurnStarted = {
    playerId: currentPlayerId,
    turnNumber: session.turnNumber,
    phase: session.currentPhase,
    timeoutMs: 60_000,  // Placeholder; real value per phase
  };
  broadcastToRoom(io, session.id, 'TURN_STARTED', payload);
}

