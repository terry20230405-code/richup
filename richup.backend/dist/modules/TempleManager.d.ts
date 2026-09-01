/**
 * Temple tile logic.
 *
 * Rules (per PRD):
 *  - Owner lands on own lit temple → draws 1 PropCard (no fee)
 *  - Owner lands on own unlit temple → pays prayFee, litCount++; if litCount >= litThreshold → temple lights up
 *  - Non-owner lands → pays passThruToll to owner
 *  - Temple can only be "lit" once per game
 */
import type { Server } from 'socket.io';
import type { PlayerId, TileId, Money } from '../types/Common.types';
import type { GameSession } from '../types/GameSession.types';
export interface TempleEventResult {
    ownerPrayed: boolean;
    propCardDrawn: boolean;
    rentCharged: boolean;
    requiresRescue: boolean;
    amountOwed: Money;
}
/**
 * Handle a player landing on a temple tile.
 * Returns a description of what happened.
 */
export declare function handleTempleLanding(session: GameSession, landingPlayerId: PlayerId, tileId: TileId, io: Server): TempleEventResult;
/**
 * Called when the owner explicitly clicks "TEMPLE_PRAY" (in EVENT_TRIGGER phase).
 * Deducts prayFee, increments litCount, lights up temple if threshold reached.
 */
export declare function ownerPrays(session: GameSession, playerId: PlayerId, tileId: TileId, io: Server): void;
//# sourceMappingURL=TempleManager.d.ts.map