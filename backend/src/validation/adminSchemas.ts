import { z } from 'zod';

export const assignDeviceProfileSchema = z.object({
    device_profile_id: z.string().uuid({ message: "Invalid device_profile_id UUID" }).nullable(),
    // Allow unassigning logic if nullable, or strictly require uuid if that's the intent.
    // Based on usage, usually it's setting a profile.
});

export const assignUserSchema = z.object({
    user_id: z.string().uuid({ message: "Invalid user_id UUID" }),
    school_id: z.string().uuid({ message: "Invalid school_id UUID" }).nullable(),
    role: z.enum(['school_admin', 'viewer'], { message: "Invalid role" })
});

export const rotateApiKeySchema = z.object({}); // Empty body expected, or params validation handled by route param
