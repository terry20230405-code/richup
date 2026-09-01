"use strict";
/**
 * Server entry point.
 * Creates Express app + Socket.io server and registers all routes/events.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
require("dotenv/config");
const http_1 = __importDefault(require("http"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const lobby_routes_1 = require("./routes/lobby.routes");
const SocketEventRouter_1 = require("./socket/SocketEventRouter");
const RoomManager_1 = require("./state/RoomManager");
const direct_1 = require("./socket/emitters/direct");
const logger_1 = require("./utils/logger");
// ─── Express app ──────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/v1', health_routes_1.default);
// ─── HTTP + Socket.io server ──────────────────────────────────────────────────
const httpServer = http_1.default.createServer(app);
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: '*' },
});
exports.io = io;
app.use('/api/v1', (0, lobby_routes_1.createLobbyRouter)(io));
// ─── Socket.io connection handler ────────────────────────────────────────────
io.on('connection', (socket) => {
    const auth = socket.handshake.auth;
    logger_1.logger.debug({ socketId: socket.id, auth: { roomId: auth.roomId } }, 'Socket connected');
    // Attempt to attach to a room from handshake
    if (auth.sessionToken && auth.roomId) {
        // Reconnection path: validate JWT
        try {
            const payload = (0, RoomManager_1.verifyToken)(auth.sessionToken);
            if (payload.roomId === auth.roomId) {
                const session = (0, RoomManager_1.getSession)(payload.roomId);
                if (session && session.players.has(payload.playerId)) {
                    (0, RoomManager_1.registerSocket)(socket.id, payload.playerId, payload.roomId);
                    socket.join(payload.roomId);
                    socket.join((0, direct_1.playerRoom)(payload.playerId));
                    logger_1.logger.info({ playerId: payload.playerId, roomId: payload.roomId }, 'Socket attached via JWT on connect');
                }
            }
        }
        catch {
            // JWT invalid — socket connected but not yet attached to a room.
            // Player must send action:RECONNECT explicitly.
        }
    }
    // Register all game event handlers
    (0, SocketEventRouter_1.registerSocketEvents)(io, socket);
});
// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);
httpServer.listen(PORT, () => {
    logger_1.logger.info({ port: PORT }, 'Modern Tycoon server listening');
});
//# sourceMappingURL=index.js.map