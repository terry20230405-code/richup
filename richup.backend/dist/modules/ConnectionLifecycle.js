"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastLobbyState = broadcastLobbyState;
exports.scheduleLobbyReservation = scheduleLobbyReservation;
exports.handleLastSocketDisconnect = handleLastSocketDisconnect;
const GameSession_types_1 = require("../types/GameSession.types");
const Player_types_1 = require("../types/Player.types");
const GameSession_1 = require("../state/GameSession");
const RoomManager_1 = require("../state/RoomManager");
const GameStateSerializer_1 = require("../serialization/GameStateSerializer");
const broadcast_1 = require("../socket/emitters/broadcast");
const timerUtils_1 = require("../utils/timerUtils");
const logger_1 = require("../utils/logger");
const BankruptcyResolver_1 = require("./BankruptcyResolver");
const TradeLifecycle_1 = require("./TradeLifecycle");
const Trade_types_1 = require("../types/Trade.types");
function broadcastLobbyState(session, io) {
    if (session.status !== GameSession_types_1.GameStatus.LOBBY)
        return;
    const payload = {
        hostId: session.hostId,
        players: (0, GameStateSerializer_1.serializePublicPlayers)(session),
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'LOBBY_STATE_UPDATED', payload);
}
function scheduleLobbyReservation(session, playerId, io) {
    (0, timerUtils_1.scheduleTimer)(timerUtils_1.TimerNS.lobbyReconnect(session.id, playerId), session.config.lobbyReconnectWindowMs, () => {
        const liveSession = (0, RoomManager_1.getSession)(session.id);
        if (!liveSession ||
            liveSession.status !== GameSession_types_1.GameStatus.LOBBY ||
            (0, RoomManager_1.hasConnectedSocket)(session.id, playerId)) {
            return;
        }
        const player = liveSession.players.get(playerId);
        if (!player || player.isConnected)
            return;
        const result = (0, RoomManager_1.removeLobbyPlayer)(session.id, playerId);
        if (result.removed && !result.roomDeleted) {
            broadcastLobbyState(liveSession, io);
        }
    }, `Lobby reservation for player ${playerId}`);
}
function handleLastSocketDisconnect(session, playerId, io) {
    const player = session.players.get(playerId);
    if (!player)
        return;
    const disconnectedAt = Date.now();
    player.isConnected = false;
    player.lastSeenAt = disconnectedAt;
    if (player.status === Player_types_1.PlayerStatus.ACTIVE) {
        player.status = Player_types_1.PlayerStatus.DISCONNECTED;
    }
    if (session.status === GameSession_types_1.GameStatus.LOBBY) {
        const disconnectedPayload = {
            playerId,
            afkWarningMs: session.config.lobbyReconnectWindowMs,
            status: player.status,
        };
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLAYER_DISCONNECTED', disconnectedPayload);
        broadcastLobbyState(session, io);
        scheduleLobbyReservation(session, playerId, io);
        logger_1.logger.info({ roomId: session.id, playerId }, 'Lobby player disconnected');
        return;
    }
    if (session.status !== GameSession_types_1.GameStatus.IN_PROGRESS && session.status !== GameSession_types_1.GameStatus.PAUSED)
        return;
    const disconnectedPayload = {
        playerId,
        afkWarningMs: session.config.reconnectWindowMs,
        status: player.status,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLAYER_DISCONNECTED', disconnectedPayload);
    // Bankrupt spectators may disconnect without entering whale-fall again.
    if (player.status === Player_types_1.PlayerStatus.BANKRUPT)
        return;
    (0, TradeLifecycle_1.voidTradesInvolvingPlayer)(session, playerId, Trade_types_1.TradeVoidReason.PLAYER_DISCONNECTED, io);
    const isCurrentPlayer = (0, GameSession_1.getCurrentPlayerId)(session) === playerId;
    if (isCurrentPlayer && session.status === GameSession_types_1.GameStatus.IN_PROGRESS) {
        session.status = GameSession_types_1.GameStatus.PAUSED;
        session.pausedAt = disconnectedAt;
        session.disconnectedCurrentPlayerId = playerId;
        const pausePayload = {
            disconnectedPlayerId: playerId,
            reconnectWindowSeconds: Math.ceil(session.config.reconnectWindowMs / 1000),
            reconnectDeadlineAt: disconnectedAt + session.config.reconnectWindowMs,
        };
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'GAME_PAUSED', pausePayload);
    }
    (0, timerUtils_1.scheduleTimer)(timerUtils_1.TimerNS.reconnect(session.id, playerId), Math.max(0, disconnectedAt + session.config.reconnectWindowMs - Date.now()), () => {
        const livePlayer = session.players.get(playerId);
        if (livePlayer &&
            !livePlayer.isConnected &&
            livePlayer.status !== Player_types_1.PlayerStatus.BANKRUPT &&
            session.status !== GameSession_types_1.GameStatus.FINISHED &&
            session.status !== GameSession_types_1.GameStatus.LOBBY) {
            (0, BankruptcyResolver_1.triggerWhaleFall)(session, playerId, 'DISCONNECT_TIMEOUT', io);
        }
    }, `Reconnect timer for player ${playerId}`);
    logger_1.logger.info({ roomId: session.id, playerId, isCurrentPlayer }, 'Player disconnected');
}
//# sourceMappingURL=ConnectionLifecycle.js.map