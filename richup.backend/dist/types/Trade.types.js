"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeVoidReason = exports.TradeStatus = void 0;
var TradeStatus;
(function (TradeStatus) {
    TradeStatus["PENDING"] = "PENDING";
    TradeStatus["ACCEPTED"] = "ACCEPTED";
    TradeStatus["REJECTED"] = "REJECTED";
    TradeStatus["CANCELLED"] = "CANCELLED";
    TradeStatus["COMPLETED"] = "COMPLETED";
    TradeStatus["VOIDED"] = "VOIDED";
})(TradeStatus || (exports.TradeStatus = TradeStatus = {}));
var TradeVoidReason;
(function (TradeVoidReason) {
    TradeVoidReason["PLAYER_ROLLED"] = "PLAYER_ROLLED";
    TradeVoidReason["PLAYER_JAILED"] = "PLAYER_JAILED";
    TradeVoidReason["PLAYER_DYING"] = "PLAYER_DYING";
    TradeVoidReason["PLAYER_BANKRUPT"] = "PLAYER_BANKRUPT";
    TradeVoidReason["PLAYER_DISCONNECTED"] = "PLAYER_DISCONNECTED";
    TradeVoidReason["GAME_ENDED"] = "GAME_ENDED";
})(TradeVoidReason || (exports.TradeVoidReason = TradeVoidReason = {}));
//# sourceMappingURL=Trade.types.js.map