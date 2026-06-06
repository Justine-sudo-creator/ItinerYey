'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type StopMapStop = {
  stop_name: string;
  stop_note: string | null;
  lat: number | null;
  lng: number | null;
  display_order: number;
};

type StopsPinsMapProps = {
  stops: StopMapStop[];
};

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
      ">${num}</div>`,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
  });
}

/**
 * Pins-only map for Trip Details.
 * Shows ONLY stops that have real saved coordinates (lat/lng from the form).
 * Never geocodes by name — what you pinned is what you see.
 */
export default function StopsPinsMap({ stops }: StopsPinsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Memoize so the useEffect only re-runs when stop data actually changes,
  // not on every parent re-render (which would crash Leaflet mid-animation).
  const pinnedStops = useMemo(
    () =>
      stops.filter(
        (s): s is StopMapStop & { lat: number; lng: number } =>
          typeof s.lat === 'number' &&
          typeof s.lng === 'number' &&
          !isNaN(s.lat) &&
          !isNaN(s.lng)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(stops.map(s => ({ lat: s.lat, lng: s.lng, id: s.display_order })))]
  );

  useEffect(() => {
    if (pinnedStops.length === 0 || !mapContainerRef.current) return;

    // Safely destroy any previous map instance before creating a new one
    if (mapRef.current) {
      try {
        mapRef.current.stop(); // cancel any in-progress animations
        mapRef.current.remove();
      } catch (_) {
        // ignore cleanup errors (e.g. already removed)
      }
      mapRef.current = null;
    }

    const container = mapContainerRef.current;
    // Guard: if Leaflet already initialised this container (HMR edge case), clean up
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((container as any)._leaflet_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (container as any)._leaflet_id;
    }

    const map = L.map(container, {
      center: [pinnedStops[0].lat, pinnedStops[0].lng],
      zoom: 17,
      scrollWheelZoom: false,
      zoomControl: true,
      fadeAnimation: false,
      markerZoomAnimation: false,
    });

    // OSM standard — shows individual shop, restaurant, and building names at zoom 17+
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.featureGroup();

    pinnedStops.forEach((stop) => {
      const icon = buildNumberedIcon(stop.display_order + 1);
      const popupContent = `
        <div style="font-family:Inter,sans-serif;min-width:140px">
          <div style="font-weight:900;font-size:13px;color:#1a1a1a">Stop ${stop.display_order + 1}: ${stop.stop_name}</div>
          ${stop.stop_note ? `<div style="font-size:11px;color:#555;margin-top:4px">${stop.stop_note}</div>` : ''}
        </div>`;
      const marker = L.marker([stop.lat, stop.lng], { icon })
        .bindPopup(popupContent, { maxWidth: 220 })
        .addTo(map);
      group.addLayer(marker);
    });

    if (pinnedStops.length === 1) {
      map.setView([pinnedStops[0].lat, pinnedStops[0].lng], 17);
    } else {
      map.fitBounds(group.getBounds(), { padding: [48, 48], maxZoom: 17 });
    }

    mapRef.current = map;

    return () => {
      // Stop animations first, then destroy — prevents _leaflet_pos crash
      try {
        mapRef.current?.stop();
        mapRef.current?.remove();
      } catch (_) {
        // ignore
      }
      mapRef.current = null;
    };
  }, [pinnedStops]);

  if (pinnedStops.length === 0) return null;

  return (
    <div
      ref={mapContainerRef}
      className="w-full rounded-xl overflow-hidden border-2 border-border-dark shadow-hard z-0"
      style={{ height: 340 }}
    />
  );
}
