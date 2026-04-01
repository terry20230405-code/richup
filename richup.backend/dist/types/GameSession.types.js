"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurpriseCardType = exports.BankruptcyType = exports.GameStatus = exports.TurnPhase = void 0;
// ─── Turn Phase ───────────────────────────────────────────────────────────────
/**
 * The state machine phase for the current turn.
 * StateMachine.ts is the sole writer of session.currentPhase.
 */
var TurnPhase;
(function (TurnPhase) {
    TurnPhase["WAITING_FOR_ACTION"] = "WAITING_FOR_ACTION";
    TurnPhase["ROLLING_DICE"] = "ROLLING_DICE";
    TurnPhase["MOVING"] = "MOVING";
    TurnPhase["EVENT_TRIGGER"] = "EVENT_TRIGGER";
    TurnPhase["AUCTION_IN_PROGRESS"] = "AUCTION_IN_PROGRESS";
    TurnPhase["BUILD_PHASE"] = "BUILD_PHASE";
    TurnPhase["JAIL_DECISION"] = "JAIL_DECISION";
    TurnPhase["DYING_RESCUE"] = "DYING_RESCUE";
    TurnPhase["END_TURN_PENDING"] = "END_TURN_PENDING";
    TurnPhase["TURN_TRANSITIONING"] = "TURN_TRANSITIONING";
})(TurnPhase || (exports.TurnPhase = TurnPhase = {}));
// ─── Game Status ─────────────────────────────────────────────────────────────
var GameStatus;
(function (GameStatus) {
    GameStatus["LOBBY"] = "LOBBY";
    GameStatus["STARTING"] = "STARTING";
    GameStatus["IN_PROGRESS"] = "IN_PROGRESS";
    GameStatus["PAUSED"] = "PAUSED";
    GameStatus["FINISHED"] = "FINISHED";
})(GameStatus || (exports.GameStatus = GameStatus = {}));
// ─── Bankruptcy ───────────────────────────────────────────────────────────────
var BankruptcyType;
(function (BankruptcyType) {
    BankruptcyType["TYPE_A"] = "TYPE_A";
    BankruptcyType["TYPE_B"] = "TYPE_B";
})(BankruptcyType || (exports.BankruptcyType = BankruptcyType = {}));
// ─── Surprise Card ───────────────────────────────────────────────────────────
var SurpriseCardType;
(function (SurpriseCardType) {
    SurpriseCardType["CASH_GAIN"] = "CASH_GAIN";
    SurpriseCardType["CASH_LOSS"] = "CASH_LOSS";
    SurpriseCardType["PROP_CARD"] = "PROP_CARD";
    SurpriseCardType["RAMPAGE"] = "RAMPAGE";
})(SurpriseCardType || (exports.SurpriseCardType = SurpriseCardType = {}));
//# sourceMappingURL=GameSession.types.js.map