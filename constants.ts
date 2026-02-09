
export const INITIAL_METADATA = {
    electricity_rate_idr: 1444.7,
    carbon_intensity_kg_per_kwh: 0.85
};

export const WEATHER_ICONS: Record<string, string> = {
    'sunny': '☀️',
    'partly_cloudy': '⛅',
    'cloudy': '☁️',
    'rainy': '🌧️',
    'rain': '🌧️',     // Fallback
    'storm': '⛈️',    // Fallback
    'unknown': '❓'
};

export const FAULT_LABELS: Record<string, string> = {
    'none': 'System Nominal',
    'underperf': 'Underperformance',
    'comm_down': 'Gateway Offline',
    'ground_fault': 'Ground Fault',
    'arc_fault': 'DC Arc Detected'
};

export const BANDUNG_CENTER = { lat: -6.9175, lng: 107.6191 };

export const MODBUS_REGISTER_MAP: Record<string, { name: string; type: string; unit?: string }> = {
    '40071': { name: 'Line Voltage', type: 'uint16', unit: 'V' },
    '40083': { name: 'AC Power', type: 'uint16', unit: 'W' },
    '40107': { name: 'Panel Temp', type: 'int16', unit: 'C' }
};

export const TRANSLATIONS: Record<string, Record<string, string>> = {
    en: {
        dashboard: "Dashboard",
        schools: "Schools",
        total_power: "Total Power",
        daily_energy: "Energy Production",
        savings: "Est. Savings",
        co2: "CO₂ Avoided",
        live_telemetry: "Hardware Telemetry",
        exec_view: "Executive",
        eng_view: "Engineering"
    },
    id: {
        dashboard: "Dasbor",
        schools: "Sekolah",
        total_power: "Total Daya",
        daily_energy: "Produksi Energi",
        savings: "Est. Penghematan",
        co2: "CO₂ Dihindari",
        live_telemetry: "Telemetri Perangkat",
        exec_view: "Tampilan Eks.",
        eng_view: "Tampilan Tek."
    }
};
