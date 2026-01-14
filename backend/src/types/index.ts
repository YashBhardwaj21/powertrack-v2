export interface User {
    id: string;
    email: string;
    password_hash: string;
    full_name: string | null;
    role: 'admin' | 'school_admin' | 'viewer';
    school_id: string | null;
    created_at: Date;
    updated_at: Date;
    last_login: Date | null;
}

export interface School {
    id: string;
    name: string;
    type: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
    total_capacity_kwp: number | null;
    total_cost_idr: number | null;
    api_key: string;
    created_at: Date;
    updated_at: Date;
}

export interface Telemetry {
    id: number;
    school_id: string;
    timestamp: Date;
    ac_power_kw: number | null;
    ac_voltage: number | null;
    ac_current: number | null;
    total_energy_kwh: number | null;
    daily_energy_kwh: number | null;
    irradiance_wm2: number | null;
    panel_temp_c: number | null;
    performance_ratio: number | null;
    efficiency_percent: number | null;
    load_kw: number | null;
    grid_export_kw: number | null;
    grid_import_kw: number | null;
    weather_condition: string | null;
    fault: 'none' | 'underperf' | 'comm_down' | 'ground_fault' | 'arc_fault';
}

export interface Alert {
    id: string;
    school_id: string;
    timestamp: Date;
    type: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    resolved: boolean;
    resolved_at: Date | null;
    created_at: Date;
}

export interface LeaderboardEntry {
    school_id: string;
    school_name: string;
    total_energy_kwh: number;
    co2_reduced_kg: number;
    rank: number;
}

export interface DashboardSummary {
    schools: School[];
    current_data: Telemetry[];
    alerts: Alert[];
    community_stats: {
        active_peers: number;
        total_surplus_kw: number;
        total_deficit_kw: number;
        net_grid_flow_kw: number;
        sharing_potential_idr: number;
    };
    metadata: {
        electricity_rate_idr: number;
        carbon_intensity_kg_per_kwh: number;
    };
    historical_data: Array<{
        date: string;
        total_energy_kwh: number;
    }>;
    financial_stats: {
        total_capex_idr: number;
        total_savings_idr: number;
        payback_years: number;
        irr_percent: number;
        lcoe_idr_per_kwh: number;
        payback_progress_percent: number;
    };
    storage_stats: {
        db_engine: string;
        storage_usage_mb: number;
        total_points_stored: number;
        compression_ratio: number;
        ingestion_rate_mps: number;
        retention_policies: {
            raw: string;
            aggregated: string;
        };
        last_rollup_job: string;
    };
    model_metrics: {
        version: string;
        last_trained: string;
        rmse: number;
        mape: number;
        residuals_trend: number[];
        anomaly_detection: {
            precision: number;
            recall: number;
            f1_score: number;
            total_anomalies_detected: number;
        };
    };
}

export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    schoolId: string | null;
}
