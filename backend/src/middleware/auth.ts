import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { JWTPayload } from '../types/index.js';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
            schoolId?: string;
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

import { query } from '../db/index.js';

export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }

    try {
        const result = await query(
            'SELECT id FROM public.schools WHERE api_key = $1',
            [apiKey]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        req.schoolId = result.rows[0].id;
        next();
    } catch (error) {
        console.error('API key auth error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const requireRole = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};
