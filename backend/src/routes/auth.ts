import express, { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../db/index.js';
import { config } from '../config/index.js';
import { validate, loginValidation, registerValidation } from '../middleware/validation.js';
import { User } from '../types/index.js';

const router = express.Router();

// Login endpoint
router.post('/login', validate(loginValidation), async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const result = await query(
            'SELECT * FROM users WHERE email = $1',
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
            'UPDATE users SET last_login = NOW() WHERE id = $1',
            [user.id]
        );

        // Generate JWT token
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

        // Get school info if user has a school
        let school = null;
        if (user.school_id) {
            const schoolResult = await query(
                'SELECT id, name, type, district FROM schools WHERE id = $1',
                [user.school_id]
            );
            school = schoolResult.rows[0] || null;
        }

        // Return user data (without password hash) and token
        const { password_hash, ...userWithoutPassword } = user;
        res.json({
            token,
            user: {
                ...userWithoutPassword,
                school,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Register endpoint
router.post('/register', validate(registerValidation), async (req: Request, res: Response) => {
    try {
        const { email, password, full_name, role = 'viewer', school_id } = req.body;

        // Check if user already exists
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Hash password
        const password_hash = await bcrypt.hash(password, 10);

        // Insert new user
        const result = await query(
            `INSERT INTO users (email, password_hash, full_name, role, school_id) 
             VALUES ($1, $2, $3, $4, $5) 
             RETURNING id, email, full_name, role, school_id, created_at`,
            [email, password_hash, full_name, role, school_id]
        );

        const newUser = result.rows[0];

        // Generate JWT token
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

        res.status(201).json({
            token,
            user: newUser,
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout endpoint (client-side token removal, but we can track it)
router.post('/logout', (req: Request, res: Response) => {
    // In a more sophisticated setup, you might maintain a token blacklist
    res.json({ message: 'Logged out successfully' });
});

// Verify token endpoint
router.get('/verify', async (req: Request, res: Response) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as any;

        // Get fresh user data
        const result = await query(
            'SELECT id, email, full_name, role, school_id FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Get school info if user has a school
        let school = null;
        if (user.school_id) {
            const schoolResult = await query(
                'SELECT id, name, type, district FROM schools WHERE id = $1',
                [user.school_id]
            );
            school = schoolResult.rows[0] || null;
        }

        res.json({
            user: {
                ...user,
                school,
            },
        });
    } catch (error) {
        res.status(403).json({ error: 'Invalid token' });
    }
});

export default router;
