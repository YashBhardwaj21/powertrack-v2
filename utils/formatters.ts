/**
 * Global formatting utilities for PowerTrack V2
 * Handles unit consistency, zero-value states, and currency formatting.
 */

// Format Currency: Rp 1,500,000
export const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return 'Waiting for data';
    if (value === 0) return 'Rp 0'; // True zero is valid for cost sometimes, but usually means no data if context implies.

    // For large numbers, drop decimals
    const options: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    };

    return new Intl.NumberFormat('id-ID', options).format(value).replace('Rp', 'Rp ');
};

// Format Power: 12.5 kW
export const formatPower = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '—';
    if (value === 0) return '0.0 kW'; // Distinguish true zero generation (night) vs null
    return `${value.toFixed(1)} kW`;
};

// Format Energy: 123.45 kWh
export const formatEnergy = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '—';
    if (value === 0) return '0.00 kWh';
    return `${value.toFixed(2)} kWh`;
};

// Format CO2: 1,234 kg
export const formatCO2 = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '—';
    if (value === 0) return '0 kg';
    return `${Math.round(value).toLocaleString()} kg`;
};

// Format Percentage: 12.5%
export const formatPercentage = (value: number | undefined | null): string => {
    if (value === undefined || value === null) return '—';
    return `${value.toFixed(1)}%`;
};

// Helper to determine if a value represents "Empty/Waiting" state
export const isWaitingForData = (value: number | undefined | null): boolean => {
    return value === undefined || value === null;
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
