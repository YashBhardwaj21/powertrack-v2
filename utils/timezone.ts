/**
 * Timezone utility functions
 * Ensures all datetime formatting uses school-specific timezones
 */

export interface FormatOptions extends Intl.DateTimeFormatOptions {
    timeZone?: string;
}

/**
 * Format a timestamp in a specific timezone
 * @param isoString ISO 8601 timestamp string
 * @param timezone IANA timezone string (e.g., 'Asia/Jakarta', 'America/New_York')
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted string in the specified timezone
 */
export const formatInSchoolTZ = (
    isoString: string | Date,
    timezone: string,
    options: FormatOptions = {}
): string => {
    if (!isoString) return '';

    const date = typeof isoString === 'string' ? new Date(isoString) : isoString;

    return date.toLocaleString('en-US', {
        ...options,
        timeZone: timezone
    });
};

/**
 * Format time only (HH:MM) in school timezone
 */
export const formatTimeInSchoolTZ = (
    isoString: string | Date,
    timezone: string
): string => {
    return formatInSchoolTZ(isoString, timezone, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

/**
 * Format date only (MMM DD, YYYY) in school timezone
 */
export const formatDateInSchoolTZ = (
    isoString: string | Date,
    timezone: string
): string => {
    return formatInSchoolTZ(isoString, timezone, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

/**
 * Format full datetime in school timezone
 */
export const formatDateTimeInSchoolTZ = (
    isoString: string | Date,
    timezone: string
): string => {
    return formatInSchoolTZ(isoString, timezone, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

/**
 * Get current timestamp in school's timezone as Date object
 * Note: This returns a Date object but formatted operations should use the timezone
 */
export const nowInSchoolTZ = (timezone: string): Date => {
    // Get current time in school's timezone as a string, then parse back
    const nowStr = new Date().toLocaleString('en-US', { timeZone: timezone });
    return new Date(nowStr);
};

/**
 * Check if a timestamp is "fresh" (within threshold)
 * @param timestamp ISO timestamp
 * @param thresholdMs Freshness threshold in milliseconds
 */
export const isFresh = (timestamp: string | Date, thresholdMs: number = 5 * 60 * 1000): boolean => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return Date.now() - date.getTime() < thresholdMs;
};
