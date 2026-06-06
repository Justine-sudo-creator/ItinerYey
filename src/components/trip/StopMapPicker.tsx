'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type StopPin = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  note: string;
};

type StopMapPickerProps = {
  stops: StopPin[];
  onChange: (stops: StopPin[]) => void;
  /** Center map around destination when known */
  centerLat?: number | null;
  centerLng?: number | null;
  className?: string;
};

const PHILIPPINES_CENTER: [number, number] = [12.8797, 121.7740];

function buildNumberedIcon(num: number) {
  return L.divIcon({
    html: `
      <div style="
        width:32px;height:32px;border-radius:50%;
        background:#1a1a1a;color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-family:'Inter',sans-serif;font-weight:900;font-size:13px;
        border:2.5px solid #fff;
        box-shadow:2px 2px 0 rgba(0,0,0,0.65);
        cursor:pointer;
      ">${num}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

export default function StopMapPicker({ stops, onChange, centerLat, centerLng, className = '' }: StopMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const stopsRef = useRef<StopPin[]>(stops);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; region: string; structured?: { lat: number | null; lng: number | null } }>>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 150);
    }
  }, [isMaximized]);

  // Keep stopsRef in sync for use inside Leaflet event handlers
  useEffect(() => { stopsRef.current = stops; }, [stops]);

  // Reverse geocode a lat/lng to a human-readable name
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'en' } }
      );
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const a = data.address || {};
      return (
        a.amenity || a.tourism || a.shop || a.building ||
        a.road || a.neighbourhood || a.suburb ||
        data.display_name?.split(',')[0]?.trim() ||
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      );
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const center: [number, number] =
      centerLat && centerLng ? [centerLat, centerLng] : PHILIPPINES_CENTER;
    const zoom = centerLat && centerLng ? 16 : 6;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      scrollWheelZoom: true,
    });

    // OSM standard — shows individual shop, restaurant, and building names at zoom 16+
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Click to drop a pin
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      const id = Math.random().toString(36).slice(2, 9);
      // Optimistically add with coordinate name, then update with geocoded name
      const coordName = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const newStop: StopPin = { id, lat, lng, name: coordName, note: '' };
      const updated = [...stopsRef.current, newStop];
      onChange(updated);

      // Async name resolution — update name once ready
      const resolved = await reverseGeocode(lat, lng);
      onChange(stopsRef.current.map(s => s.id === id ? { ...s, name: resolved } : s));
    });

    mapRef.current = map;

    return () => {
      try {
        map.stop(); // cancel animations before removing
        map.remove();
      } catch (_) {
        // ignore cleanup errors
      }
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers with stops state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove markers no longer in stops
    Array.from(markersRef.current.entries()).forEach(([id, marker]) => {
      if (!stops.find(s => s.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add new markers and update numbers on all existing markers
    stops.forEach((stop, idx) => {
      const icon = buildNumberedIcon(idx + 1);
      const existing = markersRef.current.get(stop.id);
      if (existing) {
        existing.setIcon(icon);
      } else {
        const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(map);
        markersRef.current.set(stop.id, marker);
      }
    });
  }, [stops]);

  // Search bar logic
  const handleSearchInput = useCallback((val: string) => {
    setSearchQuery(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!val || val.length < 2) { setSearchResults([]); return; }
    searchDebounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/locations/search?q=${encodeURIComponent(val)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
  }, []);

  const handleSearchSelect = useCallback((result: typeof searchResults[0]) => {
    const lat = result.structured?.lat;
    const lng = result.structured?.lng;
    if (!lat || !lng || !mapRef.current) return;

    mapRef.current.setView([lat, lng], 16, { animate: true });

    const id = Math.random().toString(36).slice(2, 9);
    const newStop: StopPin = { id, lat, lng, name: result.name, note: '' };
    onChange([...stopsRef.current, newStop]);
    setSearchQuery('');
    setSearchResults([]);
  }, [onChange]);

  const updateStop = (id: string, field: 'name' | 'note', val: string) =>
    onChange(stops.map(s => s.id === id ? { ...s, [field]: val } : s));

  const removeStop = (id: string) => onChange(stops.filter(s => s.id !== id));

  return (
    <div className={`flex flex-col gap-0 border-2 border-border-dark rounded-xl overflow-hidden shadow-hard ${className || 'h-full'}`}>
      {/* Search bar */}
      <div className="relative shrink-0 bg-white border-b-2 border-border-dark z-20">
        <div className="flex items-center px-3 gap-2">
          <span className="text-base">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder="Search for a place to pin, or click directly on the map"
            className="w-full py-3 text-sm font-medium bg-transparent outline-none placeholder-secondary/60"
          />
          {searching && (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
        </div>
        {/* Search dropdown */}
        {searchResults.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-[9999] bg-white border-2 border-t-0 border-border-dark max-h-48 overflow-y-auto shadow-hard">
            {searchResults
              .filter(r => r.structured?.lat && r.structured?.lng)
              .slice(0, 6)
              .map(r => (
                <li
                  key={r.id}
                  onClick={() => handleSearchSelect(r)}
                  className="px-4 py-2.5 hover:bg-accent-blue hover:text-white cursor-pointer border-b border-border-dark/10 last:border-0 transition-colors"
                >
                  <div className="font-bold text-sm">📍 {r.name}</div>
                  {r.region && <div className="text-xs opacity-70">{r.region}</div>}
                </li>
              ))
            }
          </ul>
        )}
      </div>

      {/* Map */}
      <div className={`relative z-10 transition-all duration-200 ${isMaximized ? 'flex-1 min-h-[300px]' : 'shrink-0 h-[40vh] md:h-[50%] min-h-[200px]'}`}>
        <div
          ref={mapContainerRef}
          className="w-full h-full"
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsMaximized(!isMaximized);
          }}
          className="absolute bottom-4 right-4 z-[400] w-12 h-12 bg-white rounded-full border-2 border-border-dark shadow-hard flex items-center justify-center text-xl hover:bg-accent-yellow active:scale-95 transition-all"
          title={isMaximized ? "Show stops list" : "Maximize map"}
        >
          {isMaximized ? '📜' : '🗺️'}
        </button>
        {stops.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
            <div className="bg-white/90 backdrop-blur-sm border-2 border-border-dark rounded-xl px-5 py-3 shadow-hard text-center">
              <p className="font-black text-sm text-primary">Click anywhere on the map</p>
              <p className="text-xs text-secondary mt-0.5">or search above to drop a stop pin</p>
            </div>
          </div>
        )}
      </div>

      {/* Stop list */}
      {!isMaximized && stops.length > 0 && (
        <div className="flex-1 overflow-y-auto bg-white border-t-2 border-border-dark divide-y-2 divide-border-dark/20 z-10">
          {stops.map((stop, idx) => (
            <div key={stop.id} className="flex items-start gap-3 px-4 py-3">
              {/* Number badge */}
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center mt-1 border border-white shadow-sm">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <input
                  type="text"
                  value={stop.name}
                  onChange={e => updateStop(stop.id, 'name', e.target.value)}
                  placeholder="Place name"
                  className="w-full text-sm font-bold bg-transparent border-b border-border-dark/20 pb-0.5 outline-none focus:border-accent-blue transition-colors"
                />
                <input
                  type="text"
                  value={stop.note}
                  onChange={e => updateStop(stop.id, 'note', e.target.value)}
                  placeholder="Add a note... (optional)"
                  className="w-full text-xs text-secondary bg-transparent border-b border-border-dark/10 pb-0.5 outline-none focus:border-accent-blue transition-colors"
                />
              </div>
              <button
                type="button"
                onClick={() => removeStop(stop.id)}
                className="flex-shrink-0 w-7 h-7 rounded-md bg-accent-coral/10 hover:bg-accent-coral text-accent-coral hover:text-white font-black text-sm border border-accent-coral/30 transition-all flex items-center justify-center mt-0.5"
                aria-label="Remove stop"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
