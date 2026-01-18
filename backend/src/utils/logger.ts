// Simple Structured Logger
// Fix 19: Structured logging for key operations

const getTimestamp = () => new Date().toISOString();

const formatMessage = (level: string, message: string, context: Record<string, any> = {}) => {
    return JSON.stringify({
        level,
        timestamp: getTimestamp(),
        message,
        ...context
    });
};

export const logger = {
    info: (message: string, context?: Record<string, any>) => {
        console.log(formatMessage('INFO', message, context));
    },
    warn: (message: string, context?: Record<string, any>) => {
        console.warn(formatMessage('WARN', message, context));
    },
    error: (message: string, context?: Record<string, any>) => {
        console.error(formatMessage('ERROR', message, context));
    },
    debug: (message: string, context?: Record<string, any>) => {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(formatMessage('DEBUG', message, context));
        }
    }
};
