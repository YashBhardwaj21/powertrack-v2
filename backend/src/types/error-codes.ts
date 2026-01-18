/**
 * Centralized Error Codes for PowerTrack API
 * 
 * All error responses must use these codes for consistency and machine-readability.
 */

export const ErrorCodes = {
    // Authentication & Authorization (4xx)
    INVALID_API_KEY: 'INVALID_API_KEY',
    SCHOOL_DEACTIVATED: 'SCHOOL_DEACTIVATED',
    DEVICE_PROFILE_REQUIRED: 'DEVICE_PROFILE_REQUIRED',
    SCHOOL_NOT_RESOLVED: 'SCHOOL_NOT_RESOLVED',

    // Data Integrity (5xx)
    CORRUPT_API_KEY_STATE: 'CORRUPT_API_KEY_STATE',

    // Validation (4xx)
    INVALID_PAYLOAD: 'INVALID_PAYLOAD',
    TIMESTAMP_OUT_OF_RANGE: 'TIMESTAMP_OUT_OF_RANGE',

    // Database (5xx)
    DATABASE_ERROR: 'DATABASE_ERROR',
    FK_VIOLATION: 'FK_VIOLATION',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Structured error response format
 */
export interface ApiErrorResponse {
    error: string;           // Human-readable message
    code: ErrorCode;         // Machine-readable code
    resolution?: string;     // Actionable guidance for user/admin
    details?: any;          // Additional context (dev mode only)
}

/**
 * Helper to create consistent error responses
 */
export function createErrorResponse(
    error: string,
    code: ErrorCode,
    resolution?: string,
    details?: any
): ApiErrorResponse {
    const response: ApiErrorResponse = { error, code };
    if (resolution) response.resolution = resolution;
    if (details && process.env.NODE_ENV !== 'production') response.details = details;
    return response;
}
