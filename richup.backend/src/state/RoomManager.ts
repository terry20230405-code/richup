/**
 * In-memory room registry and JWT utilities.
 *
 * A "room" maps 1-to-1 with a GameSession (even in LOBBY status).
 * All session mutations happen in-place; no persistence layer.
 */

import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import type { RoomId, PlayerId } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
import { GameStatus, TurnPhase } from '../types/GameSession.types';
import { PlayerStatus } from '../types/Player.types';
import type { Player } from '../types/Player.types';
import { DEFAULT_GAME_CONFIG } from '../config/GameConfig';
import { logger } from '../utils/logger';

// ─── JWT ─────────────────────────────────────────────────────────────────────

export interface SessionTokenPayload {
  playerId: PlayerId;
  roomId: RoomId;
}

const DEV_JWT_SECRET = 'richup-local-dev-secret';

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    logger.warn('JWT_SECRET env var not set, falling back to local development secret');
    return DEV_JWT_SECRET;
  }
  return s;
}

export function issueToken(playerId: PlayerId, roomId: RoomId): string {
  return jwt.sign({ playerId, roomId } as SessionTokenPayload, jwtSecret(), { expiresIn: '24h' });
}

export function verifyToken(token: string): SessionTokenPayload {
  return jwt.verify(token, jwtSecret()) as SessionTokenPayload;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAYER_COLORS = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'];
const MAX_PLAYERS = 6;
const MIN_PLAYERS_TO_START = 2;

// ─── Storage ─────────────────────────────────────────────────────────────────

/** roomId → GameSession */
const sessions = new Map<RoomId, GameSession>();

/** socketId → { playerId, roomId } */
const socketContextMap = new Map<string, { playerId: PlayerId; roomId: RoomId }>();

// ─── Room CRUD ───────────────────────────────────────────────────────────────

export function createRoom(
  hostNickname: string,
): { roomId: RoomId; playerId: PlayerId; sessionToken: string } {
  const roomId = uuidv4();
  const playerId = uuidv4();
  const host = makePlayer(playerId, hostNickname, 0);

  const session: GameSession = {
    id: roomId,
    status: GameStatus.LOBBY,
    config: { ...DEFAULT_GAME_CONFIG },
    board: [],
    players: new Map([[playerId, host]]),
    playerOrder: [],
    currentPlayerIndex: 0,
    currentPhase: TurnPhase.WAITING_FOR_ACTION,
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
  logger.info({ roomId, playerId, hostNickname }, 'Room created');
  return { roomId, playerId, sessionToken: issueToken(playerId, roomId) };
}

export function joinRoom(
  roomId: RoomId,
  nickname: string,
): { playerId: PlayerId; sessionToken: string } {
  const session = requireSession(roomId);
  if (session.status !== GameStatus.LOBBY) throw new Error('Game has already started');
  if (session.players.size >= MAX_PLAYERS) throw new Error('Room is full');

  const playerId = uuidv4();
  const avatarIndex = session.players.size;
  session.players.set(playerId, makePlayer(playerId, nickname, avatarIndex));

  logger.info({ roomId, playerId, nickname }, 'Player joined room');
  return { playerId, sessionToken: issueToken(playerId, roomId) };
}

export function deleteRoom(roomId: RoomId, requesterId: PlayerId): void {
  const session = requireSession(roomId);
  if (session.hostId !== requesterId) throw new Error('Only the host can delete the room');
  sessions.delete(roomId);
  logger.info({ roomId }, 'Room deleted');
}

export function canStartGame(roomId: RoomId): { ok: boolean; reason?: string } {
  const session = sessions.get(roomId);
  if (!session) return { ok: false, reason: 'Room not found' };
  if (session.status !== GameStatus.LOBBY) return { ok: false, reason: 'Game already started' };
  if (session.players.size < MIN_PLAYERS_TO_START)
    return { ok: false, reason: `Need at least ${MIN_PLAYERS_TO_START} players` };
  return { ok: true };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function getSession(roomId: RoomId): GameSession | undefined {
  return sessions.get(roomId);
}

export function requireSession(roomId: RoomId): GameSession {
  const s = sessions.get(roomId);
  if (!s) throw new Error(`Room ${roomId} not found`);
  return s;
}

export function listRooms(): Array<{
  id: RoomId;
  playerCount: number;
  status: GameStatus;
  hostNickname: string;
  createdAt: number;
}> {
  return [...sessions.values()].map(s => ({
    id: s.id,
    playerCount: s.players.size,
    status: s.status,
    hostNickname: s.players.get(s.hostId)?.nickname ?? 'Unknown',
    createdAt: s.createdAt,
  }));
}

// ─── Socket context ───────────────────────────────────────────────────────────

export function registerSocket(socketId: string, playerId: PlayerId, roomId: RoomId): void {
  socketContextMap.set(socketId, { playerId, roomId });
}

export function unregisterSocket(socketId: string): { playerId: PlayerId; roomId: RoomId } | undefined {
  const entry = socketContextMap.get(socketId);
  socketContextMap.delete(socketId);
  return entry;
}

export function getSocketContext(socketId: string): { playerId: PlayerId; roomId: RoomId } | undefined {
  return socketContextMap.get(socketId);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePlayer(playerId: PlayerId, nickname: string, avatarIndex: number): Player {
  return {
    id: playerId,
    nickname,
    avatarIndex,
    color: PLAYER_COLORS[avatarIndex % PLAYER_COLORS.length] ?? '#888888',
    position: 0,
    previousPosition: 0,
    inJail: false,
    jailTurnsWaited: 0,
    status: PlayerStatus.ACTIVE,
    isConnected: true,
    lastSeenAt: Date.now(),
    cash: DEFAULT_GAME_CONFIG.startingCash,
    propCards: [],
    hasImmunity: false,
    priceHikeActive: false,
    priceHikeExpiresOnTurn: null,
    constructibleTileIds: [],
  };
}
