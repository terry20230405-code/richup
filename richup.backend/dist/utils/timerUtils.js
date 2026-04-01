"use strict";
/**
 * Centralised timer management.
 *
 * All phase timers (auction rounds, dying rescue, AFK kick) are tracked here.
 * When a game ends or a player reconnects, timers can be bulk-cancelled.
 * This prevents "ghost timer" bugs where a timer fires after the game state
 * has already moved on.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimerNS = void 0;
exports.scheduleTimer = scheduleTimer;
exports.cancelTimer = cancelTimer;
exports.cancelAllTimers = cancelAllTimers;
exports.listActiveTimers = listActiveTimers;
/** Global registry: key = `${sessionId}:${timerId}` */
const timerRegistry = new Map();
/**
 * Schedule a one-shot callback and register it under a namespaced key.
 *
 * @param namespace  e.g. `${roomId}:auction` or `${roomId}:${playerId}:afk`
 * @param delayMs    Milliseconds until callback fires
 * @param callback   The function to invoke
 * @param description  Human-readable label for debugging
 * @returns The timer key (use to cancel)
 */
function scheduleTimer(namespace, delayMs, callback, description = '') {
    // Cancel any existing timer for the same namespace
    cancelTimer(namespace);
    const handle = setTimeout(() => {
        const record = timerRegistry.get(namespace);
        if (record)
            record.firedAt = Date.now();
        timerRegistry.delete(namespace);
        callback();
    }, delayMs);
    timerRegistry.set(namespace, { handle, description });
    return namespace;
}
/**
 * Cancel and remove a scheduled timer by its namespace key.
 * No-op if the timer doesn't exist or has already fired.
 */
function cancelTimer(namespace) {
    const record = timerRegistry.get(namespace);
    if (record && !record.firedAt) {
        clearTimeout(record.handle);
    }
    timerRegistry.delete(namespace);
}
/**
 * Cancel all timers whose namespace starts with the given prefix.
 * Useful for clearing all timers for a given session or player.
 *
 * @example cancelAllTimers('room-abc123')  // Clears all timers for that room
 */
function cancelAllTimers(prefix) {
    for (const [key] of timerRegistry) {
        if (key.startsWith(prefix)) {
            cancelTimer(key);
        }
    }
}
/** Returns all active timer namespaces (for debugging). */
function listActiveTimers() {
    return [...timerRegistry.keys()];
}
// ─── Namespace helpers ────────────────────────────────────────────────────────
exports.TimerNS = {
    auctionRound: (roomId) => `${roomId}:auction:round`,
    dyingRescue: (roomId, playerId) => `${roomId}:${playerId}:rescue`,
    dyingAfk: (roomId, playerId) => `${roomId}:${playerId}:afk`,
    reconnect: (roomId, playerId) => `${roomId}:${playerId}:reconnect`,
};
//# sourceMappingURL=timerUtils.js.map