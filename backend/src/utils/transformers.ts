import { School } from '../types/index.js';

export function transformSchoolRow(row: any): School | null {
    if (!row) return null;

    return {
        ...row,
        coordinates: {
            lat: row.latitude !== null && row.latitude !== undefined ? parseFloat(row.latitude) : null,
            lng: row.longitude !== null && row.longitude !== undefined ? parseFloat(row.longitude) : null
        },
        // Remove raw fields to enforce single contract
        latitude: undefined,
        longitude: undefined,
    } as School;
}
