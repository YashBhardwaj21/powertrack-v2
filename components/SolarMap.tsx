
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
        mapRef.current = L.map(containerRef.current).setView([20, 0], 2);

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

    const [geocodedLocations, setGeocodedLocations] = React.useState<Record<string, { lat: number, lng: number }>>({});

    // 🌍 Geocoding Effect: Look up missing coordinates based on District
    useEffect(() => {
        console.log('SolarMap Input Schools:', schools.map(s => ({ name: s.name, district: s.district, coords: s.coordinates })));

        const schoolsToGeocode = schools.filter(s => {
            const hasCoords = (s.coordinates?.lat !== undefined && s.coordinates?.lat !== null) ||
                ((s as any).latitude !== undefined && (s as any).latitude !== null);
            return !hasCoords && s.district && !geocodedLocations[s.district];
        });

        if (schoolsToGeocode.length === 0) return;

        const uniqueDistricts = Array.from(new Set(schoolsToGeocode.map(s => s.district!)));

        const fetchLocations = async () => {
            const newLocations: Record<string, { lat: number, lng: number }> = {};

            console.log(`[SolarMap] Attempting to geocode ${uniqueDistricts.length} districts via Nominatim...`);

            for (const district of uniqueDistricts) {
                try {
                    // 1s delay to respect OpenStreetMap Nominatim Usage Policy
                    await new Promise(r => setTimeout(r, 1000));

                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(district)}`);
                    const data = await response.json();

                    if (data && data.length > 0) {
                        newLocations[district] = {
                            lat: parseFloat(data[0].lat),
                            lng: parseFloat(data[0].lon)
                        };
                        console.log(`[SolarMap] Resolved '${district}' to ${data[0].lat}, ${data[0].lon}`);
                    } else {
                        console.warn(`[SolarMap] Could not find location for district: '${district}'`);
                    }
                } catch (e) {
                    console.error(`[SolarMap] Geocoding failed for '${district}':`, e);
                }
            }

            if (Object.keys(newLocations).length > 0) {
                setGeocodedLocations(prev => ({ ...prev, ...newLocations }));
            }
        };

        fetchLocations();
    }, [schools, geocodedLocations]); // Re-check when list updates or we cache a new one

    // Update markers when data changes
    useEffect(() => {
        if (!mapRef.current) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.remove());
        markersRef.current = [];

        schools.forEach(school => {
            try {
                // Defensive check: Ensure school ID exists
                if (!school || !school.id) return;

                const data = currentData.find(d => d.school_id === school.id);
                // Data might be missing (offline/new setup), but we should still map the school if location exists.
                // if (!data) return; // REMOVED to allow offline schools map visualization


                // Defensive Coordinates Access
                // 1. Try explicit Coords
                let lat = school.coordinates?.lat ?? (school as any).latitude;
                let lng = school.coordinates?.lng ?? (school as any).longitude;

                // 2. Fallback to Geocoded District
                if ((lat === undefined || lng === undefined || lat === null || lng === null) && school.district) {
                    const cached = geocodedLocations[school.district];
                    if (cached) {
                        lat = cached.lat;
                        lng = cached.lng;
                    }
                }

                if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
                    // Only warn once per session per school to avoid spam, or just skip silent
                    return;
                }

                const iconHtml = `
                <div class="relative flex items-center justify-center w-10 h-10 ${data ? 'bg-white' : 'bg-slate-200'} rounded-full border-2 ${data ? 'border-blue-600' : 'border-slate-400'} shadow-lg text-lg">
                   ${data ? (WEATHER_ICONS[data.weather_condition] || '☀️') : '❓'}
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
                        <div class="flex justify-between"><span>District:</span> <span class="font-medium">${school.district || 'N/A'}</span></div>
                        <div class="flex justify-between"><span>Power:</span> <span class="font-semibold">${(Number(data?.ac_power_kw) || 0).toFixed(2)} kW</span></div>
                        <div class="flex justify-between"><span>Energy:</span> <span class="font-semibold">${(Number(data?.daily_energy_kwh) || 0).toFixed(2)} kWh</span></div>
                        <div class="flex justify-between"><span>Status:</span> <span class="capitalize">${data ? (data.weather_condition || 'sunny').replace('_', ' ') : 'Offline / No Data'}</span></div>
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

        // Auto-center map if there are markers
        if (markersRef.current.length > 0) {
            const group = L.featureGroup(markersRef.current);
            mapRef.current.fitBounds(group.getBounds().pad(0.1));
        }
    }, [schools, currentData, geocodedLocations]);

    return (
        <div className="relative h-full w-full">
            <div ref={containerRef} className="absolute inset-0 z-0 bg-slate-100" />
        </div>
    );
};
