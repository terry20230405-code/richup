/**
 * Dual-track bankruptcy resolution.
 *
 * TYPE_A (tax / system debt / whale-fall):
 *   - All cash destroyed (removed from game)
 *   - All properties stripped of buildings, returned to unowned
 *   - Prop cards destroyed
 *
 * TYPE_B (rent owed to another player):
 *   - Pay creditor: min(all liquidatable assets, amountOwed)
 *   - Remaining cash DESTROYED (not given to creditor — inflation prevention)
 *   - All properties stripped and returned to unowned
 *   - Prop cards destroyed
 */

import type { Server } from 'socket.io';
import type { PlayerId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { TurnPhase, BankruptcyType, GameStatus } from '../types/GameSession.types';
import { PlayerStatus } from '../types/Player.types';
import type { PropertyTile } from '../types/Tile.types';
import { TileType } from '../types/Tile.types';
import type {
  S2C_PlayerDying,
  S2C_PlayerRescued,
  S2C_PlayerBankrupt,
  S2C_WhaleFall,
  S2C_PropertyFreed,
  S2C_DyingRescueAfkWarning,
  S2C_DyingRescueDetail,
} from '../types/Events.types';
import { requirePlayer, cashChange, checkVictory, syncPropCards } from '../state/GameSession';
import { StateMachine } from '../state/StateMachine';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { emitToPlayer } from '../socket/emitters/direct';
import { cancelAllTimers, scheduleTimer, TimerNS } from '../utils/timerUtils';
import { logger } from '../utils/logger';
import { advanceToNextTurn } from './TurnFlow';
import { voidAllPendingTrades, voidTradesInvolvingPlayer } from './TradeLifecycle';
import { TradeVoidReason } from '../types/Trade.types';

export const DYING_RESCUE_AVAILABLE_ACTIONS = [
  'SELL_BUILDING',
  'MORTGAGE',
  'PROPOSE_TRADE',
  'ACCEPT_TRADE',
  'REJECT_TRADE',
  'CANCEL_TRADE',
  'DECLARE_BANKRUPTCY',
] as const;

// ─── Enter DYING_RESCUE ───────────────────────────────────────────────────────

/**
 * Transition a player to DYING_RESCUE state.
 * Starts the rescue window timer and AFK warning timer.
 */
export function enterDyingRescue(
  session: GameSession,
  playerId: PlayerId,
  bankruptcyType: BankruptcyType,
  creditorId: PlayerId | null,
  amountOwed: Money,
  io: Server,
): void {
  const player = requirePlayer(session, playerId);
  player.status = PlayerStatus.DYING;

  const startedAt = Date.now();
  const rescueDeadlineAt = startedAt + session.config.dyingRescueTotalMs;

  session.dyingRescue = {
    playerId,
    startedAt,
    lastActionAt: startedAt,
    afkWarningSentAt: null,
  };

  session.pendingBankruptcy = { playerId, type: bankruptcyType, creditorId, amountOwed };

  StateMachine.forcePhase(session, TurnPhase.DYING_RESCUE);

  const payload: S2C_PlayerDying = {
    playerId,
    rescueWindowMs: session.config.dyingRescueTotalMs,
    rescueDeadlineAt,
    phase: TurnPhase.DYING_RESCUE,
  };
  broadcastToRoom(io, session.id, 'PLAYER_DYING', payload);

  const detail = buildDyingRescueDetail(session, playerId);
  if (detail) {
    emitToPlayer(io, playerId, 'DYING_RESCUE_DETAIL', detail);
  }

  // AFK warning timer (fires 2 minutes before kick)
  scheduleTimer(
    TimerNS.dyingAfk(session.id, playerId),
    session.config.dyingRescueAfkWarningMs,
    () => {
      if (session.dyingRescue?.playerId === playerId) {
        session.dyingRescue.afkWarningSentAt = Date.now();
        const remaining = Math.ceil(
          (session.config.dyingRescueTotalMs - session.config.dyingRescueAfkWarningMs) / 1000,
        );
        const warnPayload: S2C_DyingRescueAfkWarning = { playerId, remainingSeconds: remaining };
        broadcastToRoom(io, session.id, 'DYING_RESCUE_AFK_WARNING', warnPayload);
      }
    },
    `AFK warning for dying player ${playerId}`,
  );

  // Total rescue window timer
  scheduleTimer(
    TimerNS.dyingRescue(session.id, playerId),
    session.config.dyingRescueTotalMs,
    () => {
      if (session.dyingRescue?.playerId === playerId) {
        triggerWhaleFall(session, playerId, 'AFK_IN_RESCUE', io);
      }
    },
    `Rescue timeout for player ${playerId}`,
  );

  logger.info({ roomId: session.id, playerId, bankruptcyType }, 'Player entered dying rescue');
}

// ─── Rescue activity tracking ─────────────────────────────────────────────────

/** Track valid activity without extending the fixed rescue deadline. */
export function refreshDyingRescueActivity(session: GameSession, playerId: PlayerId): void {
  if (session.dyingRescue?.playerId === playerId) {
    session.dyingRescue.lastActionAt = Date.now();
  }
}

export function buildDyingRescueDetail(
  session: GameSession,
  playerId: PlayerId,
): S2C_DyingRescueDetail | null {
  const rescue = session.dyingRescue;
  const pending = session.pendingBankruptcy;
  if (!rescue || !pending || rescue.playerId !== playerId || pending.playerId !== playerId) {
    return null;
  }

  return {
    amountOwed: pending.amountOwed,
    creditorId: pending.creditorId,
    bankruptcyType: pending.type,
    rescueDeadlineAt: rescue.startedAt + session.config.dyingRescueTotalMs,
    availableActions: [...DYING_RESCUE_AVAILABLE_ACTIONS],
  };
}

/** Settle a rescue debt after the player raises enough cash. */
export function rescueDyingPlayer(session: GameSession, playerId: PlayerId, io: Server): boolean {
  const pending = session.pendingBankruptcy;
  if (!pending || pending.playerId !== playerId) return false;

  const player = requirePlayer(session, playerId);
  if (player.cash < pending.amountOwed) return false;

  cancelDyingTimers(session, playerId);
  const amount = pending.amountOwed;
  if (amount > 0) {
    cashChange(session, playerId, -amount, 'DYING_RESCUE_PAYMENT', io);
    if (pending.creditorId) {
      cashChange(session, pending.creditorId, amount, `DYING_RESCUE_PAYMENT_FROM_${playerId}`, io);
    }
  }

  player.status = PlayerStatus.ACTIVE;
  session.dyingRescue = null;
  session.pendingBankruptcy = null;
  const payload: S2C_PlayerRescued = { playerId };
  broadcastToRoom(io, session.id, 'PLAYER_RESCUED', payload);
  return true;
}

// ─── Declare bankruptcy (voluntary) ─────────────────────────────────────────

export function declareBankruptcy(
  session: GameSession,
  playerId: PlayerId,
  io: Server,
): void {
  const pending = session.pendingBankruptcy;
  if (!pending || pending.playerId !== playerId) return;

  cancelDyingTimers(session, playerId);
  resolveBankruptcy(
    session,
    playerId,
    pending.type,
    pending.creditorId,
    pending.amountOwed,
    io,
  );
}

// ─── Whale-fall (involuntary) ─────────────────────────────────────────────────

export function triggerWhaleFall(
  session: GameSession,
  playerId: PlayerId,
  reason: 'DISCONNECT_TIMEOUT' | 'AFK_IN_RESCUE',
  io: Server,
): void {
  cancelDyingTimers(session, playerId);

  const payload: S2C_WhaleFall = { playerId, reason };
  broadcastToRoom(io, session.id, 'WHALE_FALL', payload);

  // Whale-fall is always TYPE_A
  resolveBankruptcy(session, playerId, BankruptcyType.TYPE_A, null, 0, io);
}

// ─── Resolution ──────────────────────────────────────────────────────────────

function resolveBankruptcy(
  session: GameSession,
  playerId: PlayerId,
  type: BankruptcyType,
  creditorId: PlayerId | null,
  amountOwed: Money,
  io: Server,
): void {
  const player = requirePlayer(session, playerId);

  const wasCurrentTurn = session.playerOrder[session.currentPlayerIndex] === playerId;
  const wasDyingRescuePlayer = session.dyingRescue?.playerId === playerId;
  const hadMatchingPendingBankruptcy = session.pendingBankruptcy?.playerId === playerId;

  voidTradesInvolvingPlayer(session, playerId, TradeVoidReason.PLAYER_BANKRUPT, io);

  // TYPE_B debts are paid from real cash plus the proceeds of liquidating
  // buildings and unmortgaged land. TYPE_A assets are returned to the bank
  // without creating cash because those debts have no player creditor.
  liquidateOwnedAssets(session, playerId, type === BankruptcyType.TYPE_B && creditorId !== null, io);
  if (type === BankruptcyType.TYPE_B && creditorId) {
    const transferAmount = Math.min(player.cash, amountOwed) as Money;
    if (transferAmount > 0) {
      cashChange(session, playerId, -transferAmount, 'BANKRUPTCY_LIQUIDATION', io);
      cashChange(session, creditorId, transferAmount, `BANKRUPTCY_TRANSFER_FROM_${playerId}`, io);
    }
  }

  // Strip all properties
  for (const tile of session.board) {
    if ('ownerId' in tile && tile.ownerId === playerId) {
      if (tile.type === TileType.PROPERTY) {
        (tile as PropertyTile).buildingLevel = 0;
      }
      (tile as { ownerId: PlayerId | null }).ownerId = null;
      if ('isMortgaged' in tile) {
        (tile as { isMortgaged: boolean }).isMortgaged = false;
      }

      const freePayload: S2C_PropertyFreed = {
        tileId: tile.id,
        previousOwnerId: playerId,
        newOwnerId: null,
      };
      broadcastToRoom(io, session.id, 'PROPERTY_FREED', freePayload);
    }
  }

  // Destroy remaining cash through the authoritative mutation path.
  if (player.cash !== 0) {
    cashChange(session, playerId, -player.cash as Money, 'BANKRUPTCY_CASH_DESTROYED', io);
  }

  // Destroy prop cards
  player.propCards = [];
  syncPropCards(session, playerId, io);

  // Mark bankrupt
  player.status = PlayerStatus.BANKRUPT;
  if (wasDyingRescuePlayer) {
    session.dyingRescue = null;
  }
  if (hadMatchingPendingBankruptcy) {
    session.pendingBankruptcy = null;
  }

  const bankruptPayload: S2C_PlayerBankrupt = {
    playerId,
    bankruptType: type,
    creditorId: creditorId ?? null,
  };
  broadcastToRoom(io, session.id, 'PLAYER_BANKRUPT', bankruptPayload);

  removePlayerFromOrder(session, playerId, wasCurrentTurn);

  logger.info({ roomId: session.id, playerId, type }, 'Bankruptcy resolved');

  // Check if game is over
  const winnerId = checkVictory(session);
  if (winnerId) {
    endGame(session, [winnerId], io);
    return;
  }

  // A non-current player can whale-fall without interrupting the active turn.
  if (wasCurrentTurn || wasDyingRescuePlayer) {
    session.status = GameStatus.IN_PROGRESS;
    session.pausedAt = null;
    session.disconnectedCurrentPlayerId = null;
    advanceToNextTurn(session, io);
  }
}

// ─── Game over ────────────────────────────────────────────────────────────────

function endGame(session: GameSession, winnerIds: PlayerId[], io: Server): void {
  const { GameStatus } = require('../types/GameSession.types');
  session.status = GameStatus.FINISHED;
  session.finishedAt = Date.now();
  session.winnerIds = winnerIds;

  cancelAllTimers(session.id);
  voidAllPendingTrades(session, TradeVoidReason.GAME_ENDED, io);

  const standings = session.playerOrder.map((pid, i) => ({ playerId: pid, rank: i + 1 }));
  broadcastToRoom(io, session.id, 'GAME_OVER', { winnerIds, standings });
  logger.info({ roomId: session.id, winnerIds }, 'Game over');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cancelDyingTimers(session: GameSession, playerId: PlayerId): void {
  cancelAllTimers(`${session.id}:${playerId}`);
}

function removePlayerFromOrder(session: GameSession, playerId: PlayerId, wasCurrentTurn: boolean): void {
  const removedIndex = session.playerOrder.indexOf(playerId);
  if (removedIndex < 0) return;

  session.playerOrder.splice(removedIndex, 1);
  if (session.playerOrder.length === 0) {
    session.currentPlayerIndex = 0;
  } else if (wasCurrentTurn) {
    session.currentPlayerIndex = (removedIndex - 1 + session.playerOrder.length) % session.playerOrder.length;
  } else if (removedIndex < session.currentPlayerIndex) {
    session.currentPlayerIndex--;
  }
}

function liquidateOwnedAssets(
  session: GameSession,
  playerId: PlayerId,
  realizeProceeds: boolean,
  io: Server,
): void {
  let proceeds = 0;
  for (const tile of session.board) {
    if (!('ownerId' in tile) || tile.ownerId !== playerId) continue;

    if (tile.type === TileType.PROPERTY) {
      if (realizeProceeds && tile.buildingLevel > 0) {
        proceeds += Math.floor(tile.buildCost * tile.buildingLevel * session.config.buildingRefundRate);
      }
      tile.buildingLevel = 0;
    }
    if ('isMortgaged' in tile) {
      if (realizeProceeds && !tile.isMortgaged && 'mortgageValue' in tile) {
        proceeds += tile.mortgageValue;
      }
      tile.isMortgaged = true;
    }
  }

  if (realizeProceeds && proceeds > 0) {
    cashChange(session, playerId, proceeds as Money, 'BANKRUPTCY_ASSET_LIQUIDATION', io);
  }
}
