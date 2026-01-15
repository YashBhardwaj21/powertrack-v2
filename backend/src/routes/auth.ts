import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { config } from '../config/index.js';
import { validate, loginValidation, registerValidation } from '../middleware/validation.js';
import { User } from '../types/index.js';

const router = express.Router();

/* =========================================================
   LOGIN
========================================================= */
router.post(
    '/login',
    validate(loginValidation),
    async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body;

            // Fetch user
            const result = await query(
                'SELECT * FROM public.users WHERE email = $1',
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user: User = result.rows[0];

            // Verify password
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
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
                config.jwtSecret,
                { expiresIn: config.jwtExpiry }
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

            return res.json({
                token,
                user: {
                    ...safeUser,
                    school,
                },
            });
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/* =========================================================
   REGISTER
========================================================= */
router.post(
    '/register',
    validate(registerValidation),
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
                return res.status(400).json({ error: 'User already exists' });
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
                config.jwtSecret,
                { expiresIn: config.jwtExpiry }
            );

            return res.status(201).json({
                token,
                user: newUser,
            });
        } catch (error) {
            console.error('Registration error:', error);
            return res.status(500).json({ error: 'Internal server error' });
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
   VERIFY TOKEN
========================================================= */
router.get('/verify', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
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
            return res.status(404).json({ error: 'User not found' });
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

        return res.json({
            user: {
                ...user,
                school,
            },
        });
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
});

export default router;
