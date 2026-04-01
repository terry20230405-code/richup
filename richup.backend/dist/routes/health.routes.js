"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});
exports.default = router;
//# sourceMappingURL=health.routes.js.map