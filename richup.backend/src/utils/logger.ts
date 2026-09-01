import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino(
  isTest
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
      }
);

export default logger;
