/**
 * Global formatting utilities for PowerTrack V2
 * Handles unit consistency, zero-value states, and currency formatting.
 */

// Format Currency: Rp 1,500,000
// Helper to safely convert input to number
const safeNumber = (value: any): number | null => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
};

// Format Currency: Rp 1,500,000
export const formatCurrency = (value: number | string | undefined | null): string => {
    const num = safeNumber(value);
    if (num === null) return 'Waiting for data';
    if (num === 0) return 'Rp 0';

    // For large numbers, drop decimals
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    };

    return new Intl.NumberFormat('id-ID', options).format(num).replace('Rp', 'Rp ');
};

// Format Power: 12.5 kW
export const formatPower = (value: number | string | undefined | null): string => {
    const num = safeNumber(value);
    if (num === null) return '—';
    if (num === 0) return '0.00 kW';
    return `${num.toFixed(2)} kW`;
};

// Format Energy: 123.45 kWh
export const formatEnergy = (value: number | string | undefined | null): string => {
    const num = safeNumber(value);
    if (num === null) return '—';
    if (num === 0) return '0.00 kWh';
    return `${num.toFixed(2)} kWh`;
};

// Format CO2: 1,234 kg
export const formatCO2 = (value: number | string | undefined | null): string => {
    const num = safeNumber(value);
    if (num === null) return '—';
    if (num === 0) return '0 kg';
    return `${num.toFixed(2)} kg`;
};

// Format Percentage: 12.5%
export const formatPercentage = (value: number | string | undefined | null): string => {
    const num = safeNumber(value);
    if (num === null) return '—';
    return `${num.toFixed(1)}%`;
};

// Helper to determine if a value represents "Empty/Waiting" state
export const isWaitingForData = (value: number | string | undefined | null): boolean => {
    return safeNumber(value) === null;
};

// Format relative time (e.g. "Just now", "5 mins ago") or date
export const formatLastUpdated = (date: string | Date | undefined | null): string => {
    if (!date) return 'Never updated';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid date';

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    // Format as HH:MM if today
    if (d.toDateString() === now.toDateString()) {
        return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    return d.toLocaleDateString();
};
