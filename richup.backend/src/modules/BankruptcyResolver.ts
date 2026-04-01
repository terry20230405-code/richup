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
import { TurnPhase, BankruptcyType } from '../types/GameSession.types';
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
} from '../types/Events.types';
import { requirePlayer, cashChange, getActivePlayers, checkVictory, advanceTurn, getCurrentPlayerId } from '../state/GameSession';
import { StateMachine } from '../state/StateMachine';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { cancelAllTimers, scheduleTimer, TimerNS } from '../utils/timerUtils';
import { logger } from '../utils/logger';

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

  session.dyingRescue = {
    playerId,
    startedAt: Date.now(),
    lastActionAt: Date.now(),
    afkWarningSentAt: null,
  };

  session.pendingBankruptcy = { playerId, type: bankruptcyType, creditorId, amountOwed };

  StateMachine.forcePhase(session, TurnPhase.DYING_RESCUE);

  const payload: S2C_PlayerDying = {
    playerId,
    rescueWindowMs: session.config.dyingRescueTotalMs,
  };
  broadcastToRoom(io, session.id, 'PLAYER_DYING', payload);

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

// ─── Rescue actions reset the AFK timer ───────────────────────────────────────

/** Call this whenever the dying player takes a valid action in DYING_RESCUE. */
export function refreshDyingRescueActivity(session: GameSession, playerId: PlayerId): void {
  if (session.dyingRescue?.playerId === playerId) {
    session.dyingRescue.lastActionAt = Date.now();
  }
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
  resolveBankruptcy(session, pending.type, pending.creditorId, io);
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
  resolveBankruptcy(session, BankruptcyType.TYPE_A, null, io);
}

// ─── Resolution ──────────────────────────────────────────────────────────────

function resolveBankruptcy(
  session: GameSession,
  type: BankruptcyType,
  creditorId: PlayerId | null,
  io: Server,
): void {
  const pending = session.pendingBankruptcy;
  if (!pending) return;

  const playerId = pending.playerId;
  const player = requirePlayer(session, playerId);

  if (type === BankruptcyType.TYPE_B && creditorId) {
    // Transfer min(assets, amountOwed) to creditor
    const totalAssets = liquidatableValue(session, playerId);
    const transferAmount = Math.min(totalAssets, pending.amountOwed) as Money;

    if (transferAmount > 0) {
      // Destroy player cash first
      player.cash = 0;
      // Then give creditor the calculated amount
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

  // Destroy remaining cash
  player.cash = 0 as Money;

  // Destroy prop cards
  player.propCards = [];

  // Mark bankrupt
  player.status = PlayerStatus.BANKRUPT;
  session.dyingRescue = null;
  session.pendingBankruptcy = null;

  const bankruptPayload: S2C_PlayerBankrupt = {
    playerId,
    bankruptType: type,
    creditorId: creditorId ?? null,
  };
  broadcastToRoom(io, session.id, 'PLAYER_BANKRUPT', bankruptPayload);

  // Remove from player order
  session.playerOrder = session.playerOrder.filter(id => id !== playerId);

  logger.info({ roomId: session.id, playerId, type }, 'Bankruptcy resolved');

  // Check if game is over
  const winnerId = checkVictory(session);
  if (winnerId) {
    endGame(session, [winnerId], io);
    return;
  }

  // Advance to next turn
  StateMachine.transition(session, TurnPhase.TURN_TRANSITIONING);
}

// ─── Game over ────────────────────────────────────────────────────────────────

function endGame(session: GameSession, winnerIds: PlayerId[], io: Server): void {
  const { GameStatus } = require('../types/GameSession.types');
  session.status = GameStatus.FINISHED;
  session.finishedAt = Date.now();
  session.winnerIds = winnerIds;

  cancelAllTimers(session.id);

  const standings = session.playerOrder.map((pid, i) => ({ playerId: pid, rank: i + 1 }));
  broadcastToRoom(io, session.id, 'GAME_OVER', { winnerIds, standings });
  logger.info({ roomId: session.id, winnerIds }, 'Game over');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cancelDyingTimers(session: GameSession, playerId: PlayerId): void {
  cancelAllTimers(`${session.id}:${playerId}`);
}

/** Sum all convertible assets: cash + mortgage values of unbuilt properties. */
function liquidatableValue(session: GameSession, playerId: PlayerId): number {
  const player = requirePlayer(session, playerId);
  let total = player.cash;

  for (const tile of session.board) {
    if ('ownerId' in tile && tile.ownerId === playerId && 'mortgageValue' in tile) {
      if (!(tile as { isMortgaged: boolean }).isMortgaged) {
        total += (tile as { mortgageValue: number }).mortgageValue;
      }
    }
  }

  return total;
}
