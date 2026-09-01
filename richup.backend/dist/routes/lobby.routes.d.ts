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
export declare function createLobbyRouter(io: Server): Router;
//# sourceMappingURL=lobby.routes.d.ts.map