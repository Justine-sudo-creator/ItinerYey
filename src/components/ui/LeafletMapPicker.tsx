'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
// @ts-ignore - Leaflet CSS is a side-effect stylesheet import processed by Next.js loaders
import 'leaflet/dist/leaflet.css';
import { Search } from 'lucide-react';

interface LeafletMapPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onSelect: (lat: number, lng: number) => void;
  label?: string;
  existingPins?: Array<{ lat: number; lng: number; label: string; role: 'origin' | 'destination' | 'boarding' | 'drop_off' }>;
}

export default function LeafletMapPicker({
  initialLat,
  initialLng,
  onSelect,
  label,
  existingPins = []
}: LeafletMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [lat, setLat] = useState<number>(initialLat || 14.5995);
  const [lng, setLng] = useState<number>(initialLng || 120.9842);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const startLat = initialLat || 14.5995;
    const startLng = initialLng || 120.9842;
    const startZoom = initialLat && initialLng ? 16 : 11;

    const map = L.map(mapContainerRef.current).setView([startLat, startLng], startZoom);
    mapRef.current = map;

    // Standard OpenStreetMap layer
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    });

    // Satellite layer (Google Hybrid)
    const satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      attribution: '&copy; Google',
      maxZoom: 21
    });

    // Add default layer
    osmLayer.addTo(map);

    // Layer switcher control
    const baseMaps = {
      "Map 🗺️": osmLayer,
      "Satellite 📡": satelliteLayer
    };
    L.control.layers(baseMaps, {}, { position: 'topright' }).addTo(map);

    // Render other already pinned points as reference markers
    existingPins.forEach(pin => {
      const roleColors = {
        origin: '#3B82F6',       // Blue
        destination: '#8B5CF6',  // Purple
        boarding: '#F59E0B',     // Yellow
        drop_off: '#FF5A5F'      // Coral
      };
      const color = roleColors[pin.role] || '#78716C';

      const refIcon = L.divIcon({
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background-color: ${color};
            border: 2px solid #1C1917;
            border-radius: 50%;
            box-shadow: 1px 1px 0px #1C1917;
            opacity: 0.75;
            display: flex;
            align-items: center;
            justify-content: center;
          "></div>
        `,
        className: '',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      L.marker([pin.lat, pin.lng], { icon: refIcon })
        .bindTooltip(`<b>${pin.label}</b> (Already Pinned)`, { direction: 'top' })
        .addTo(map);
    });

    const customIcon = L.divIcon({
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background-color: #FAFAF9;
          border: 3px solid #1C1917;
          border-radius: 50%;
          box-shadow: 4px 4px 0px #1C1917;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            width: 12px;
            height: 12px;
            background-color: #FF5A5F;
            border: 2px solid #1C1917;
            border-radius: 50%;
          "></div>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    });

    const marker = L.marker([startLat, startLng], {
      icon: customIcon,
      draggable: true
    }).addTo(map);
    markerRef.current = marker;

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;
      marker.setLatLng([clickLat, clickLng]);
      setLat(clickLat);
      setLng(clickLng);
    });

    marker.on('dragend', () => {
      const position = marker.getLatLng();
      setLat(position.lat);
      setLng(position.lng);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialLat, initialLng, existingPins]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      // Nominatim OSM Search, bounded to the Philippines
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=ph`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Failed to search OSM:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (result: any) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    
    setLat(newLat);
    setLng(newLng);
    
    // Move map and marker
    mapRef.current?.setView([newLat, newLng], 16);
    markerRef.current?.setLatLng([newLat, newLng]);
    
    setSearchResults([]);
    setSearchQuery(''); // clear query after selection to prevent confusion
  };

  const handleConfirm = () => {
    onSelect(lat, lng);
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {label && <p className="text-sm font-bold text-secondary uppercase tracking-wider">{label}</p>}
      
      {/* OSM Search Bar */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 relative z-[1000]">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-secondary" />
          </div>
          <input 
            type="text" 
            placeholder="Search OpenStreetMap (e.g. SM North EDSA)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full border-2 border-border-dark pl-9 pr-3 py-2 text-sm rounded bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-coral"
          />
        </div>
        <button 
          type="submit" 
          disabled={isSearching}
          className="bg-primary text-white font-bold px-4 py-2 rounded border-2 border-border-dark text-sm hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 shrink-0"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <ul className="absolute top-full mt-1 left-0 right-0 bg-white border-2 border-border-dark rounded shadow-hard max-h-64 overflow-y-auto z-[1001]">
            {searchResults.map((res, i) => (
              <li 
                key={res.place_id || i} 
                className="p-3 border-b border-border-dark/10 hover:bg-soft-beige cursor-pointer text-xs flex flex-col gap-1 transition-colors"
                onClick={() => handleSelectResult(res)}
              >
                <span className="font-bold text-primary">{res.name || res.display_name.split(',')[0]}</span>
                <span className="text-secondary line-clamp-1">{res.display_name}</span>
              </li>
            ))}
          </ul>
        )}
      </form>

      {/* Map Container */}
      <div 
        ref={mapContainerRef} 
        className="w-full flex-grow border-2 border-border-dark rounded bg-soft-beige shadow-hard-sm"
        style={{ height: '400px', zIndex: 10 }}
      />
      
      {/* Coordinate Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border-2 border-border-dark rounded shadow-sm">
        <div className="text-xs font-mono text-secondary">
          Lat: <strong className="text-primary">{lat.toFixed(6)}</strong> | Lng: <strong className="text-primary">{lng.toFixed(6)}</strong>
        </div>
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full sm:w-auto bg-primary hover:bg-primary/95 text-white font-bold px-6 py-2 border-2 border-border-dark shadow-hard-sm hover:translate-y-[-2px] active:translate-y-[1px] transition-transform text-sm"
        >
          Confirm Location
        </button>
      </div>
    </div>
  );
}
