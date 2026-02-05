
import pino from 'pino';
import { config } from '../config/index.js';

// Base configuration
const baseConfig = {
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
    base: {
        env: config.nodeEnv,
        service: 'powertrack-backend',
    },
    redact: {
        paths: ['req.headers.authorization', 'req.body.password', 'req.body.api_key'],
        remove: true,
    },
    // Standard timestamp format
    timestamp: pino.stdTimeFunctions.isoTime,
};

// Conditional Logger Creation
// In Dev: We use 'transport' option for pino-pretty (runs in worker thread)
// In Prod: We use a high-performance SonicBoom stream (passed as 2nd arg)
let loggerInstance;

if (config.nodeEnv === 'development') {
    loggerInstance = pino({
        ...baseConfig,
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        },
    });
} else {
    const stream = pino.destination({ sync: false, minLength: 4096 });
    loggerInstance = pino(baseConfig, stream);
}

export const logger = loggerInstance;

// Helper for consistency
export const logError = (msg: string, error: any, context: object = {}) => {
    logger.error({ ...context, err: error }, msg);
};
