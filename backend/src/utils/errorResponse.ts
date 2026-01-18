import { Response } from 'express';

// Fix 23: Consistent Error Response Format

interface ErrorDetails {
    error: string;
    code?: string;
    resolution?: string;
    details?: any;
}

/**
 * Standardized error response helper.
 * Ensures all API errors follow a consistent schema: { error, code, resolution, details }
 */
export const errorResponse = (res: Response, status: number, { error, code, resolution, details }: ErrorDetails) => {
    // Log 5xx errors automatically to ensure visibility
    if (status >= 500) {
        console.error(`[API Error ${status}] ${code || 'UNKNOWN'}: ${error}`, details);
    }

    return res.status(status).json({
        error,
        code: code || 'INTERNAL_ERROR',
        resolution: resolution || 'Contact support if the issue persists',
        details
    });
};
