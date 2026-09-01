"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phaseGuard = phaseGuard;
const direct_1 = require("../emitters/direct");
/**
 * Verify the session is in one of the allowed phases.
 * If not, emits ACTION_REJECTED and returns false.
 */
function phaseGuard(socket, session, allowedPhases, action) {
    if (!allowedPhases.includes(session.currentPhase)) {
        const payload = {
            action,
            reason: `Action "${action}" not allowed in phase "${session.currentPhase}"`,
            code: 'WRONG_PHASE',
        };
        (0, direct_1.emitToSocket)(socket, 'ACTION_REJECTED', payload);
        return false;
    }
    return true;
}
//# sourceMappingURL=phaseGuard.js.map