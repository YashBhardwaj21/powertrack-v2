export interface School {
  id: string;
  name: string;
  type: string;
  district: string;
  total_capacity_kwp: number;
  total_cost_idr: number;
  api_key?: string; // Only visible to owners
  coordinates: {
    lat: number;
    lng: number;
  };
  // Removed flat latitude/longitude to enforce structured access
}

export interface Profile {
  id: string;
  school_id: string;
  full_name: string;
}

export interface EnergyLog {
  school_id: string;
  created_at: string;
  power_w: number;
  voltage: number;
  current_a: number;
  daily_kwh: number;
}

export interface PublicLeaderboardEntry {
  school_id: string; // Added to support filtering
  school_name: string;
  district: string; // Added for map visualization
  total_energy_kwh: number;
  co2_reduced_kg: number;
  rank: number;
}

export interface AuthState {
  user: any | null;
  profile: Profile | null;
  school: School | null;
  loading: boolean;
}

export type FaultType = 'none' | 'underperf' | 'comm_down' | 'ground_fault' | 'arc_fault';

export interface Telemetry {
  school_id: string;
  timestamp: string;
  ac_power_kw: number;
  ac_voltage: number;
  ac_current: number;
  total_energy_kwh: number;
  daily_energy_kwh: number;
  irradiance_wm2: number;
  panel_temp_c: number;
  performance_ratio: number;
  efficiency_percent: number;
  load_kw: number;
  grid_export_kw: number;
  grid_import_kw: number;
  weather_condition: string;
  fault: FaultType;
  quality_score?: number;
  is_backfill?: boolean;
  is_suspect_time?: boolean;
}

export interface Alert {
  id: string;
  school_id: string;
  school_name: string;
  timestamp: string;
  type: FaultType;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export interface CommunityStats {
  active_peers: number;
  total_surplus_kw: number;
  total_deficit_kw: number;
  net_grid_flow_kw: number;
  sharing_potential_idr: number;
}

export interface SchoolMetadata {
  electricity_rate_idr: number;
  carbon_intensity_kg_per_kwh: number;
}

export interface FinancialStats {
  total_capex_idr: number;
  total_savings_idr: number;
  payback_years: number;
  irr_percent: number;
  lcoe_idr_per_kwh: number;
  payback_progress_percent: number;
}

export interface StorageStats {
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
}

export interface ModelMetrics {
  version: string;
  last_trained: string;
  rmse: number;
  mape: number;
  residuals_trend: number[];
  anomaly_detection: {
    precision: number;
    recall: number;
    f1_score: number;
    co2_avoided_kg: number;
    trees_planted: number;
    car_km_avoided: number;
    data_sufficiency?: {
      days_observed: number;
      is_projected: boolean;
    };
    total_anomalies_detected: number;
  };
}

export interface HistoricalData {
  hour: string;
  avg_power: number | null;
  energy: number | null;
}

export interface DashboardData {
  schools: School[];
  current_data: Telemetry[];
  alerts: Alert[];
  community_stats: CommunityStats;
  metadata: SchoolMetadata;
  historical_data: HistoricalData[]; // Deprecated
  daily_historical: Array<{ date: string; total_energy_kwh: number }>;
  hourly_historical: Array<{ hour: string; avg_power: number; energy: number; avg_load: number; avg_import: number; avg_export: number }>;
  financial_stats: FinancialStats;
  storage_stats: StorageStats;
  leaderboard_stats: PublicLeaderboardEntry[]; // Added
  model_metrics: ModelMetrics;
  needs_school_assignment?: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'school_admin' | 'viewer';
  school_id: string | null;
  school_name?: string; // For admin list
  created_at: string;
  last_login: string | null;
}
