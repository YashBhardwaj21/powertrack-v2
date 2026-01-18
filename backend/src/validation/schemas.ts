import { z } from 'zod';

// ==========================================
// AUTH SCHEMAS
// ==========================================

// Password strength regex (At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special)
const passwordStrongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
});

export const registerSchema = z.object({
    email: z.string().email('Invalid email address'),
    // Enforce complexity in production
    password: z.string().regex(passwordStrongRegex, 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'),
    full_name: z.string().min(2, 'Name must be at least 2 characters'),
    // role: Removed for security. All public registrations are 'viewer' by default.
    school_id: z.string().uuid().optional().nullable()
});

// ==========================================
// TELEMETRY SCHEMAS
// ==========================================

export const telemetryIngestSchema = z.object({
    ts: z.number().int().positive().describe('Unix timestamp in seconds').optional(),

    // Core electrical params - MUST be numbers, no strings allowed
    power_w: z.number().finite(),
    voltage: z.number().finite().nonnegative(),
    current_a: z.number().finite().nonnegative(),

    // Optional/Derived
    daily_kwh: z.number().nonnegative().optional(),
    total_kwh: z.number().nonnegative().optional(),
    temp_c: z.number().finite().optional(),
    irradiance_wm2: z.number().nonnegative().optional(),
    load_kw: z.number().nonnegative().optional(),
    grid_import_kw: z.number().nonnegative().optional(),
    grid_export_kw: z.number().nonnegative().optional(),

    weather_condition: z.string().optional()
}).passthrough(); // Allow extra fields for device-specific logging if needed, but they won't be strictly validated

// ==========================================
// SCHOOL SCHEMAS
// ==========================================

export const createSchoolSchema = z.object({
    name: z.string().min(3),
    type: z.string(),
    district: z.string(),
    // Accept standard lat/lng
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    total_capacity_kwp: z.number().positive(),
    total_cost_idr: z.number().nonnegative(),
    device_profile_id: z.string().uuid().optional().nullable() // Optional at creation
});
