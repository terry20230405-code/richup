/**
 * Centralised timer management.
 *
 * All phase timers (auction rounds, dying rescue, AFK kick) are tracked here.
 * When a game ends or a player reconnects, timers can be bulk-cancelled.
 * This prevents "ghost timer" bugs where a timer fires after the game state
 * has already moved on.
 */
export type TimerHandle = ReturnType<typeof setTimeout>;
/**
 * Schedule a one-shot callback and register it under a namespaced key.
 *
 * @param namespace  e.g. `${roomId}:auction` or `${roomId}:${playerId}:afk`
 * @param delayMs    Milliseconds until callback fires
 * @param callback   The function to invoke
 * @param description  Human-readable label for debugging
 * @returns The timer key (use to cancel)
 */
export declare function scheduleTimer(namespace: string, delayMs: number, callback: () => void, description?: string): string;
/**
 * Cancel and remove a scheduled timer by its namespace key.
 * No-op if the timer doesn't exist or has already fired.
 */
export declare function cancelTimer(namespace: string): void;
/**
 * Cancel all timers whose namespace starts with the given prefix.
 * Useful for clearing all timers for a given session or player.
 *
 * @example cancelAllTimers('room-abc123')  // Clears all timers for that room
 */
export declare function cancelAllTimers(prefix: string): void;
/** Returns all active timer namespaces (for debugging). */
export declare function listActiveTimers(): string[];
export declare const TimerNS: {
    auctionRound: (roomId: string) => string;
    dyingRescue: (roomId: string, playerId: string) => string;
    dyingAfk: (roomId: string, playerId: string) => string;
    lobbyReconnect: (roomId: string, playerId: string) => string;
    reconnect: (roomId: string, playerId: string) => string;
};
//# sourceMappingURL=timerUtils.d.ts.map