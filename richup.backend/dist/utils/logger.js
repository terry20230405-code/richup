"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';
exports.logger = (0, pino_1.default)(isTest
    ? { level: 'silent' }
    : isDev
        ? {
            level: process.env.LOG_LEVEL ?? 'debug',
            transport: {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard' },
            },
        }
        : {
            level: process.env.LOG_LEVEL ?? 'info',
        });
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map