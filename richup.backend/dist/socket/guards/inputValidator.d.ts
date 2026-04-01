import type { Socket } from 'socket.io';
import type { ZodSchema } from 'zod';
/**
 * Validate incoming payload against a Zod schema.
 * If invalid, emits ACTION_REJECTED and returns null.
 */
export declare function validateInput<T>(socket: Socket, schema: ZodSchema<T>, data: unknown, action: string): T | null;
//# sourceMappingURL=inputValidator.d.ts.map