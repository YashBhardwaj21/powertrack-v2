import React, { useEffect, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { SolarMap } from './SolarMap';
import { fetchPublicLeaderboard } from '../services/dataService';

interface PublicMapProps {
    loading?: boolean;
}

export const PublicMap: React.FC<PublicMapProps> = ({ loading = false }) => {
    const [schools, setSchools] = useState<any[]>([]);
    const [currentData, setCurrentData] = useState<any[]>([]);

    useEffect(() => {
        const loadMapData = async () => {
            try {
                const result = await fetchPublicLeaderboard();
                console.log('[PublicMap] Raw leaderboard result:', result);

                if (result) {
                    // Transform leaderboard data - use district for geocoding
                    const schoolsData = result.leaderboard.map((item: any) => {
                        console.log('[PublicMap] Processing school:', {
                            name: item.school_name,
                            district: item.district
                        });

                        return {
                            id: item.school_id,
                            name: item.school_name,
                            district: item.district || 'Unknown'
                            // Will be geocoded by SolarMap based on district
                        };
                    });

                    const telemetryData = result.leaderboard.map((item: any) => ({
                        school_id: item.school_id,
                        ac_power_kw: item.current_power_kw || 0,
                        daily_energy_kwh: item.total_energy_kwh || 0,
                        weather_condition: item.weather_condition || 'sunny'
                    }));

                    console.log('[PublicMap] Transformed schools (will geocode by district):', schoolsData);
                    setSchools(schoolsData);
                    setCurrentData(telemetryData);
                }
            } catch (error) {
                console.error('Failed to load map data:', error);
            }
        };

        loadMapData();
    }, []);

    return (
        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 ring-1 ring-slate-900/5 mb-8">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-6 h-6 text-blue-500" />
                        Network Coverage Map
                    </h2>
                    <p className="text-slate-500 mt-1 text-sm">Geographic distribution of all connected solar installations</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-md">
                    <MapPin className="w-3.5 h-3.5" />
                    {schools.length} Active Sites
                </div>
            </div>

            <div className="h-[500px] w-full bg-slate-50/50 relative">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 animate-pulse gap-4">
                        <Loader2 className="w-8 h-8 opacity-50 animate-spin" />
                        <span>Loading map...</span>
                    </div>
                ) : (
                    <SolarMap schools={schools} currentData={currentData} />
                )}
            </div>
        </div>
    );
};
