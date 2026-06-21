'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
// @ts-ignore - Leaflet CSS is a side-effect stylesheet import processed by Next.js loaders
import 'leaflet/dist/leaflet.css';
import { Route, RouteSegment } from '@/types/supabase';

interface LeafletRouteMapProps {
  route: Route;
  segments: RouteSegment[];
  compact?: boolean;
}

export default function LeafletRouteMap({ route, segments, compact }: LeafletRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Standard Haversine formula to compute great-circle distance in meters
  function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default to Philippines if no coordinates exist
    const defaultLat = 14.5995;
    const defaultLng = 120.9842;
    
    // We'll collect all valid coordinates to build bounding bounds
    const validCoords: L.LatLngTuple[] = [];

    // Group points by coordinate key (lat, lng rounded to 6 decimal places to handle minor float differences)
    interface RoutePoint {
      role: 'origin' | 'destination' | 'boarding' | 'drop_off';
      segmentIndex?: number;
      locationName: string;
    }

    const pointsMap: {
      [key: string]: {
        lat: number;
        lng: number;
        types: RoutePoint[];
      }
    } = {};

    const addPoint = (
      lat: number | null | undefined,
      lng: number | null | undefined,
      role: 'origin' | 'destination' | 'boarding' | 'drop_off',
      locationName: string,
      segmentIndex?: number
    ) => {
      if (lat === null || lat === undefined || lng === null || lng === undefined) return;
      
      const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      validCoords.push([lat, lng]);
      
      if (!pointsMap[key]) {
        pointsMap[key] = {
          lat,
          lng,
          types: []
        };
      }
      pointsMap[key].types.push({ role, segmentIndex, locationName });
    };

    // Add points in chronological order of the route flow
    addPoint(route.origin_lat, route.origin_lng, 'origin', route.origin);
    
    segments.forEach((seg, idx) => {
      addPoint(seg.boarding_lat, seg.boarding_lng, 'boarding', seg.boarding_name || '', idx);
      addPoint(seg.drop_off_lat, seg.drop_off_lng, 'drop_off', seg.drop_off_name || '', idx);
    });

    addPoint(route.destination_lat, route.destination_lng, 'destination', route.destination);

    // Initialize map with first coordinate or default
    const startLat = validCoords.length > 0 ? validCoords[0][0] : defaultLat;
    const startLng = validCoords.length > 0 ? validCoords[0][1] : defaultLng;

    const map = L.map(mapContainerRef.current).setView([startLat, startLng], 12);
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

    // Map roles to colors
    const roleColors = {
      origin: '#3B82F6',       // Blue
      destination: '#8B5CF6',  // Purple
      boarding: '#F59E0B',     // Yellow
      drop_off: '#FF5A5F'      // Coral
    };

    // Render unique markers
    Object.values(pointsMap).forEach(({ lat, lng, types }) => {
      // 1. Determine background style (single color or gradient if overlapping)
      const uniqueColors = Array.from(new Set(types.map(t => roleColors[t.role])));
      let backgroundStyle = '';
      if (uniqueColors.length === 1) {
        backgroundStyle = uniqueColors[0];
      } else if (uniqueColors.length === 2) {
        backgroundStyle = `linear-gradient(135deg, ${uniqueColors[0]} 50%, ${uniqueColors[1]} 50%)`;
      } else {
        backgroundStyle = `conic-gradient(${uniqueColors.map((c, i) => `${c} ${i * (360 / uniqueColors.length)}deg ${(i + 1) * (360 / uniqueColors.length)}deg`).join(', ')})`;
      }

      // 2. Determine display label inside pin (e.g. "O", "1", "2•3", "D")
      const labelSet = new Set<string>();
      types.forEach(t => {
        if (t.role === 'origin') labelSet.add('O');
        else if (t.role === 'destination') labelSet.add('D');
        else if (t.role === 'boarding' || t.role === 'drop_off') {
          labelSet.add(String(t.segmentIndex! + 1));
        }
      });
      const displayText = Array.from(labelSet).join('•');

      // 3. Create Leaflet custom icon
      const customIcon = L.divIcon({
        html: `
          <div style="
            width: 28px;
            height: 28px;
            background: ${backgroundStyle};
            border: 2px solid #1C1917;
            border-radius: 50%;
            box-shadow: 2px 2px 0px #1C1917;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #1C1917;
            font-weight: 900;
            font-size: 11px;
            font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
            text-shadow: 0px 0px 2px #FAFAF9;
          ">${displayText}</div>
        `,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      // 4. Generate tooltip HTML
      const firstLoc = types[0].locationName;
      const allSameName = types.every(t => t.locationName === firstLoc);
      let tooltipHtml = '';

      if (allSameName) {
        tooltipHtml = `<div class="p-1 font-sans text-xs">` +
          `<p class="font-bold text-primary mb-1 border-b border-border-dark/10 pb-1">${firstLoc}</p>` +
          types.map(t => {
            if (t.role === 'origin') return '📍 Origin';
            if (t.role === 'destination') return '🏁 Destination';
            if (t.role === 'boarding') return `👉 Segment ${t.segmentIndex! + 1} Boarding`;
            if (t.role === 'drop_off') return `🏁 Segment ${t.segmentIndex! + 1} Drop-off`;
            return '';
          }).filter(Boolean).join('<br/>') +
          `</div>`;
      } else {
        tooltipHtml = `<div class="p-1 font-sans text-xs flex flex-col gap-1.5">` +
          types.map(t => {
            if (t.role === 'origin') return `<div><b class="text-primary">Origin:</b> <span class="text-secondary">${t.locationName}</span></div>`;
            if (t.role === 'destination') return `<div><b class="text-primary">Destination:</b> <span class="text-secondary">${t.locationName}</span></div>`;
            if (t.role === 'boarding') return `<div><b class="text-primary">Seg ${t.segmentIndex! + 1} Boarding:</b> <span class="text-secondary">${t.locationName}</span></div>`;
            if (t.role === 'drop_off') return `<div><b class="text-primary">Seg ${t.segmentIndex! + 1} Drop-off:</b> <span class="text-secondary">${t.locationName}</span></div>`;
            return '';
          }).filter(Boolean).join('') +
          `</div>`;
      }

      // 5. Add marker to map
      L.marker([lat, lng], { icon: customIcon })
        .bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -10] })
        .addTo(map);
    });

    let isMounted = true;

    // Helper to fetch snapped road path coordinates from the public OSRM API
    async function fetchSnappedCoords(
      fromLat: number, fromLng: number, 
      toLat: number, toLng: number, 
      profile: 'driving' | 'foot'
    ): Promise<L.LatLngTuple[]> {
      const straightLineCoords: L.LatLngTuple[] = [[fromLat, fromLng], [toLat, toLng]];
      const straightDist = getDistance(fromLat, fromLng, toLat, toLng);

      // Rule 1: Extremely short distances (< 15 meters) always connect directly.
      if (straightDist < 15) {
        return straightLineCoords;
      }

      // Rule 2: For walking routes under 150m, bypass standard street network routing.
      // This represents direct pedestrian overpass crossings which standard routing engines fail to snap.
      if (profile === 'foot' && straightDist < 150) {
        return straightLineCoords;
      }

      try {
        // Tightened snapping radius (30m for vehicles, 40m for walking) to prevent snapping across barriers to parallel streets
        const snapRadius = profile === 'driving' ? 30 : 40;
        const url = `https://router.project-osrm.org/route/v1/${profile}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson&radiuses=${snapRadius};${snapRadius}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('OSRM routing request failed');
        const data = await res.json();
        
        if (data.routes && data.routes.length > 0) {
          const geoJsonCoords = data.routes[0].geometry.coordinates as [number, number][];
          const pathCoords: L.LatLngTuple[] = geoJsonCoords.map(c => [c[1], c[0]]);

          // Compute the total distance of OSRM's proposed route
          let routedDistance = 0;
          for (let i = 0; i < pathCoords.length - 1; i++) {
            routedDistance += getDistance(
              pathCoords[i][0], pathCoords[i][1], 
              pathCoords[i+1][0], pathCoords[i+1][1]
            );
          }

          // Rule 3: Detour filter for walking routes.
          if (profile === 'foot') {
            if (straightDist < 500 && routedDistance > straightDist * 1.8) {
              return straightLineCoords;
            }
          }

          // Rule 4: Detour filter for vehicular routes.
          if (profile === 'driving') {
            if (straightDist < 500 && routedDistance > straightDist * 3.0) {
              return straightLineCoords;
            }
          }

          // STITCHING: Prepend start pin and append end pin to the road coords.
          // This guarantees that the line physically connects to the markers with zero gaps.
          return [[fromLat, fromLng], ...pathCoords, [toLat, toLng]];
        }
      } catch (err) {
        console.warn('Failed to fetch snapped road path from OSRM, falling back to straight line:', err);
      }
      return straightLineCoords;
    }

    // Async thread to fetch and draw OSRM snapped polylines sequentially
    const drawSnappedPaths = async () => {
      const sortedSegments = [...segments].sort((a, b) => a.display_order - b.display_order);

      // 1. SNAP Connection: Route Origin -> First Segment Boarding point (if they differ)
      if (route.origin_lat && route.origin_lng && sortedSegments.length > 0) {
        const firstSeg = sortedSegments[0];
        if (firstSeg.boarding_lat && firstSeg.boarding_lng) {
          const dist = Math.sqrt(Math.pow(route.origin_lat - firstSeg.boarding_lat, 2) + Math.pow(route.origin_lng - firstSeg.boarding_lng, 2));
          if (dist > 0.0001) {
            const snapped = await fetchSnappedCoords(route.origin_lat, route.origin_lng, firstSeg.boarding_lat, firstSeg.boarding_lng, 'foot');
            if (!isMounted) return;
            L.polyline(snapped, {
              color: '#111111',
              weight: 3,
              dashArray: '5, 5',
              opacity: 0.6
            }).addTo(map);
          }
        }
      }

      // 2. SNAP lines inside segments (solid for vehicles, dashed for walking) and transition gaps
      for (let idx = 0; idx < sortedSegments.length; idx++) {
        const seg = sortedSegments[idx];
        if (seg.boarding_lat && seg.boarding_lng && seg.drop_off_lat && seg.drop_off_lng) {
          const isWalk = seg.transport_type.toLowerCase() === 'walk';
          const profile = isWalk ? 'foot' : 'driving';
          
          const snapped = await fetchSnappedCoords(seg.boarding_lat, seg.boarding_lng, seg.drop_off_lat, seg.drop_off_lng, profile);
          if (!isMounted) return;
          
          L.polyline(snapped, {
            color: isWalk ? '#4B4B4B' : '#F15A4A',
            weight: isWalk ? 3.5 : 5,
            dashArray: isWalk ? '6, 6' : undefined,
            opacity: 0.9
          }).addTo(map);
        }

        // Snap dashed connector from current drop-off to next boarding point
        if (idx < sortedSegments.length - 1) {
          const nextSeg = sortedSegments[idx + 1];
          if (seg.drop_off_lat && seg.drop_off_lng && nextSeg.boarding_lat && nextSeg.boarding_lng) {
            const dist = Math.sqrt(Math.pow(seg.drop_off_lat - nextSeg.boarding_lat, 2) + Math.pow(seg.drop_off_lng - nextSeg.boarding_lng, 2));
            if (dist > 0.0001) {
              const snapped = await fetchSnappedCoords(seg.drop_off_lat, seg.drop_off_lng, nextSeg.boarding_lat, nextSeg.boarding_lng, 'foot');
              if (!isMounted) return;
              L.polyline(snapped, {
                color: '#111111',
                weight: 3,
                dashArray: '5, 5',
                opacity: 0.6
              }).addTo(map);
            }
          }
        }
      }

      // 3. SNAP Connection: Final Segment Drop-off -> Route Destination (if they differ)
      if (route.destination_lat && route.destination_lng && sortedSegments.length > 0) {
        const lastSeg = sortedSegments[sortedSegments.length - 1];
        if (lastSeg.drop_off_lat && lastSeg.drop_off_lng) {
          const dist = Math.sqrt(Math.pow(lastSeg.drop_off_lat - route.destination_lat, 2) + Math.pow(lastSeg.drop_off_lng - route.destination_lng, 2));
          if (dist > 0.0001) {
            const snapped = await fetchSnappedCoords(lastSeg.drop_off_lat, lastSeg.drop_off_lng, route.destination_lat, route.destination_lng, 'foot');
            if (!isMounted) return;
            L.polyline(snapped, {
              color: '#111111',
              weight: 3,
              dashArray: '5, 5',
              opacity: 0.6
            }).addTo(map);
          }
        }
      }
    };

    drawSnappedPaths();

    // Auto-fit bounds if we have points
    if (validCoords.length > 1) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    return () => {
      isMounted = false;
      map.remove();
      mapRef.current = null;
    };
  }, [route, segments]);

  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => mapRef.current?.invalidateSize(), 350);
    }
  }, [compact]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full min-h-[140px] border-4 border-border-dark rounded-md bg-soft-beige shadow-hard z-10"
    />
  );
}
