import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10, // Limit each IP to 10 login requests per windowMs
    message: 'Too many login attempts from this IP, please try again after 15 minutes', // message is deprecated in v7? No, Check docs. "message" property or "handler". v7 uses "limit" not "max"? 
    // express-rate-limit v7: 'limit' is the option, 'max' is deprecated.
    standardHeaders: true,
    legacyHeaders: false,
});

export const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 1000, // Limit per key
    keyGenerator: (req) => {
        // 1. Try X-API-KEY header
        const headerKey = req.headers['x-api-key'] as string;
        if (headerKey) return headerKey;

        // 2. Try Authorization header (Bearer or Basic)
        const auth = req.headers['authorization'];
        if (auth) {
            if (auth.startsWith('Bearer ')) return auth.substring(7);
            if (auth.startsWith('Basic ')) return auth.substring(6);
        }

        // 3. Fallback to IP for unauthenticated requests
        return req.ip || 'unknown_ip';
    },
    message: 'Too many requests from this IP/Key, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});
