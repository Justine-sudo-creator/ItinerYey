'use client';

import React, { useState, useCallback } from 'react';
import { MapPin, Navigation, Search, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { MapPickerModal } from '@/components/ui/MapPickerModal';
import { JourneyItinerary } from './JourneyItinerary';
import type { RoutingResponse, RoutingResult } from '@/types/routing';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Coords {
  lat: number;
  lng: number;
  label: string;
}

type FetchState = 'idle' | 'loading' | 'success' | 'error';

// ─── Small coordinate display pill ───────────────────────────────────────────

function CoordPill({ label, coords, onPick }: {
  label: string;
  coords: Coords | null;
  onPick: () => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] uppercase font-bold text-secondary/70 tracking-wider mb-1">{label}</p>
      <button
        type="button"
        onClick={onPick}
        className={`w-full flex items-center gap-2 text-left px-3 py-3 rounded-lg border-2 transition-all
          ${coords
            ? 'border-border-dark bg-white text-primary shadow-sm'
            : 'border-dashed border-border-dark/50 bg-soft-beige/60 text-secondary hover:border-border-dark hover:bg-soft-beige'
          }`}
      >
        <MapPin className={`w-4 h-4 shrink-0 ${coords ? 'text-accent-coral' : 'text-secondary/50'}`} />
        <span className="text-sm font-bold truncate">
          {coords ? coords.label : `Pick ${label} on map…`}
        </span>
      </button>
    </div>
  );
}

// ─── Main RoutePlanner component ──────────────────────────────────────────────

export function RoutePlanner() {
  const [origin,      setOrigin]      = useState<Coords | null>(null);
  const [destination, setDestination] = useState<Coords | null>(null);

  const [pickingFor,  setPickingFor]  = useState<'origin' | 'destination' | null>(null);

  const [fetchState, setFetchState]   = useState<FetchState>('idle');
  const [result,     setResult]       = useState<RoutingResult | null>(null);
  const [errorMsg,   setErrorMsg]     = useState('');

  // ── Map picker handlers ────────────────────────────────────────────────────

  const handleMapSelect = useCallback((lat: number, lng: number) => {
    const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    if (pickingFor === 'origin')      setOrigin({ lat, lng, label });
    if (pickingFor === 'destination') setDestination({ lat, lng, label });
    setPickingFor(null);
  }, [pickingFor]);

  // ── Route lookup ───────────────────────────────────────────────────────────

  const findRoute = useCallback(async () => {
    if (!origin || !destination) return;

    setFetchState('loading');
    setResult(null);
    setErrorMsg('');

    try {
      const params = new URLSearchParams({
        startLat: String(origin.lat),
        startLng: String(origin.lng),
        endLat:   String(destination.lat),
        endLng:   String(destination.lng),
      });

      const res = await fetch(`/api/route-planner?${params.toString()}`);
      const json: RoutingResponse = await res.json();

      if (!json.success) {
        setErrorMsg(json.error);
        setFetchState('error');
        return;
      }

      setResult(json);
      setFetchState('success');
    } catch {
      setErrorMsg('Network error — please check your connection and try again.');
      setFetchState('error');
    }
  }, [origin, destination]);

  const reset = () => {
    setFetchState('idle');
    setResult(null);
    setErrorMsg('');
  };

  const canSearch = !!origin && !!destination && fetchState !== 'loading';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Search panel ── */}
      <div className="bg-surface border-2 border-border-dark rounded-xl shadow-hard p-5">
        <div className="flex items-center gap-2 mb-4">
          <Navigation className="w-5 h-5 text-accent-coral" />
          <h2 className="text-lg font-display font-black text-primary">Plan Your Route</h2>
        </div>

        {/* Coordinate pickers */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <CoordPill
            label="Origin"
            coords={origin}
            onPick={() => setPickingFor('origin')}
          />
          <div className="hidden sm:flex items-end pb-3">
            <div className="w-6 h-px bg-border-dark/30 mt-7" />
          </div>
          <CoordPill
            label="Destination"
            coords={destination}
            onPick={() => setPickingFor('destination')}
          />
        </div>

        {/* Action row */}
        <div className="flex gap-2">
          <PrimaryButton
            onClick={findRoute}
            disabled={!canSearch}
            className="flex items-center gap-2 py-2.5 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fetchState === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculating…
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Find Route
              </>
            )}
          </PrimaryButton>

          {(fetchState === 'success' || fetchState === 'error') && (
            <SecondaryButton onClick={reset} className="flex items-center gap-2 py-2.5 px-4">
              <RefreshCw className="w-3.5 h-3.5" />
              Reset
            </SecondaryButton>
          )}
        </div>

        {/* Helper hint */}
        {fetchState === 'idle' && (
          <p className="mt-3 text-xs text-secondary/70 font-medium">
            Tap either box above to drop a pin on the map. The A* engine will calculate the optimal multi-vehicle route.
          </p>
        )}
      </div>

      {/* ── Loading skeleton ── */}
      {fetchState === 'loading' && (
        <div className="flex flex-col gap-3 animate-pulse">
          {[180, 140, 100].map((h, i) => (
            <div key={i} className={`rounded-xl bg-border-dark/10 border border-border-dark/10`} style={{ height: h }} />
          ))}
        </div>
      )}

      {/* ── Error state ── */}
      {fetchState === 'error' && (
        <div className="flex items-start gap-3 bg-red-50 border-2 border-red-200 rounded-xl p-5">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-black text-red-700 text-sm mb-1">No route found</p>
            <p className="text-sm font-medium text-red-600">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {fetchState === 'success' && result && (
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-display font-black text-primary border-b-2 border-border-dark pb-2">
            Recommended Itinerary
          </h3>
          <JourneyItinerary
            totalTimeMinutes={result.totalTimeMinutes}
            totalFare={result.totalFare}
            legs={result.legs}
            destinationName={destination?.label}
          />
        </div>
      )}

      {/* ── Map picker modals ── */}
      <MapPickerModal
        isOpen={pickingFor === 'origin'}
        onClose={() => setPickingFor(null)}
        onSelect={handleMapSelect}
        initialLat={origin?.lat}
        initialLng={origin?.lng}
        label="Origin"
        existingPins={destination ? [{ lat: destination.lat, lng: destination.lng, label: 'Destination', role: 'destination' }] : []}
      />
      <MapPickerModal
        isOpen={pickingFor === 'destination'}
        onClose={() => setPickingFor(null)}
        onSelect={handleMapSelect}
        initialLat={destination?.lat}
        initialLng={destination?.lng}
        label="Destination"
        existingPins={origin ? [{ lat: origin.lat, lng: origin.lng, label: 'Origin', role: 'origin' }] : []}
      />
    </div>
  );
}
