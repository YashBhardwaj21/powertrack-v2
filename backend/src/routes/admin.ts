import express, { Request, Response } from 'express';
import crypto from 'crypto'; // Fix: Top-level import
import { query } from '../db/index.js';
import { authenticateToken, requireRole, invalidateUserCache } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { assignDeviceProfileSchema } from '../validation/adminSchemas.js';
import { errorResponse } from '../utils/errorResponse.js';

const router = express.Router();


router.get('/users', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
        const result = await query(`
            SELECT 
                u.id, 
                u.email, 
                u.full_name, 
                u.role, 
                u.created_at, 
                u.last_login,
                u.school_id,
                s.name as school_name
            FROM public.users u
            LEFT JOIN public.schools s ON u.school_id = s.id
            ORDER BY u.created_at DESC
        `);

        res.json(result.rows);
    } catch (error) {
        console.error('Get users error:', error);
        return errorResponse(res, 500, { error: 'Internal server error', code: 'SERVER_ERROR', details: error });
    }
});

/* =========================================================
   ASSIGN USER TO SCHOOL (ADMIN ONLY)
   The Core Handshake Logic
========================================================= */
router.post('/assign-school', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
        const { user_id, school_id, role } = req.body;

        if (!user_id) {
            return errorResponse(res, 400, { error: 'user_id is required', code: 'Validation Failed' });
        }

        // Validate User Exists
        const userCheck = await query('SELECT id, role FROM public.users WHERE id = $1', [user_id]);
        if (userCheck.rows.length === 0) {
            return errorResponse(res, 404, { error: 'User not found', code: 'USER_NOT_FOUND' });
        }

        // Prevent accidental self-lockout or super-admin reassignment if strictness needed
        // For now, we allow it but log it.

        // Validate School Exists (if not unassigning)
        if (school_id) {
            const schoolCheck = await query('SELECT id FROM public.schools WHERE id = $1', [school_id]);
            if (schoolCheck.rows.length === 0) {
                return errorResponse(res, 404, { error: 'School not found', code: 'SCHOOL_NOT_FOUND' });
            }
        }

        // Apply Update
        // We allow changing role here too, defaulting to 'school_admin' if they are being assigned a school
        // and current role is 'viewer'.

        let newRole = role || userCheck.rows[0].role;

        // Auto-promote viewer to school_admin if not specified and getting a school? 
        // User spec says: "optionally users.role". Let's respect input or keep existing.

        await query(
            `UPDATE public.users 
             SET school_id = $1, 
                 role = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [school_id || null, newRole, user_id]
        );



        // 🧹 Invalidate Cache
        invalidateUserCache(user_id);

        console.log(`[Admin] Assigned user ${user_id} to school ${school_id || 'NULL'} with role ${newRole}`);

        res.json({
            success: true,
            message: 'User assignment updated successfully',
            user_id,
            school_id,
            role: newRole
        });

    } catch (error) {
        console.error('Assign school error:', error);
        return errorResponse(res, 500, { error: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

/* =========================================================
   ASSIGN DEVICE PROFILE TO SCHOOL (ADMIN ONLY)
   Fixes "Device profile not configured" errors
========================================================= */
router.post('/schools/:id/assign-device-profile', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
        const { id: schoolId } = req.params;
        const { device_profile_id } = req.body;

        if (!device_profile_id) {
            return errorResponse(res, 400, {
                error: 'device_profile_id is required',
                code: 'INVALID_PAYLOAD',
                resolution: 'Provide a valid device profile UUID'
            });
        }

        // Validate school exists and is not deleted
        const schoolCheck = await query(
            'SELECT id, name, deleted_at FROM public.schools WHERE id = $1',
            [schoolId]
        );

        if (schoolCheck.rows.length === 0) {
            return errorResponse(res, 404, {
                error: 'School not found',
                code: 'SCHOOL_NOT_FOUND',
                resolution: 'Verify the school ID is correct'
            });
        }

        if (schoolCheck.rows[0].deleted_at !== null) {
            return errorResponse(res, 400, {
                error: 'Cannot assign profile to deleted school',
                code: 'SCHOOL_DEACTIVATED',
                resolution: 'Reactivate the school first'
            });
        }

        // Validate device profile exists
        const profileCheck = await query(
            'SELECT id, name, vendor FROM public.device_profiles WHERE id = $1',
            [device_profile_id]
        );

        if (profileCheck.rows.length === 0) {
            return errorResponse(res, 404, {
                error: 'Device profile not found',
                code: 'PROFILE_NOT_FOUND',
                resolution: 'Verify the device profile ID is correct'
            });
        }

        // Assign the profile
        const result = await query(
            `UPDATE public.schools 
             SET device_profile_id = $1, updated_at = NOW()
             WHERE id = $2
             RETURNING id, name, device_profile_id`,
            [device_profile_id, schoolId]
        );

        const school = result.rows[0];
        const profile = profileCheck.rows[0];

        console.log(`[Admin] Assigned device profile "${profile.name}" to school "${school.name}" (${school.id})`);

        res.json({
            success: true,
            message: 'Device profile assigned successfully',
            school: {
                id: school.id,
                name: school.name,
                device_profile_id: school.device_profile_id
            },
            device_profile: {
                id: profile.id,
                name: profile.name,
                vendor: profile.vendor
            }
        });

    } catch (error: any) {
        console.error('[Admin] Assign device profile error:', error);
        return errorResponse(res, 500, {
            error: 'Failed to assign device profile',
            code: 'DATABASE_ERROR',
            resolution: 'Contact system administrator'
        });
    }
});

/* =========================================================
   ROTATE API KEY (ADMIN ONLY)
========================================================= */
router.post('/schools/:id/rotate-api-key', authenticateToken, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        // Crypto is now imported at the top

        // 1. Generate new key
        const rawKey = `pt_live_${crypto.randomBytes(32).toString('hex')}`;
        const apiKeyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

        // 2. Update DB
        const result = await query(
            `UPDATE public.schools 
             SET api_key_hash = $1, updated_at = NOW()
             WHERE id = $2 AND deleted_at IS NULL
             RETURNING id, name`,
            [apiKeyHash, id]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, 404, { error: 'School not found', code: 'SCHOOL_NOT_FOUND' });
        }

        const school = result.rows[0];
        console.log(`[Admin] Rotated API key for school "${school.name}" (${school.id})`);

        // 3. Return NEW key (One-time view)
        res.json({
            success: true,
            message: 'API key rotated successfully. This key will not be shown again.',
            school_id: school.id,
            api_key: rawKey // ✅ Returned exactly once
        });

    } catch (error) {
        console.error('Rotate API key error:', error);
        return errorResponse(res, 500, { error: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

export default router;
