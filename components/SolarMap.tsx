
import React, { useEffect, useRef } from 'react';
import { School, Telemetry } from '../types';
import L from 'leaflet';
import { WEATHER_ICONS } from '../constants';

// We need to fix the default icon issue in Leaflet with Webpack/React
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

export interface SolarMapProps {
    schools?: School[];
    currentData?: Telemetry[];
}

export const SolarMap: React.FC<SolarMapProps> = ({ schools = [], currentData = [] }) => {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<L.Marker[]>([]);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        // Initialize map
        mapRef.current = L.map(containerRef.current).setView([-6.92, 107.62], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(mapRef.current);

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Update markers when data changes
    useEffect(() => {
        if (!mapRef.current) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        schools.forEach(school => {
            try {
                // Defensive check: Ensure school ID and coordinates exist
                if (!school || !school.id) return;

                const data = currentData.find(d => d.school_id === school.id);
                // Data might be missing, but we still render the school marker (greyed out maybe?)
                // If data missing, we usually just skip or show empty.
                // Current logic was: if (!data) return;
                // Let's keep it, but ensure no crash.
                if (!data) return;

                // Defensive Coordinates Access
                // Prioritize 'coordinates' object (new contract), fallback to flat props if legacy data/cache exists
                const lat = school.coordinates?.lat ?? (school as any).latitude;
                const lng = school.coordinates?.lng ?? (school as any).longitude;

                if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
                    console.warn(`[SolarMap] Skipping school ${school.name}: Invalid coordinates`);
                    return;
                }

                const iconHtml = `
                <div class="relative flex items-center justify-center w-10 h-10 bg-white rounded-full border-2 border-blue-600 shadow-lg text-lg">
                   ${WEATHER_ICONS[data.weather_condition] || '☀️'}
                </div>
            `;

                const customIcon = L.divIcon({
                    html: iconHtml,
                    className: 'bg-transparent border-none',
                    iconSize: [40, 40],
                    iconAnchor: [20, 20]
                });

                const popupContent = `
                <div class="p-2 font-sans min-w-[200px]">
                    <h3 class="font-bold text-blue-900 mb-2 border-b pb-1">${school.name}</h3>
                    <div class="space-y-1 text-sm text-gray-700">
                        <div class="flex justify-between"><span>Power:</span> <span class="font-semibold">${(Number(data.ac_power_kw) || 0).toFixed(2)} kW</span></div>
                        <div class="flex justify-between"><span>Energy:</span> <span class="font-semibold">${(Number(data.daily_energy_kwh) || 0).toFixed(1)} kWh</span></div>
                        <div class="flex justify-between"><span>Status:</span> <span class="capitalize">${(data.weather_condition || 'sunny').replace('_', ' ')}</span></div>
                    </div>
                </div>
            `;

                const marker = L.marker([lat, lng], { icon: customIcon })
                    .bindPopup(popupContent)
                    .addTo(mapRef.current!);

                markersRef.current.push(marker);
            } catch (err) {
                console.error(`[SolarMap] Error rendering marker for school ${school?.name}:`, err);
            }
        });

    }, [schools, currentData]);

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="absolute inset-0 z-0 bg-slate-100" />
        </div>
    );
};
