import type { Server, Socket } from 'socket.io';
import type { PlayerId } from '../../types/Common.types';
import type { ServerEventPayloads } from '../../types/Events.types';
/**
 * Emit a private event to a specific player.
 *
 * Each player socket joins a private room keyed `player:<playerId>` on connect.
 * This means io.to(`player:${playerId}`) always reaches exactly that player,
 * even after reconnection.
 */
export declare function emitToPlayer<TEvent extends keyof ServerEventPayloads>(io: Server, playerId: PlayerId, event: TEvent, payload: ServerEventPayloads[TEvent]): void;
/** Emit a protocol-checked event only to the current physical socket. */
export declare function emitToSocket<TEvent extends keyof ServerEventPayloads>(socket: Socket, event: TEvent, payload: ServerEventPayloads[TEvent]): void;
/** The private room name a player socket should join. */
export declare function playerRoom(playerId: PlayerId): string;
//# sourceMappingURL=direct.d.ts.map