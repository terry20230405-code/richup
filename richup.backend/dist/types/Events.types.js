"use strict";
/**
 * Complete Socket.io event payload definitions.
 *
 * Naming conventions:
 *   C2S_* = Client to Server (action:SCREAMING_SNAKE_CASE)
 *   S2C_* = Server to Client (SCREAMING_SNAKE_CASE)
 *
 * Information asymmetry rules (enforced by GameStateSerializer):
 *   ✗ player.cash MUST NOT appear in any broadcast (S2C) payload
 *   ✗ player.propCards and count MUST NOT appear in any broadcast payload
 *   ✓ Cash DELTAS (amounts) are allowed in broadcast payloads
 *   ✓ CASH_UPDATED is directed (private) only
 */
Object.defineProperty(exports, "__esModule", { value: true });
//# sourceMappingURL=Events.types.js.map