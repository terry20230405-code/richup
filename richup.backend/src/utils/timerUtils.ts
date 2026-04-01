/**
 * Centralised timer management.
 *
 * All phase timers (auction rounds, dying rescue, AFK kick) are tracked here.
 * When a game ends or a player reconnects, timers can be bulk-cancelled.
 * This prevents "ghost timer" bugs where a timer fires after the game state
 * has already moved on.
 */

export type TimerHandle = ReturnType<typeof setTimeout>;

interface TimerRecord {
  handle: TimerHandle;
  description: string;
  firedAt?: number;
}

/** Global registry: key = `${sessionId}:${timerId}` */
const timerRegistry = new Map<string, TimerRecord>();

/**
 * Schedule a one-shot callback and register it under a namespaced key.
 *
 * @param namespace  e.g. `${roomId}:auction` or `${roomId}:${playerId}:afk`
 * @param delayMs    Milliseconds until callback fires
 * @param callback   The function to invoke
 * @param description  Human-readable label for debugging
 * @returns The timer key (use to cancel)
 */
export function scheduleTimer(
  namespace: string,
  delayMs: number,
  callback: () => void,
  description = '',
): string {
  // Cancel any existing timer for the same namespace
  cancelTimer(namespace);

  const handle = setTimeout(() => {
    const record = timerRegistry.get(namespace);
    if (record) record.firedAt = Date.now();
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
export function cancelTimer(namespace: string): void {
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
export function cancelAllTimers(prefix: string): void {
  for (const [key] of timerRegistry) {
    if (key.startsWith(prefix)) {
      cancelTimer(key);
    }
  }
}

/** Returns all active timer namespaces (for debugging). */
export function listActiveTimers(): string[] {
  return [...timerRegistry.keys()];
}

// ─── Namespace helpers ────────────────────────────────────────────────────────

export const TimerNS = {
  auctionRound:  (roomId: string) => `${roomId}:auction:round`,
  dyingRescue:   (roomId: string, playerId: string) => `${roomId}:${playerId}:rescue`,
  dyingAfk:      (roomId: string, playerId: string) => `${roomId}:${playerId}:afk`,
  reconnect:     (roomId: string, playerId: string) => `${roomId}:${playerId}:reconnect`,
};
