/**
 * Server entry point.
 * Creates Express app + Socket.io server and registers all routes/events.
 */

import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import healthRouter from './routes/health.routes';
import { createLobbyRouter } from './routes/lobby.routes';
import { registerSocketEvents } from './socket/SocketEventRouter';
import {
  getSession,
  registerSocket,
  verifyToken,
} from './state/RoomManager';
import { playerRoom } from './socket/emitters/direct';
import { logger } from './utils/logger';

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/v1', healthRouter);

// ─── HTTP + Socket.io server ──────────────────────────────────────────────────

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use('/api/v1', createLobbyRouter(io));

// ─── Socket.io connection handler ────────────────────────────────────────────

io.on('connection', (socket) => {
  const auth = socket.handshake.auth as {
    sessionToken?: string;
    roomId?: string;
    nickname?: string;
  };

  logger.debug({ socketId: socket.id, auth: { roomId: auth.roomId } }, 'Socket connected');

  // Attempt to attach to a room from handshake
  if (auth.sessionToken && auth.roomId) {
    // Reconnection path: validate JWT
    try {
      const payload = verifyToken(auth.sessionToken);
      if (payload.roomId === auth.roomId) {
        const session = getSession(payload.roomId);
        if (session && session.players.has(payload.playerId)) {
          registerSocket(socket.id, payload.playerId, payload.roomId);
          socket.join(payload.roomId);
          socket.join(playerRoom(payload.playerId));
          logger.info({ playerId: payload.playerId, roomId: payload.roomId }, 'Socket attached via JWT on connect');
        }
      }
    } catch {
      // JWT invalid — socket connected but not yet attached to a room.
      // Player must send action:RECONNECT explicitly.
    }
  }

  // Register all game event handlers
  registerSocketEvents(io, socket);
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000);
httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'Modern Tycoon server listening');
});

export { io };
