import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { JWTPayload } from '../types/index.js';
import { query } from '../db/index.js';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload;
            schoolId?: string;
        }
    }
}

// 🚀 Optimization: Simple In-Memory Cache for User Sessions
// Prevents hitting the DB on every single request for the same user.
import { BUSINESS_LOGIC } from '../config/constants.js';

class UserCache {
    private cache = new Map<string, { user: any; expiry: number }>();
    private readonly TTL_MS = BUSINESS_LOGIC.USER_SESSION_TTL_MS;

    get(userId: string) {
        const item = this.cache.get(userId);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(userId);
            return null;
        }
        return item.user;
    }

    set(userId: string, user: any) {
        this.cache.set(userId, {
            user,
            expiry: Date.now() + this.TTL_MS
        });

        // Prevent memory leak: clear old keys if too big
        if (this.cache.size > 1000) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey) this.cache.delete(firstKey);
        }
    }

    clear(userId: string) {
        this.cache.delete(userId);
    }
}

const userSessionCache = new UserCache();

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'] as string;

    if (!authHeader || authHeader === 'Bearer undefined' || authHeader === 'Bearer null') {
        return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];

    if (!token || token === 'undefined' || token === 'null') {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        // 1. Verify Signature (Fast CPU op)
        const decoded = jwt.verify(token, config.jwtSecret) as JWTPayload;

        // 2. Check Cache First (Zero I/O)
        const cachedUser = userSessionCache.get(decoded.userId);
        if (cachedUser) {
            req.user = cachedUser;
            (req as any).school_id = cachedUser.schoolId; // Back-compat
            return next();
        }

        // 3. Cache Miss: Fetch User from DB
        const userResult = await query(
            'SELECT id, email, role, school_id FROM public.users WHERE id = $1',
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: 'User no longer exists' });
        }

        const freshUser = userResult.rows[0];

        // 4. Transform & Cache Result
        req.user = {
            userId: freshUser.id,
            email: freshUser.email,
            role: freshUser.role,
            schoolId: freshUser.school_id
        };

        userSessionCache.set(decoded.userId, req.user);

        // Compatibility for routes expecting user.school_id
        (req.user as any).school_id = freshUser.school_id;

        next();
    } catch (error) {
        console.error('Auth Middleware Error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// 🧹 Export cache invalidation helper
export const invalidateUserCache = (userId: string) => {
    userSessionCache.clear(userId);
    console.log(`[Auth] Invalidated cache for user ${userId}`);
};

export const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    let apiKey = req.headers['x-api-key'] as string;

    // Support for Market Loggers (Bearer Token or Basic Auth)
    // This allows using the "Username" or "Password" field in device settings
    if (!apiKey && req.headers['authorization']) {
        const auth = req.headers['authorization'];
        if (auth.startsWith('Bearer ')) {
            apiKey = auth.substring(7).trim();
        } else if (auth.startsWith('Basic ')) {
            try {
                // Decode "user:pass"
                const creds = Buffer.from(auth.substring(6).trim(), 'base64').toString('utf-8');
                const [user, pass] = creds.split(':');

                // Smart detection: Check which field holds the PowerTrack key
                if (user?.startsWith('pt_live_')) apiKey = user;
                else if (pass?.startsWith('pt_live_')) apiKey = pass;
                else apiKey = user; // Fallback
            } catch (err) {
                // Formatting error, ignore
            }
        }
    }

    // Gate 1: API Key Presence
    if (!apiKey) {
        return res.status(401).json({
            error: 'API key required',
            code: 'INVALID_API_KEY',
            resolution: 'Include X-API-KEY header with your request'
        });
    }

    // Gate 2: API Key Format Validation
    if (!apiKey.startsWith('pt_live_')) {
        return res.status(401).json({
            error: 'Invalid API key format',
            code: 'INVALID_API_KEY',
            resolution: 'API key must start with pt_live_ prefix'
        });
    }

    try {
        // Hash the incoming key for lookup (Strip prefix if your database stores hashed suffix, 
        // but here we hash the whole key for deterministic lookup)
        const incomingHash = crypto.createHash('sha256').update(apiKey).digest('hex');

        // Gate 3: School Lookup with Profile and Deletion Status
        const result = await query(
            `SELECT 
                s.id, 
                s.name,
                s.timezone,
                s.api_key_hash, 
                s.device_profile_id, 
                s.deleted_at,
                p.name as profile_name,
                p.field_map
             FROM public.schools s
             LEFT JOIN public.device_profiles p ON s.device_profile_id = p.id
             WHERE s.api_key_hash = $1`,
            [incomingHash]
        );

        // Gate 4: School Existence Check
        if (result.rows.length === 0) {
            const maskedKey = `****${apiKey.slice(-4)}`;
            console.warn(`[Auth] Invalid API key: ${maskedKey}`);
            return res.status(401).json({
                error: 'Invalid API key',
                code: 'INVALID_API_KEY',
                resolution: 'Verify your API key is correct or generate a new one from the dashboard'
            });
        }

        // Gate 5: Data Integrity Check (Multiple Schools with Same Hash)
        if (result.rows.length > 1) {
            console.error(`[Auth] CRITICAL: Multiple schools with same API key hash!`, {
                hash: incomingHash.slice(0, 8) + '...',
                count: result.rows.length
            });
            return res.status(500).json({
                error: 'API key data integrity violation',
                code: 'CORRUPT_API_KEY_STATE',
                resolution: 'Contact system administrator - database integrity issue detected'
            });
        }

        const school = result.rows[0];

        // Gate 6: Constant-Time Hash Comparison (Security)
        const storedHashBuffer = Buffer.from(school.api_key_hash, 'hex');
        const incomingHashBuffer = Buffer.from(incomingHash, 'hex');

        if (storedHashBuffer.length !== incomingHashBuffer.length ||
            !crypto.timingSafeEqual(storedHashBuffer, incomingHashBuffer)) {
            console.warn(`[Auth] Hash mismatch for school ${school.id}`);
            return res.status(401).json({
                error: 'Invalid API key',
                code: 'INVALID_API_KEY',
                resolution: 'API key verification failed'
            });
        }

        // Gate 7: Deletion Status Check
        if (school.deleted_at !== null) {
            console.warn(`[Auth] Attempt to use deleted school: ${school.id} (${school.name})`);
            return res.status(403).json({
                error: 'School has been deactivated',
                code: 'SCHOOL_DEACTIVATED',
                resolution: 'This school is no longer active. Contact administrator to reactivate.'
            });
        }

        // Gate 8: Device Profile Requirement (HARD GATE)
        if (!school.device_profile_id) {
            console.warn(`[Auth] School ${school.id} (${school.name}) missing device profile`);
            return res.status(412).json({
                error: 'Device profile not configured',
                code: 'DEVICE_PROFILE_REQUIRED',
                resolution: 'Assign a device profile to this school in the Dashboard → Schools → Device Setup'
            });
        }

        // ✅ ALL GATES PASSED - Attach to Request
        req.schoolId = school.id;
        (req as any).schoolName = school.name;
        (req as any).schoolTimezone = school.timezone || 'Asia/Jakarta';
        (req as any).deviceProfile = {
            id: school.device_profile_id,
            name: school.profile_name,
            field_map: school.field_map || {}
        };

        console.log(`[Auth] ✅ Authenticated School: "${school.name}" (ID: ${school.id}) | Profile: ${school.profile_name}`);
        next();
    } catch (error) {
        console.error('[Auth] Unexpected error during API key authentication:', error);
        return res.status(500).json({
            error: 'Authentication system error',
            code: 'DATABASE_ERROR',
            resolution: 'Temporary system issue - please retry. Contact support if persists.'
        });
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
