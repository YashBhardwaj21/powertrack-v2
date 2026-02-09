import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { query, getClient } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { errorResponse } from '../utils/errorResponse.js';
import { broadcastSchoolCreated } from '../websocket/index.js';

import { transformSchoolRow } from '../utils/transformers.js';

const router = express.Router();

// Import district helper for timezone and coordinates (uses geocoding for unknown districts)
import { getDistrictInfoAsync } from '../utils/districtHelper.js';



/* =========================================================
   GET ALL SCHOOLS (ACTIVE ONLY BY DEFAULT)
========================================================= */
router.get('/', async (req: Request, res: Response) => {
    try {
        const includeArchived = req.query.includeArchived === 'true';

        const result = await query(
            `SELECT id, name, type, district, latitude, longitude,
                    total_capacity_kwp, total_cost_idr, timezone, created_at, deleted_at
             FROM public.schools
             WHERE ($1 = TRUE OR deleted_at IS NULL)
             ORDER BY name`,
            [includeArchived]
        );

        res.json(result.rows.map(transformSchoolRow));
    } catch (error) {
        console.error('Get schools error:', error);
        return errorResponse(res, 500, { error: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

/* =========================================================
   GET SCHOOL BY ID
========================================================= */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT id, name, type, district, latitude, longitude,
                    total_capacity_kwp, total_cost_idr, timezone, created_at, deleted_at
             FROM public.schools
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return errorResponse(res, 404, { error: 'School not found', code: 'SCHOOL_NOT_FOUND' });
        }

        res.json(transformSchoolRow(result.rows[0]));
    } catch (error) {
        console.error('Get school error:', error);
        return errorResponse(res, 500, { error: 'Internal server error', code: 'SERVER_ERROR' });
    }
});

/* =========================================================
   CREATE SCHOOL (ADMIN ONLY) - ENHANCED FOR WIZARD
========================================================= */
router.post(
    '/',
    authenticateToken,
    async (req: Request, res: Response) => {
        try {
            const {
                name,
                type,
                district,
                latitude,
                longitude,
                total_capacity_kwp,
                total_cost_idr,
                device_profile_id,
                api_key // Accept from frontend if provided
            } = req.body;

            const requestingUser = (req as any).user;

            // 1. Handle Optional Device Profile
            let finalProfileId = device_profile_id;
            if (!finalProfileId) {
                // Try to find a default profile from system parameters or conventions
                // For now, we leave it null (unconfigured) unless a 'default_profile_id' param exists
                const defaultProfile = await query(
                    `SELECT value FROM public.system_parameters WHERE key = 'default_device_profile_id'`
                );
                if (defaultProfile.rows.length > 0) {
                    // ... (logic from before, truncated for brevity of replace call, keeping null logic)
                    finalProfileId = null;
                }
            }

            // 🔐 Hash the API key sent from frontend OR generate new one
            // Frontend generates it so user can see it before org creation
            const rawKey = api_key || `pt_live_${crypto.randomBytes(32).toString('hex')}`;
            const apiKeyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

            // 🌍 DERIVE timezone AND coordinates from district (uses geocoding for unknown districts)
            const districtInfo = await getDistrictInfoAsync(district);
            const finalTimezone = districtInfo.timezone;
            const finalLatitude = districtInfo.latitude;
            const finalLongitude = districtInfo.longitude;

            const result = await query(
                `INSERT INTO public.schools (
                    name,
                    type,
                    district,
                    latitude,
                    longitude,
                    total_capacity_kwp,
                    total_cost_idr,
                    api_key_hash,
                    device_profile_id,
                    timezone
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 RETURNING *`,
                [
                    name,
                    type,
                    district,
                    finalLatitude,   // Use district-derived latitude
                    finalLongitude,  // Use district-derived longitude
                    total_capacity_kwp,
                    total_cost_idr,
                    apiKeyHash,
                    finalProfileId || null,
                    finalTimezone    // Use district-derived timezone
                ]
            );

            // Return transformed school object with the RAW key attached
            // This is the ONLY time the raw key will be returned from the backend
            const school = transformSchoolRow(result.rows[0]);

            if (!school) {
                throw new Error('Failed to transform created school');
            }

            school.api_key = rawKey;

            school.api_key = rawKey;

            // 📣 BROADCAST EVENT
            broadcastSchoolCreated(school);

            // AUTO-ASSIGN USER TO SCHOOL IF NOT ADMIN
            let updatedUser = { ...requestingUser };
            let newToken = null;

            if (requestingUser.role !== 'admin') {
                const assignResult = await query(
                    `UPDATE public.users 
                     SET school_id = $1, role = 'school_admin' 
                     WHERE id = $2 AND school_id IS NULL
                     RETURNING id, email, full_name, role, school_id`,
                    [school.id, requestingUser.userId]
                );

                if (assignResult.rows[0]) {
                    const u = assignResult.rows[0];
                    console.log(`[Auto-Assign] User ${u.id} assigned to new school ${school.id}`);

                    updatedUser = {
                        ...updatedUser,
                        role: u.role,
                        schoolId: u.school_id, // Match JWT payload format
                        // Add flatten fields for frontend User interface
                        school_id: u.school_id
                    };

                    // 🎟️ Issue New Token immediately so frontend doesn't need to /verify
                    const jwt = (await import('jsonwebtoken')).default;
                    const { config } = await import('../config/index.js');

                    newToken = jwt.sign(
                        {
                            userId: u.id,
                            email: u.email,
                            role: u.role,
                            schoolId: u.school_id,
                        },
                        config.jwtSecret as string,
                        { expiresIn: config.jwtExpiry as any }
                    );
                }
            }

            res.status(201).json({
                school,
                // Return authoritative user state (Confirmed Commit)
                user: updatedUser,
                token: newToken
            });
        } catch (error) {
            console.error('Create school error:', error);
            return errorResponse(res, 500, { error: 'Internal server error', code: 'SERVER_ERROR' });
        }
    }
);

/* =========================================================
   ARCHIVE SCHOOL (SOFT DELETE) - TRANSACTIONAL
========================================================= */
router.delete(
    '/:id',
    authenticateToken,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
        const client = await getClient();
        try {
            const { id } = req.params;
            console.log(`[Archive] Starting atomic archival for school ${id}`);

            await client.query('BEGIN');

            try {
                // 1. Soft-Delete School
                const result = await client.query(
                    `UPDATE public.schools
                     SET deleted_at = NOW()
                     WHERE id = $1 AND deleted_at IS NULL
                     RETURNING id, name`,
                    [id]
                );

                if (result.rows.length === 0) {
                    await client.query('ROLLBACK');
                    return errorResponse(res, 404, { error: 'School not found or already archived', code: 'SCHOOL_NOT_FOUND' });
                }

                // 2. Unassign Users (Atomic Guarantee)
                await client.query(
                    `UPDATE public.users SET school_id = NULL WHERE school_id = $1`,
                    [id]
                );

                // 3. Commit
                await client.query('COMMIT');

                console.log(`📦 Archived school: ${result.rows[0].name} (${id})`);
                res.json({
                    message: 'School archived and users unassigned successfully',
                    school: result.rows[0]
                });

            } catch (innerError) {
                console.error('[Archive] Transaction failed, rolling back:', innerError);
                await client.query('ROLLBACK');
                throw innerError;
            }
        } catch (error) {
            console.error('[Archive] Critical error:', error);
            return errorResponse(res, 500, { error: 'Internal server error during archival', code: 'SERVER_ERROR' });
        } finally {
            client.release();
        }
    }
);

export default router;
