import type { Socket } from 'socket.io';
import type { ZodSchema, ZodError } from 'zod';
import type { S2C_ActionRejected } from '../../types/Events.types';
import { emitToSocket } from '../emitters/direct';

/**
 * Validate incoming payload against a Zod schema.
 * If invalid, emits ACTION_REJECTED and returns null.
 */
export function validateInput<T>(
  socket: Socket,
  schema: ZodSchema<T>,
  data: unknown,
  action: string,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const err = result.error as ZodError;
    const payload: S2C_ActionRejected = {
      action,
      reason: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
      code: 'INVALID_INPUT',
    };
    emitToSocket(socket, 'ACTION_REJECTED', payload);
    return null;
  }
  return result.data;
}
