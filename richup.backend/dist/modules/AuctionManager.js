"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAuction = startAuction;
exports.placeBid = placeBid;
exports.passAuction = passAuction;
exports.resolveAuction = resolveAuction;
exports.assertNotBidLocked = assertNotBidLocked;
const uuid_1 = require("uuid");
const GameSession_types_1 = require("../types/GameSession.types");
const Auction_types_1 = require("../types/Auction.types");
const GameSession_1 = require("../state/GameSession");
const StateMachine_1 = require("../state/StateMachine");
const broadcast_1 = require("../socket/emitters/broadcast");
const direct_1 = require("../socket/emitters/direct");
const timerUtils_1 = require("../utils/timerUtils");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
// ─── Start auction ────────────────────────────────────────────────────────────
/**
 * Begin an auction for the given tile.
 * All non-bankrupt players are active participants.
 */
function startAuction(session, tileId, io) {
    if (session.activeAuction) {
        throw new errors_1.RuleViolationError('An auction is already in progress');
    }
    const activePlayerIds = [...session.players.values()].filter(p => p.status === 'ACTIVE' || p.status === 'DISCONNECTED');
    const auction = {
        id: (0, uuid_1.v4)(),
        tileId,
        status: Auction_types_1.AuctionStatus.OPEN,
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
    StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.AUCTION_IN_PROGRESS);
    const tile = session.board[tileId];
    const payload = {
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
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'AUCTION_STARTED', payload);
    // Schedule the round timer
    scheduleRoundTimer(session, io);
    logger_1.logger.info({ roomId: session.id, auctionId: auction.id, tileId }, 'Auction started');
}
// ─── Place bid ────────────────────────────────────────────────────────────────
function placeBid(session, bidderId, amount, io) {
    const auction = requireActiveAuction(session);
    const player = (0, GameSession_1.requirePlayer)(session, bidderId);
    if (!auction.activePlayerIds.includes(bidderId)) {
        (0, direct_1.emitToPlayer)(io, bidderId, 'AUCTION_BID_REJECTED', {
            reason: 'AUCTION_CLOSED',
        });
        return;
    }
    if (amount <= auction.currentBid) {
        (0, direct_1.emitToPlayer)(io, bidderId, 'AUCTION_BID_REJECTED', {
            reason: 'BID_NOT_HIGHER',
            currentBid: auction.currentBid,
        });
        return;
    }
    if (player.cash < amount) {
        (0, direct_1.emitToPlayer)(io, bidderId, 'AUCTION_BID_REJECTED', {
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
    auction.lockedBid = amount; // Freeze leader's bid
    auction.roundDeadlineAt = Date.now() + session.config.auctionRoundMs;
    auction.bidHistory.push({
        bidderId,
        amount,
        placedAt: Date.now(),
    });
    // Reset round timer
    (0, timerUtils_1.cancelTimer)(timerUtils_1.TimerNS.auctionRound(session.id));
    scheduleRoundTimer(session, io);
    const payload = {
        auctionId: auction.id,
        bidderId,
        bidAmount: amount,
        currentLeaderId: bidderId,
        roundDeadlineAt: auction.roundDeadlineAt,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'AUCTION_BID_PLACED', payload);
    logger_1.logger.debug({ roomId: session.id, bidderId, amount }, 'Bid placed');
}
// ─── Pass ─────────────────────────────────────────────────────────────────────
function passAuction(session, bidderId, io) {
    const auction = requireActiveAuction(session);
    if (!auction.activePlayerIds.includes(bidderId))
        return;
    auction.activePlayerIds = auction.activePlayerIds.filter(id => id !== bidderId);
    auction.passedPlayerIds.push(bidderId);
    const payload = {
        auctionId: auction.id,
        passedPlayerId: bidderId,
        remainingActiveCount: auction.activePlayerIds.length,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'AUCTION_PLAYER_PASSED', payload);
    // Check resolution: ≤1 active player remaining
    const remaining = auction.activePlayerIds.length;
    if (remaining <= 1) {
        // Cancel timer and resolve immediately
        (0, timerUtils_1.cancelTimer)(timerUtils_1.TimerNS.auctionRound(session.id));
        resolveAuction(session, io);
    }
}
// ─── Resolution ──────────────────────────────────────────────────────────────
/** Called by the round timer OR when only 1 active player remains. */
function resolveAuction(session, io) {
    const auction = requireActiveAuction(session);
    (0, timerUtils_1.cancelTimer)(timerUtils_1.TimerNS.auctionRound(session.id));
    auction.status = Auction_types_1.AuctionStatus.RESOLVED;
    auction.lockedBid = 0;
    if (auction.currentLeaderId && auction.currentBid > 0) {
        // Hammer down — winner pays
        const winner = session.players.get(auction.currentLeaderId);
        if (winner) {
            (0, GameSession_1.cashChange)(session, winner.id, -auction.currentBid, 'AUCTION_WIN', io);
            // Transfer tile ownership
            const tile = session.board[auction.tileId];
            if (tile && 'ownerId' in tile) {
                tile.ownerId = winner.id;
            }
        }
        const payload = {
            auctionId: auction.id,
            winnerId: auction.currentLeaderId,
            finalPrice: auction.currentBid,
            tileId: auction.tileId,
        };
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'AUCTION_HAMMER_DOWN', payload);
        logger_1.logger.info({ roomId: session.id, winnerId: auction.currentLeaderId, price: auction.currentBid }, 'Auction hammer down');
    }
    else if (auction.currentLeaderId && auction.currentBid === 0) {
        // Won at 0 — free transfer
        const tile = session.board[auction.tileId];
        if (tile && 'ownerId' in tile) {
            tile.ownerId = auction.currentLeaderId;
        }
        const payload = {
            auctionId: auction.id,
            winnerId: auction.currentLeaderId,
            finalPrice: 0,
            tileId: auction.tileId,
        };
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'AUCTION_HAMMER_DOWN', payload);
    }
    else {
        // No sale
        const payload = { auctionId: auction.id, tileId: auction.tileId };
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'AUCTION_NO_SALE', payload);
        logger_1.logger.info({ roomId: session.id }, 'Auction no sale');
    }
    session.activeAuction = null;
    StateMachine_1.StateMachine.transition(session, GameSession_types_1.TurnPhase.END_TURN_PENDING);
}
// ─── Bid-lock check ───────────────────────────────────────────────────────────
/**
 * Throws BidLockedError if the player has a locked bid that would be
 * insufficient after the requested cash deduction.
 */
function assertNotBidLocked(session, playerId, amountToSpend) {
    const auction = session.activeAuction;
    if (!auction)
        return;
    if (auction.currentLeaderId !== playerId)
        return;
    if (auction.lockedBid <= 0)
        return;
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    if (player.cash - amountToSpend < auction.lockedBid) {
        throw new errors_1.BidLockedError(auction.lockedBid);
    }
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function requireActiveAuction(session) {
    if (!session.activeAuction)
        throw new errors_1.RuleViolationError('No active auction');
    return session.activeAuction;
}
function scheduleRoundTimer(session, io) {
    (0, timerUtils_1.scheduleTimer)(timerUtils_1.TimerNS.auctionRound(session.id), session.config.auctionRoundMs, () => {
        const current = session.activeAuction;
        if (current && current.status === Auction_types_1.AuctionStatus.OPEN) {
            resolveAuction(session, io);
        }
    }, `Auction round timer for room ${session.id}`);
}
//# sourceMappingURL=AuctionManager.js.map