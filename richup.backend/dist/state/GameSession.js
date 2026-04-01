"use strict";
/**
 * GameSession lifecycle helpers.
 *
 * - startGame()     transitions a LOBBY session to IN_PROGRESS
 * - cashChange()    the single authoritative cash mutation + CASH_UPDATED emit
 * - getActivePlayers() / getCurrentPlayer() convenience queries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGame = startGame;
exports.cashChange = cashChange;
exports.requirePlayer = requirePlayer;
exports.getCurrentPlayer = getCurrentPlayer;
exports.getCurrentPlayerId = getCurrentPlayerId;
exports.getActivePlayers = getActivePlayers;
exports.advanceTurn = advanceTurn;
exports.checkVictory = checkVictory;
exports.getOwnedTileIds = getOwnedTileIds;
const GameSession_types_1 = require("../types/GameSession.types");
const Player_types_1 = require("../types/Player.types");
const MapGenerator_1 = require("../modules/MapGenerator");
const SurpriseHandler_1 = require("../modules/SurpriseHandler");
const StateMachine_1 = require("./StateMachine");
const direct_1 = require("../socket/emitters/direct");
const randomUtils_1 = require("../utils/randomUtils");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
// ─── Start game ──────────────────────────────────────────────────────────────
/**
 * Transition a LOBBY session to IN_PROGRESS.
 * Generates the board, shuffles player order, deals starting cash.
 * Call this when the host clicks "Start Game".
 */
function startGame(session) {
    if (session.status !== GameSession_types_1.GameStatus.LOBBY) {
        throw new errors_1.RuleViolationError('Game is not in LOBBY status');
    }
    if (session.players.size < 2) {
        throw new errors_1.RuleViolationError('Need at least 2 players to start');
    }
    // Generate board
    session.board = (0, MapGenerator_1.generateBoard)();
    // Randomize player order
    const playerIds = [...session.players.keys()];
    session.playerOrder = (0, randomUtils_1.fisherYatesShuffle)(playerIds);
    session.currentPlayerIndex = 0;
    // Initialize surprise deck
    session.surpriseDeck = (0, SurpriseHandler_1.initSurpriseDeck)();
    session.surpriseDiscardPile = [];
    // Mark game started
    session.status = GameSession_types_1.GameStatus.IN_PROGRESS;
    session.startedAt = Date.now();
    session.turnNumber = 1;
    session.roundNumber = 1;
    // Set initial phase
    StateMachine_1.StateMachine.forcePhase(session, GameSession_types_1.TurnPhase.WAITING_FOR_ACTION);
    logger_1.logger.info({ roomId: session.id, playerOrder: session.playerOrder }, 'Game started');
}
// ─── Cash mutation ────────────────────────────────────────────────────────────
/**
 * The single authoritative function for changing a player's cash.
 * Always emits CASH_UPDATED directed to the player only.
 *
 * @param delta Positive = gain, negative = loss.
 * @returns The player's new cash balance.
 */
function cashChange(session, playerId, delta, reason, io) {
    const player = requirePlayer(session, playerId);
    player.cash += delta;
    const payload = {
        newBalance: player.cash,
        delta,
        reason,
    };
    (0, direct_1.emitToPlayer)(io, playerId, 'CASH_UPDATED', payload);
    logger_1.logger.debug({ roomId: session.id, playerId, delta, newBalance: player.cash, reason }, 'Cash changed');
    return player.cash;
}
// ─── Player queries ───────────────────────────────────────────────────────────
function requirePlayer(session, playerId) {
    const p = session.players.get(playerId);
    if (!p)
        throw new errors_1.NotFoundError('Player', playerId);
    return p;
}
function getCurrentPlayer(session) {
    const playerId = session.playerOrder[session.currentPlayerIndex];
    if (!playerId)
        throw new errors_1.RuleViolationError('No current player (empty player order)');
    return requirePlayer(session, playerId);
}
function getCurrentPlayerId(session) {
    const playerId = session.playerOrder[session.currentPlayerIndex];
    if (!playerId)
        throw new errors_1.RuleViolationError('No current player');
    return playerId;
}
/** Active players = not bankrupt */
function getActivePlayers(session) {
    return session.playerOrder
        .map(id => session.players.get(id))
        .filter((p) => p !== undefined && p.status !== Player_types_1.PlayerStatus.BANKRUPT);
}
/**
 * Advance to the next player's turn.
 * Skips bankrupt/disconnected players.
 * Updates turnNumber and roundNumber.
 */
function advanceTurn(session) {
    const total = session.playerOrder.length;
    if (total === 0)
        return;
    const prevIndex = session.currentPlayerIndex;
    let next = (prevIndex + 1) % total;
    let looped = 0;
    // Skip bankrupt players
    while (looped < total) {
        const pid = session.playerOrder[next];
        const p = pid ? session.players.get(pid) : undefined;
        if (p && p.status !== Player_types_1.PlayerStatus.BANKRUPT)
            break;
        next = (next + 1) % total;
        looped++;
    }
    if (next <= prevIndex) {
        // Completed a full round
        session.roundNumber++;
    }
    session.currentPlayerIndex = next;
    session.turnNumber++;
    session.lastDiceRoll = null;
    session.pendingTileEvent = null;
}
// ─── Victory check ────────────────────────────────────────────────────────────
/**
 * Returns the winner's PlayerId if only one active player remains, else null.
 */
function checkVictory(session) {
    const active = getActivePlayers(session);
    if (active.length === 1)
        return active[0].id;
    return null;
}
// ─── Owned tiles helper ───────────────────────────────────────────────────────
/** Returns all TileIds owned by the given player. */
function getOwnedTileIds(session, playerId) {
    const owned = [];
    for (const tile of session.board) {
        if ('ownerId' in tile && tile.ownerId === playerId) {
            owned.push(tile.id);
        }
    }
    return owned;
}
//# sourceMappingURL=GameSession.js.map