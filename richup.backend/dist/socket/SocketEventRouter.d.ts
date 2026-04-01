/**
 * Socket.io event router — central dispatch point for all client actions.
 *
 * Pattern for every handler:
 *   1. Resolve session + playerId from socket context
 *   2. Guard: phase check, turn check, Zod validation
 *   3. Execute module function
 *   4. Handle errors → emit ACTION_REJECTED
 */
import type { Server, Socket } from 'socket.io';
export declare function registerSocketEvents(io: Server, socket: Socket): void;
//# sourceMappingURL=SocketEventRouter.d.ts.map