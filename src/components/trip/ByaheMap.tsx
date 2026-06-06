'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ByaheMapProps {
  originName: string;
  originCoords: { lat: number; lng: number } | null;
  destinationName: string;
  destinationCoords: { lat: number; lng: number } | null;
  stops: { id: string; stop_name: string; stop_note: string | null; lat?: number | null; lng?: number | null }[];
}

interface MarkerData {
  lat: number;
  lng: number;
  label: string;
  popup: string;
  colorClass: string;
  order: number;
}

export default function ByaheMap({
  originName,
  originCoords,
  destinationName,
  destinationCoords,
  stops
}: ByaheMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [markers, setMarkers] = useState<MarkerData[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Compile all markers — use direct coords when available, geocode by name as fallback
  useEffect(() => {
    let active = true;

    async function initializeMarkers() {
      setLoading(true);
      const list: MarkerData[] = [];

      // Add Origin
      if (originCoords?.lat && originCoords?.lng) {
        list.push({
          lat: originCoords.lat,
          lng: originCoords.lng,
          label: 'S',
          popup: `Starting Point: ${originName}`,
          colorClass: 'bg-accent-yellow text-primary',
          order: 0
        });
      }

      // Add Stops — prefer stored coords, fall back to geocoding by name
      if (stops && stops.length > 0) {
        const stopPromises = stops.map(async (stop, idx) => {
          // Fast path: coordinates already stored
          if (stop.lat && stop.lng) {
            return {
              lat: stop.lat,
              lng: stop.lng,
              label: `${idx + 1}`,
              popup: `Stop ${idx + 1}: ${stop.stop_name}${stop.stop_note ? ` — ${stop.stop_note}` : ''}`,
              colorClass: 'bg-accent-blue text-white',
              order: idx + 1
            } as MarkerData;
          }

          // Fallback: geocode by name (legacy stops without coordinates)
          try {
            const res = await fetch(`/api/locations/search?q=${encodeURIComponent(stop.stop_name)}`);
            if (res.ok) {
              const data = await res.json();
              const match = data.find((d: any) => d.structured?.lat && d.structured?.lng);
              if (match) {
                return {
                  lat: parseFloat(match.structured.lat),
                  lng: parseFloat(match.structured.lng),
                  label: `${idx + 1}`,
                  popup: `Stop ${idx + 1}: ${stop.stop_name}${stop.stop_note ? ` — ${stop.stop_note}` : ''}`,
                  colorClass: 'bg-accent-blue text-white',
                  order: idx + 1
                } as MarkerData;
              }
            }
          } catch (e) {
            console.error(`Failed to geocode stop "${stop.stop_name}":`, e);
          }
          return null;
        });

        const resolvedStops = await Promise.all(stopPromises);
        resolvedStops.forEach((item) => {
          if (item) list.push(item);
        });
      }

      // Add Destination
      if (destinationCoords?.lat && destinationCoords?.lng) {
        list.push({
          lat: destinationCoords.lat,
          lng: destinationCoords.lng,
          label: 'D',
          popup: `Destination: ${destinationName}`,
          colorClass: 'bg-accent-coral text-white',
          order: 999
        });
      }

      if (active) {
        list.sort((a, b) => a.order - b.order);
        setMarkers(list);
        setLoading(false);
      }
    }

    initializeMarkers();

    return () => {
      active = false;
    };
  }, [originName, originCoords, destinationName, destinationCoords, stops]);

  // 2. Initialize and update Leaflet Map
  useEffect(() => {
    if (loading || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultCenter: [number, number] = [14.5995, 120.9842];
    const initialCenter = markers.length > 0 ? ([markers[0].lat, markers[0].lng] as [number, number]) : defaultCenter;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 12,
      scrollWheelZoom: false
    });

    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Plot neobrutalist custom markers
    const markerGroup = L.featureGroup();

    markers.forEach((m) => {
      const customIcon = L.divIcon({
        html: `<div class="flex items-center justify-center w-6 h-6 rounded-full border-2 border-primary font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${m.colorClass}">${m.label}</div>`,
        className: 'custom-neobrutalist-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
      });

      const leafletMarker = L.marker([m.lat, m.lng], { icon: customIcon })
        .bindPopup(`<div class="font-sans font-bold text-xs p-1">${m.popup}</div>`)
        .addTo(map);

      markerGroup.addLayer(leafletMarker);
    });

    // Draw route polyline
    if (markers.length > 1) {
      const polylinePoints = markers.map((m) => [m.lat, m.lng] as [number, number]);
      L.polyline(polylinePoints, {
        color: '#1a1a1a',
        weight: 4,
        opacity: 0.9,
        dashArray: '8, 8',
        lineJoin: 'round'
      }).addTo(map);
    }

    // Fit bounds to show all markers
    if (markers.length > 0) {
      map.fitBounds(markerGroup.getBounds(), {
        padding: [40, 40],
        maxZoom: 14
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [markers, loading]);

  return (
    <div className="w-full h-full relative min-h-[300px] bg-soft-beige flex items-center justify-center">
      {loading && (
        <div className="absolute inset-0 bg-soft-beige/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
          <div className="w-8 h-8 border-4 border-primary border-t-accent-yellow rounded-full animate-spin"></div>
          <span className="font-bold text-xs text-secondary uppercase tracking-wider">Drawing Interactive Byahe Map...</span>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full min-h-[300px] z-0" />
    </div>
  );
}
