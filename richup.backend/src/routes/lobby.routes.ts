/**
 * Lobby REST endpoints.
 *
 * GET  /api/v1/rooms          — list open rooms
 * POST /api/v1/rooms          — create a room (host)
 * POST /api/v1/rooms/:id/join — join a room
 * DELETE /api/v1/rooms/:id   — dissolve room (host only, Bearer token)
 */

import { Router } from 'express';
import type { Server } from 'socket.io';
import {
  createRoom,
  joinRoom,
  deleteRoom,
  getSession,
  listRooms,
  verifyToken,
} from '../state/RoomManager';
import { broadcastLobbyState, scheduleLobbyReservation } from '../modules/ConnectionLifecycle';
import { logger } from '../utils/logger';

export function createLobbyRouter(io: Server): Router {
const router = Router();

// GET /rooms
router.get('/rooms', (_req, res) => {
  res.json({ rooms: listRooms() });
});

// POST /rooms  body: { hostNickname: string }
router.post('/rooms', (req, res) => {
  const { hostNickname } = req.body as { hostNickname?: string };
  if (!hostNickname || typeof hostNickname !== 'string' || !hostNickname.trim()) {
    res.status(400).json({ error: 'hostNickname is required' });
    return;
  }
  try {
    const result = createRoom(hostNickname.trim());
    const session = getSession(result.roomId);
    if (session) {
      scheduleLobbyReservation(session, result.playerId, io);
      broadcastLobbyState(session, io);
    }
    res.status(201).json(result);
  } catch (err) {
    logger.error(err, 'createRoom failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /rooms/:id/join  body: { nickname: string }
router.post('/rooms/:id/join', (req, res) => {
  const { nickname } = req.body as { nickname?: string };
  if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
    res.status(400).json({ error: 'nickname is required' });
    return;
  }
  try {
    const result = joinRoom(req.params['id']!, nickname.trim());
    const session = getSession(req.params['id']!);
    if (session) {
      scheduleLobbyReservation(session, result.playerId, io);
      broadcastLobbyState(session, io);
    }
    res.status(200).json({ roomId: req.params['id'], ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('not found')) {
      res.status(404).json({ error: msg });
    } else if (msg.includes('full') || msg.includes('started')) {
      res.status(409).json({ error: msg });
    } else {
      res.status(500).json({ error: msg });
    }
  }
});

// DELETE /rooms/:id  Authorization: Bearer <sessionToken>
router.delete('/rooms/:id', (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  try {
    const payload = verifyToken(auth.slice(7));
    if (payload.roomId !== req.params['id']) {
      res.status(403).json({ error: 'Token not valid for this room' });
      return;
    }
    deleteRoom(payload.roomId, payload.playerId);
    res.status(204).send();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('not found')) {
      res.status(404).json({ error: msg });
    } else if (msg.includes('host')) {
      res.status(403).json({ error: msg });
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
});

return router;
}
