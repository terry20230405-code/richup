"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateInput = validateInput;
const direct_1 = require("../emitters/direct");
/**
 * Validate incoming payload against a Zod schema.
 * If invalid, emits ACTION_REJECTED and returns null.
 */
function validateInput(socket, schema, data, action) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const err = result.error;
        const payload = {
            action,
            reason: err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
            code: 'INVALID_INPUT',
        };
        (0, direct_1.emitToSocket)(socket, 'ACTION_REJECTED', payload);
        return null;
    }
    return result.data;
}
//# sourceMappingURL=inputValidator.js.map