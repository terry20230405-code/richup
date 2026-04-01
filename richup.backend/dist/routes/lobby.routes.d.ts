/**
 * Lobby REST endpoints.
 *
 * GET  /api/v1/rooms          — list open rooms
 * POST /api/v1/rooms          — create a room (host)
 * POST /api/v1/rooms/:id/join — join a room
 * DELETE /api/v1/rooms/:id   — dissolve room (host only, Bearer token)
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=lobby.routes.d.ts.map