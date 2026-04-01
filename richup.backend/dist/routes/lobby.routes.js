"use strict";
/**
 * Lobby REST endpoints.
 *
 * GET  /api/v1/rooms          — list open rooms
 * POST /api/v1/rooms          — create a room (host)
 * POST /api/v1/rooms/:id/join — join a room
 * DELETE /api/v1/rooms/:id   — dissolve room (host only, Bearer token)
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const RoomManager_1 = require("../state/RoomManager");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// GET /rooms
router.get('/rooms', (_req, res) => {
    res.json({ rooms: (0, RoomManager_1.listRooms)() });
});
// POST /rooms  body: { hostNickname: string }
router.post('/rooms', (req, res) => {
    const { hostNickname } = req.body;
    if (!hostNickname || typeof hostNickname !== 'string' || !hostNickname.trim()) {
        res.status(400).json({ error: 'hostNickname is required' });
        return;
    }
    try {
        const result = (0, RoomManager_1.createRoom)(hostNickname.trim());
        res.status(201).json(result);
    }
    catch (err) {
        logger_1.logger.error(err, 'createRoom failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /rooms/:id/join  body: { nickname: string }
router.post('/rooms/:id/join', (req, res) => {
    const { nickname } = req.body;
    if (!nickname || typeof nickname !== 'string' || !nickname.trim()) {
        res.status(400).json({ error: 'nickname is required' });
        return;
    }
    try {
        const result = (0, RoomManager_1.joinRoom)(req.params['id'], nickname.trim());
        res.status(200).json({ roomId: req.params['id'], ...result });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('not found')) {
            res.status(404).json({ error: msg });
        }
        else if (msg.includes('full') || msg.includes('started')) {
            res.status(409).json({ error: msg });
        }
        else {
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
        const payload = (0, RoomManager_1.verifyToken)(auth.slice(7));
        if (payload.roomId !== req.params['id']) {
            res.status(403).json({ error: 'Token not valid for this room' });
            return;
        }
        (0, RoomManager_1.deleteRoom)(payload.roomId, payload.playerId);
        res.status(204).send();
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('not found')) {
            res.status(404).json({ error: msg });
        }
        else if (msg.includes('host')) {
            res.status(403).json({ error: msg });
        }
        else {
            res.status(401).json({ error: 'Invalid token' });
        }
    }
});
exports.default = router;
//# sourceMappingURL=lobby.routes.js.map