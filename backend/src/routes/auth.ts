import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../db/index.js';
import { config } from '../config/index.js';
import { validate } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { loginSchema, registerSchema } from '../validation/schemas.js';
import { User } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { errorResponse } from '../utils/errorResponse.js';

const router = express.Router();

/* =========================================================
   LOGIN
========================================================= */
router.post(
    '/login',
    authLimiter,
    validate(loginSchema),
    async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body;

            // Fetch user
            const result = await query(
                'SELECT * FROM public.users WHERE email = $1',
                [email]
            );

            if (result.rows.length === 0) {
                return errorResponse(res, 401, { error: 'Invalid credentials', code: 'AUTH_INVALID' });
            }

            const user: User = result.rows[0];

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return errorResponse(res, 401, { error: 'Invalid credentials', code: 'AUTH_INVALID' });
            }

            // Update last login
            await query(
                'UPDATE public.users SET last_login = NOW() WHERE id = $1',
                [user.id]
            );

            // Generate JWT
            const token = jwt.sign(
                {
                    userId: user.id,
                    email: user.email,
                    role: user.role,
                    schoolId: user.school_id,
                },
                config.jwtSecret as string,
                { expiresIn: config.jwtExpiry as any }
            );

            // Fetch school (optional)
            let school = null;
            if (user.school_id) {
                const schoolResult = await query(
                    'SELECT id, name, type, district FROM public.schools WHERE id = $1',
                    [user.school_id]
                );
                school = schoolResult.rows[0] || null;
            }

            // Remove password hash from response
            const { password_hash, ...safeUser } = user;

            // Log successful login
            logger.info('User logged in', {
                userId: user.id,
                role: user.role,
                schoolId: user.school_id
            });

            return res.json({
                token,
                user: {
                    ...safeUser,
                    school,
                },
            });
        } catch (error) {
            logger.error('Login error', { error: String(error) });
            return errorResponse(res, 500, { error: 'Internal server error', code: 'SERVER_ERROR' });
        }
    }
);

/* =========================================================
   REGISTER
========================================================= */
router.post(
    '/register',
    validate(registerSchema),
    async (req: Request, res: Response) => {
        try {
            const {
                email,
                password,
                full_name,
                role = 'viewer',
                school_id = null,
            } = req.body;

            // Check existing user
            const existingUser = await query(
                'SELECT id FROM public.users WHERE email = $1',
                [email]
            );

            if (existingUser.rows.length > 0) {
                return errorResponse(res, 409, { error: 'User already exists', code: 'USER_EXISTS' });
            }

            // Hash password
            const password_hash = await bcrypt.hash(password, 10);

            // Insert user
            const result = await query(
                `
        INSERT INTO public.users (
          email,
          password_hash,
          full_name,
          role,
          school_id
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, full_name, role, school_id, created_at
        `,
                [email, password_hash, full_name, role, school_id]
            );

            const newUser = result.rows[0];

            // Generate JWT
            const token = jwt.sign(
                {
                    userId: newUser.id,
                    email: newUser.email,
                    role: newUser.role,
                    schoolId: newUser.school_id,
                },
                config.jwtSecret as string,
                { expiresIn: config.jwtExpiry as any }
            );

            return res.status(201).json({
                token,
                user: newUser,
            });
        } catch (error) {
            console.error('Registration error:', error);
            return errorResponse(res, 500, { error: 'Internal server error', code: 'SERVER_ERROR' });
        }
    }
);

/* =========================================================
   LOGOUT (CLIENT-SIDE)
========================================================= */
router.post('/logout', (_req: Request, res: Response) => {
    return res.json({ message: 'Logged out successfully' });
});

/* =========================================================
   FORGOT PASSWORD
========================================================= */
router.post('/forgot-password', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        const result = await query('SELECT id FROM public.users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            // Security: Don't reveal if user exists
            return res.json({ message: 'If that email exists, we sent a reset link to it.' });
        }

        const user = result.rows[0];
        const resetToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        // Expires in 1 hour
        const expires = new Date(Date.now() + 3600000);

        await query(
            'UPDATE public.users SET reset_token = $1, reset_expires = $2 WHERE id = $3',
            [resetToken, expires, user.id]
        );

        // DEV MODE: Log the link
        const resetLink = `http://localhost:3000/reset-password?token=${resetToken}`;
        logger.info('🔑 PASSWORD RESET LINK:', { email, resetLink });
        console.log('\n\n==================================================');
        console.log('🔗 PASSWORD RESET LINK:', resetLink);
        console.log('==================================================\n\n');

        return res.json({ message: 'If that email exists, we sent a reset link to it.' });
    } catch (error) {
        logger.error('Forgot password error:', error);
        return errorResponse(res, 500, { error: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

/* =========================================================
   RESET PASSWORD
========================================================= */
router.post('/reset-password', async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;

        const result = await query(
            'SELECT id FROM public.users WHERE reset_token = $1 AND reset_expires > NOW()',
            [token]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, 400, { error: 'Invalid or expired token', code: 'AUTH_TOKEN_INVALID' });
        }

        const user = result.rows[0];
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await query(
            'UPDATE public.users SET password_hash = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2',
            [passwordHash, user.id]
        );

        return res.json({ message: 'Password updated successfully' });
    } catch (error) {
        logger.error('Reset password error:', error);
        return errorResponse(res, 500, { error: 'Internal server error', code: 'SERVER_ERROR' });
    }
});


/* =========================================================
   VERIFY TOKEN
========================================================= */
router.get('/verify', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
        return errorResponse(res, 401, { error: 'No token provided', code: 'AUTH_MISSING_TOKEN' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as {
            userId: string;
        };

        const result = await query(
            'SELECT id, email, full_name, role, school_id FROM public.users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, 404, { error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        const user = result.rows[0];

        let school = null;
        if (user.school_id) {
            const schoolResult = await query(
                'SELECT id, name, type, district FROM public.schools WHERE id = $1',
                [user.school_id]
            );
            school = schoolResult.rows[0] || null;
        }

        // Generate fresh JWT with latest permissions
        const newToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role,
                schoolId: user.school_id,
            },
            config.jwtSecret as string,
            { expiresIn: config.jwtExpiry as any }
        );

        return res.json({
            token: newToken,
            user: {
                ...user,
                school,
            },
        });
    } catch (error) {
        return errorResponse(res, 403, { error: 'Invalid or expired token', code: 'AUTH_TOKEN_INVALID' });
    }
});

export default router;
