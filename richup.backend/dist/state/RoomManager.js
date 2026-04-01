"use strict";
/**
 * In-memory room registry and JWT utilities.
 *
 * A "room" maps 1-to-1 with a GameSession (even in LOBBY status).
 * All session mutations happen in-place; no persistence layer.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueToken = issueToken;
exports.verifyToken = verifyToken;
exports.createRoom = createRoom;
exports.joinRoom = joinRoom;
exports.deleteRoom = deleteRoom;
exports.canStartGame = canStartGame;
exports.getSession = getSession;
exports.requireSession = requireSession;
exports.listRooms = listRooms;
exports.registerSocket = registerSocket;
exports.unregisterSocket = unregisterSocket;
exports.getSocketContext = getSocketContext;
const uuid_1 = require("uuid");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const GameSession_types_1 = require("../types/GameSession.types");
const Player_types_1 = require("../types/Player.types");
const GameConfig_1 = require("../config/GameConfig");
const logger_1 = require("../utils/logger");
const DEV_JWT_SECRET = 'richup-local-dev-secret';
function jwtSecret() {
    const s = process.env.JWT_SECRET;
    if (!s) {
        logger_1.logger.warn('JWT_SECRET env var not set, falling back to local development secret');
        return DEV_JWT_SECRET;
    }
    return s;
}
function issueToken(playerId, roomId) {
    return jsonwebtoken_1.default.sign({ playerId, roomId }, jwtSecret(), { expiresIn: '24h' });
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, jwtSecret());
}
// ─── Constants ───────────────────────────────────────────────────────────────
const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'];
const MAX_PLAYERS = 6;
const MIN_PLAYERS_TO_START = 2;
// ─── Storage ─────────────────────────────────────────────────────────────────
/** roomId → GameSession */
const sessions = new Map();
/** socketId → { playerId, roomId } */
const socketContextMap = new Map();
// ─── Room CRUD ───────────────────────────────────────────────────────────────
function createRoom(hostNickname) {
    const roomId = (0, uuid_1.v4)();
    const playerId = (0, uuid_1.v4)();
    const host = makePlayer(playerId, hostNickname, 0);
    const session = {
        id: roomId,
        status: GameSession_types_1.GameStatus.LOBBY,
        config: { ...GameConfig_1.DEFAULT_GAME_CONFIG },
        board: [],
        players: new Map([[playerId, host]]),
        playerOrder: [],
        currentPlayerIndex: 0,
        currentPhase: GameSession_types_1.TurnPhase.WAITING_FOR_ACTION,
        phaseEnteredAt: Date.now(),
        turnNumber: 0,
        roundNumber: 0,
        lastDiceRoll: null,
        pendingTileEvent: null,
        activeAuction: null,
        activeTrades: new Map(),
        surpriseDeck: [],
        surpriseDiscardPile: [],
        dyingRescue: null,
        pendingBankruptcy: null,
        hostId: playerId,
        createdAt: Date.now(),
        startedAt: null,
        finishedAt: null,
        winnerIds: [],
        pausedAt: null,
        disconnectedCurrentPlayerId: null,
    };
    sessions.set(roomId, session);
    logger_1.logger.info({ roomId, playerId, hostNickname }, 'Room created');
    return { roomId, playerId, sessionToken: issueToken(playerId, roomId) };
}
function joinRoom(roomId, nickname) {
    const session = requireSession(roomId);
    if (session.status !== GameSession_types_1.GameStatus.LOBBY)
        throw new Error('Game has already started');
    if (session.players.size >= MAX_PLAYERS)
        throw new Error('Room is full');
    const playerId = (0, uuid_1.v4)();
    const avatarIndex = session.players.size;
    session.players.set(playerId, makePlayer(playerId, nickname, avatarIndex));
    logger_1.logger.info({ roomId, playerId, nickname }, 'Player joined room');
    return { playerId, sessionToken: issueToken(playerId, roomId) };
}
function deleteRoom(roomId, requesterId) {
    const session = requireSession(roomId);
    if (session.hostId !== requesterId)
        throw new Error('Only the host can delete the room');
    sessions.delete(roomId);
    logger_1.logger.info({ roomId }, 'Room deleted');
}
function canStartGame(roomId) {
    const session = sessions.get(roomId);
    if (!session)
        return { ok: false, reason: 'Room not found' };
    if (session.status !== GameSession_types_1.GameStatus.LOBBY)
        return { ok: false, reason: 'Game already started' };
    if (session.players.size < MIN_PLAYERS_TO_START)
        return { ok: false, reason: `Need at least ${MIN_PLAYERS_TO_START} players` };
    return { ok: true };
}
// ─── Queries ─────────────────────────────────────────────────────────────────
function getSession(roomId) {
    return sessions.get(roomId);
}
function requireSession(roomId) {
    const s = sessions.get(roomId);
    if (!s)
        throw new Error(`Room ${roomId} not found`);
    return s;
}
function listRooms() {
    return [...sessions.values()].map(s => ({
        id: s.id,
        playerCount: s.players.size,
        status: s.status,
        hostNickname: s.players.get(s.hostId)?.nickname ?? 'Unknown',
        createdAt: s.createdAt,
    }));
}
// ─── Socket context ───────────────────────────────────────────────────────────
function registerSocket(socketId, playerId, roomId) {
    socketContextMap.set(socketId, { playerId, roomId });
}
function unregisterSocket(socketId) {
    const entry = socketContextMap.get(socketId);
    socketContextMap.delete(socketId);
    return entry;
}
function getSocketContext(socketId) {
    return socketContextMap.get(socketId);
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
function makePlayer(playerId, nickname, avatarIndex) {
    return {
        id: playerId,
        nickname,
        avatarIndex,
        color: PLAYER_COLORS[avatarIndex % PLAYER_COLORS.length] ?? '#888888',
        position: 0,
        previousPosition: 0,
        inJail: false,
        jailTurnsWaited: 0,
        status: Player_types_1.PlayerStatus.ACTIVE,
        isConnected: true,
        lastSeenAt: Date.now(),
        cash: GameConfig_1.DEFAULT_GAME_CONFIG.startingCash,
        propCards: [],
        hasImmunity: false,
        priceHikeActive: false,
        priceHikeExpiresOnTurn: null,
        constructibleTileIds: [],
    };
}
//# sourceMappingURL=RoomManager.js.map