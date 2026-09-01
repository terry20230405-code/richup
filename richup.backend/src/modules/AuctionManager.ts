/**
 * Auction system — full lifecycle.
 *
 * Rules (per PRD):
 *  - 0-yuan starting bid, no minimum increment
 *  - Timer resets on each new bid (auctionRoundMs)
 *  - lockedBid: current leader's bid is frozen — blocks other cash operations
 *  - Pass → permanently exit this auction
 *  - When 1 active player remains → immediate hammer down (even at 0)
 *  - All active players pass → no sale
 */

import { v4 as uuidv4 } from 'uuid';
import type { Server } from 'socket.io';
import type { PlayerId, Money, TileId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { TurnPhase } from '../types/GameSession.types';
import type { AuctionSession } from '../types/Auction.types';
import { TileType } from '../types/Tile.types';
import { AuctionStatus } from '../types/Auction.types';
import type {
  S2C_AuctionStarted,
  S2C_AuctionBidPlaced,
  S2C_AuctionPlayerPassed,
  S2C_AuctionHammerDown,
  S2C_AuctionNoSale,
  S2C_AuctionBidRejected,
} from '../types/Events.types';
import { requirePlayer, cashChange } from '../state/GameSession';
import { StateMachine } from '../state/StateMachine';
import { broadcastToRoom } from '../socket/emitters/broadcast';
import { emitToPlayer } from '../socket/emitters/direct';
import { scheduleTimer, cancelTimer, TimerNS } from '../utils/timerUtils';
import { InsufficientFundsError, RuleViolationError, BidLockedError } from '../utils/errors';
import { logger } from '../utils/logger';

// ─── Start auction ────────────────────────────────────────────────────────────

/**
 * Begin an auction for the given tile.
 * All non-bankrupt players are active participants.
 */
export function startAuction(
  session: GameSession,
  tileId: TileId,
  io: Server,
): void {
  if (session.activeAuction) {
    throw new RuleViolationError('An auction is already in progress');
  }

  const tile = session.board[tileId];
  if (!tile || (tile.type !== TileType.PROPERTY && tile.type !== TileType.AIRPORT)) {
    throw new RuleViolationError('Only property and airport tiles can be auctioned');
  }
  if (!('ownerId' in tile) || tile.ownerId !== null) {
    throw new RuleViolationError('Only unowned tiles can be auctioned');
  }

  const activePlayerIds = [...session.players.values()].filter(
    p => p.status === 'ACTIVE' || p.status === 'DISCONNECTED',
  );

  const auction: AuctionSession = {
    id: uuidv4(),
    tileId,
    status: AuctionStatus.OPEN,
    currentBid: session.config.startingBid,
    currentLeaderId: null,
    lockedBid: 0,
    activePlayerIds: activePlayerIds.map(p => p.id),
    passedPlayerIds: [],
    bidHistory: [],
    winnerId: null,
    finalPrice: null,
    startedAt: Date.now(),
    roundDeadlineAt: Date.now() + session.config.auctionRoundMs,
    resolvedAt: null,
  };

  session.activeAuction = auction;
  StateMachine.transition(session, TurnPhase.AUCTION_IN_PROGRESS);

  const payload: S2C_AuctionStarted = {
    auction: {
      id: auction.id,
      tileId: auction.tileId,
      status: auction.status,
      currentBid: auction.currentBid,
      currentLeaderId: auction.currentLeaderId,
      activePlayerIds: auction.activePlayerIds,
      passedPlayerIds: auction.passedPlayerIds,
      winnerId: auction.winnerId,
      finalPrice: auction.finalPrice,
      roundDeadlineAt: auction.roundDeadlineAt,
    },
  };
  broadcastToRoom(io, session.id, 'AUCTION_STARTED', payload);

  // Schedule the round timer
  scheduleRoundTimer(session, io);

  logger.info({ roomId: session.id, auctionId: auction.id, tileId }, 'Auction started');
}

// ─── Place bid ────────────────────────────────────────────────────────────────

export function placeBid(
  session: GameSession,
  bidderId: PlayerId,
  amount: Money,
  io: Server,
): void {
  const auction = requireActiveAuction(session);
  const player = requirePlayer(session, bidderId);

  if (!auction.activePlayerIds.includes(bidderId)) {
    emitToPlayer(io, bidderId, 'AUCTION_BID_REJECTED', {
      reason: 'AUCTION_CLOSED',
    });
    return;
  }

  if (amount <= auction.currentBid) {
    emitToPlayer(io, bidderId, 'AUCTION_BID_REJECTED', {
      reason: 'BID_NOT_HIGHER',
      currentBid: auction.currentBid,
    });
    return;
  }

  if (player.cash < amount) {
    emitToPlayer(io, bidderId, 'AUCTION_BID_REJECTED', {
      reason: 'INSUFFICIENT_FUNDS',
      currentBid: auction.currentBid,
    });
    return;
  }

  // Release lock from previous leader
  if (auction.currentLeaderId) {
    auction.lockedBid = 0;
  }

  // Update auction state
  auction.currentBid = amount;
  auction.currentLeaderId = bidderId;
  auction.lockedBid = amount;     // Freeze leader's bid
  auction.roundDeadlineAt = Date.now() + session.config.auctionRoundMs;

  auction.bidHistory.push({
    bidderId,
    amount,
    placedAt: Date.now(),
  });

  // Reset round timer
  cancelTimer(TimerNS.auctionRound(session.id));
  scheduleRoundTimer(session, io);

  const payload: S2C_AuctionBidPlaced = {
    auctionId: auction.id,
    bidderId,
    bidAmount: amount,
    currentLeaderId: bidderId,
    roundDeadlineAt: auction.roundDeadlineAt,
  };
  broadcastToRoom(io, session.id, 'AUCTION_BID_PLACED', payload);

  logger.debug({ roomId: session.id, bidderId, amount }, 'Bid placed');
}

// ─── Pass ─────────────────────────────────────────────────────────────────────

export function passAuction(
  session: GameSession,
  bidderId: PlayerId,
  io: Server,
): void {
  const auction = requireActiveAuction(session);

  if (!auction.activePlayerIds.includes(bidderId)) return;

  auction.activePlayerIds = auction.activePlayerIds.filter(id => id !== bidderId);
  auction.passedPlayerIds.push(bidderId);

  if (auction.currentLeaderId === bidderId) {
    // A bidder cannot pass and remain the winner. Release the bid lock and
    // reset the auction so the remaining participants can bid again.
    auction.currentLeaderId = null;
    auction.currentBid = session.config.startingBid;
    auction.lockedBid = 0;
  }

  const payload: S2C_AuctionPlayerPassed = {
    auctionId: auction.id,
    passedPlayerId: bidderId,
    remainingActiveCount: auction.activePlayerIds.length,
    activePlayerIds: [...auction.activePlayerIds],
    passedPlayerIds: [...auction.passedPlayerIds],
    currentLeaderId: auction.currentLeaderId,
    currentBid: auction.currentBid,
  };
  broadcastToRoom(io, session.id, 'AUCTION_PLAYER_PASSED', payload);

  // Check resolution: ≤1 active player remaining
  const remaining = auction.activePlayerIds.length;
  if (remaining <= 1) {
    // Cancel timer and resolve immediately
    cancelTimer(TimerNS.auctionRound(session.id));
    resolveAuction(session, io);
  }
}

// ─── Resolution ──────────────────────────────────────────────────────────────

/** Called by the round timer OR when only 1 active player remains. */
export function resolveAuction(session: GameSession, io: Server): void {
  const auction = requireActiveAuction(session);
  cancelTimer(TimerNS.auctionRound(session.id));

  // If the current leader passed, the last remaining participant wins at the
  // current bid (which is reset to the configured starting bid by passAuction).
  // This also handles a zero-value hammer down instead of incorrectly treating
  // the auction as a no-sale.
  if (!auction.currentLeaderId && auction.activePlayerIds.length === 1) {
    auction.currentLeaderId = auction.activePlayerIds[0] ?? null;
    auction.currentBid = session.config.startingBid;
  }

  auction.status = AuctionStatus.RESOLVED;
  auction.lockedBid = 0;
  auction.winnerId = auction.currentLeaderId;
  auction.finalPrice = auction.currentLeaderId ? auction.currentBid : null;

  if (auction.currentLeaderId && auction.currentBid > 0) {
    // Hammer down — winner pays
    const winner = session.players.get(auction.currentLeaderId);
    if (winner) {
      cashChange(session, winner.id, -auction.currentBid as Money, 'AUCTION_WIN', io);

      // Transfer tile ownership
      const tile = session.board[auction.tileId];
      if (tile && 'ownerId' in tile) {
        (tile as { ownerId: PlayerId | null }).ownerId = winner.id;
      }
    }

    const payload: S2C_AuctionHammerDown = {
      auctionId: auction.id,
      winnerId: auction.currentLeaderId,
      finalPrice: auction.currentBid,
      tileId: auction.tileId,
    };
    broadcastToRoom(io, session.id, 'AUCTION_HAMMER_DOWN', payload);
    logger.info(
      { roomId: session.id, winnerId: auction.currentLeaderId, price: auction.currentBid },
      'Auction hammer down',
    );
  } else if (auction.currentLeaderId && auction.currentBid === 0) {
    // Won at 0 — free transfer
    const tile = session.board[auction.tileId];
    if (tile && 'ownerId' in tile) {
      (tile as { ownerId: PlayerId | null }).ownerId = auction.currentLeaderId;
    }

    const payload: S2C_AuctionHammerDown = {
      auctionId: auction.id,
      winnerId: auction.currentLeaderId,
      finalPrice: 0,
      tileId: auction.tileId,
    };
    broadcastToRoom(io, session.id, 'AUCTION_HAMMER_DOWN', payload);
  } else {
    // No sale
    auction.status = AuctionStatus.NO_SALE;
    auction.winnerId = null;
    auction.finalPrice = null;
    const payload: S2C_AuctionNoSale = { auctionId: auction.id, tileId: auction.tileId };
    broadcastToRoom(io, session.id, 'AUCTION_NO_SALE', payload);
    logger.info({ roomId: session.id }, 'Auction no sale');
  }

  session.activeAuction = null;
  session.pendingTileEvent = null;
  if (session.pendingExtraRoll) {
    session.pendingExtraRoll = false;
    StateMachine.transition(session, TurnPhase.WAITING_FOR_ACTION);
    broadcastToRoom(io, session.id, 'TURN_READY', {
      playerId: session.playerOrder[session.currentPlayerIndex],
      phase: TurnPhase.WAITING_FOR_ACTION,
      availableActions: ['ROLL_DICE'],
    });
  } else {
    StateMachine.transition(session, TurnPhase.END_TURN_PENDING);
    broadcastToRoom(io, session.id, 'TURN_READY', {
      playerId: session.playerOrder[session.currentPlayerIndex],
      phase: TurnPhase.END_TURN_PENDING,
      availableActions: ['END_TURN'],
    });
  }
}

// ─── Bid-lock check ───────────────────────────────────────────────────────────

/**
 * Throws BidLockedError if the player has a locked bid that would be
 * insufficient after the requested cash deduction.
 */
export function assertNotBidLocked(
  session: GameSession,
  playerId: PlayerId,
  amountToSpend: Money,
): void {
  const auction = session.activeAuction;
  if (!auction) return;
  if (auction.currentLeaderId !== playerId) return;
  if (auction.lockedBid <= 0) return;

  const player = requirePlayer(session, playerId);
  if (player.cash - amountToSpend < auction.lockedBid) {
    throw new BidLockedError(auction.lockedBid);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireActiveAuction(session: GameSession): AuctionSession {
  if (!session.activeAuction) throw new RuleViolationError('No active auction');
  return session.activeAuction;
}

function scheduleRoundTimer(session: GameSession, io: Server): void {
  scheduleTimer(
    TimerNS.auctionRound(session.id),
    session.config.auctionRoundMs,
    () => {
      const current = session.activeAuction;
      if (current && current.status === AuctionStatus.OPEN) {
        resolveAuction(session, io);
      }
    },
    `Auction round timer for room ${session.id}`,
  );
}
