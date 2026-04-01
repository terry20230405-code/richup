"use strict";
/**
 * Movement engine.
 *
 * Handles player movement around the board, GO crossing detection,
 * and landing position resolution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.movePlayer = movePlayer;
exports.teleportPlayer = teleportPlayer;
exports.getTileAt = getTileAt;
exports.getPlayerTile = getPlayerTile;
exports.needsTileEvent = needsTileEvent;
const Tile_types_1 = require("../types/Tile.types");
const GameConfig_1 = require("../config/GameConfig");
const GameSession_1 = require("../state/GameSession");
const broadcast_1 = require("../socket/emitters/broadcast");
const logger_1 = require("../utils/logger");
const BOARD_SIZE = GameConfig_1.BOARD_CONFIG.TOTAL_TILES;
const GO_POSITION = GameConfig_1.BOARD_CONFIG.FIXED_ANCHORS.GO;
/**
 * Move a player by `steps` positions around the board.
 * Handles GO crossing, GO landing bonus, and emits PLAYER_MOVED.
 */
function movePlayer(session, playerId, steps, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    const fromPosition = player.position;
    const rawNext = (fromPosition + steps) % BOARD_SIZE;
    // Detect GO crossing (wrapping around position 0)
    const passedGo = rawNext < fromPosition && fromPosition + steps >= BOARD_SIZE;
    const landedOnGo = rawNext === GO_POSITION;
    player.previousPosition = fromPosition;
    player.position = rawNext;
    const movedPayload = {
        playerId,
        fromPosition,
        toPosition: rawNext,
        passedGo: passedGo || landedOnGo,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLAYER_MOVED', movedPayload);
    // Award GO bonuses
    if (landedOnGo) {
        // Exactly landed on GO: pass bonus + land bonus
        const passBonusAmount = session.config.goSalary;
        const landBonusAmount = session.config.goLandBonus;
        (0, GameSession_1.cashChange)(session, playerId, passBonusAmount + landBonusAmount, 'GO_LAND', io);
        const startLandedPayload = { playerId, passBonusAmount, landBonusAmount };
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'START_LANDED', startLandedPayload);
    }
    else if (passedGo) {
        // Passed over GO: only pass salary
        const bonusAmount = session.config.goSalary;
        (0, GameSession_1.cashChange)(session, playerId, bonusAmount, 'GO_PASS', io);
        const startPassedPayload = { playerId, bonusAmount };
        (0, broadcast_1.broadcastToRoom)(io, session.id, 'START_PASSED', startPassedPayload);
    }
    const landedTile = session.board[rawNext];
    logger_1.logger.debug({ roomId: session.id, playerId, fromPosition, toPosition: rawNext, passedGo, landedOnGo }, 'Player moved');
    return { newPosition: rawNext, passedGo: passedGo || landedOnGo, landedOnGo, landedTile };
}
/**
 * Teleport a player directly to a position without awarding GO salary.
 * Used for Go-to-Jail and card effects.
 */
function teleportPlayer(session, playerId, targetPosition, io) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    player.previousPosition = player.position;
    player.position = targetPosition;
    const movedPayload = {
        playerId,
        fromPosition: player.previousPosition,
        toPosition: targetPosition,
        passedGo: false,
    };
    (0, broadcast_1.broadcastToRoom)(io, session.id, 'PLAYER_MOVED', movedPayload);
    return session.board[targetPosition];
}
/** Returns the Tile at the given position. */
function getTileAt(session, position) {
    const tile = session.board[position];
    if (!tile)
        throw new Error(`No tile at position ${position}`);
    return tile;
}
/** Returns the player's current tile. */
function getPlayerTile(session, playerId) {
    const player = (0, GameSession_1.requirePlayer)(session, playerId);
    return getTileAt(session, player.position);
}
/** Check if this tile type triggers an EVENT_TRIGGER phase. */
function needsTileEvent(tile) {
    return [
        Tile_types_1.TileType.PROPERTY,
        Tile_types_1.TileType.AIRPORT,
        Tile_types_1.TileType.TEMPLE,
        Tile_types_1.TileType.CASINO,
        Tile_types_1.TileType.TAX,
        Tile_types_1.TileType.SURPRISE,
        Tile_types_1.TileType.JAIL,
    ].includes(tile.type);
}
//# sourceMappingURL=MovementEngine.js.map