'use client';

import React from 'react';
import { Footprints, Clock, Coins, ArrowRight, MapPin } from 'lucide-react';
import { StopActions } from '@/components/route/StopActions';
import type { JourneyLeg, TransitLeg, WalkingLeg } from '@/types/routing';

// ─── Transport palette ────────────────────────────────────────────────────────

function getTransportStyles(type: string): {
  lineColor: string;   // Tailwind bg class for the timeline thread
  badgeCls: string;    // Tailwind classes for the header badge
} {
  const t = type.toLowerCase();
  if (t.includes('jeep'))      return { lineColor: 'bg-amber-400',   badgeCls: 'bg-amber-100 text-amber-800 border-amber-300' };
  if (t.includes('uv'))        return { lineColor: 'bg-indigo-500',  badgeCls: 'bg-indigo-100 text-indigo-800 border-indigo-300' };
  if (t.includes('mrt'))       return { lineColor: 'bg-blue-500',    badgeCls: 'bg-blue-100 text-blue-800 border-blue-300' };
  if (t.includes('lrt'))       return { lineColor: 'bg-green-500',   badgeCls: 'bg-green-100 text-green-800 border-green-300' };
  if (t.includes('bus'))       return { lineColor: 'bg-red-500',     badgeCls: 'bg-red-100 text-red-800 border-red-300' };
  if (t.includes('pnr'))       return { lineColor: 'bg-purple-500',  badgeCls: 'bg-purple-100 text-purple-800 border-purple-300' };
  return                               { lineColor: 'bg-primary',    badgeCls: 'bg-primary/10 text-primary border-primary/20' };
}

// ─── Transit Leg card ─────────────────────────────────────────────────────────

function TransitLegCard({ leg }: { leg: TransitLeg }) {
  const { lineColor, badgeCls } = getTransportStyles(leg.transportType);

  return (
    <div className="bg-surface border border-border-dark rounded-xl shadow-hard overflow-hidden">
      {/* Leg header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 border-b border-border-dark/10 bg-soft-beige gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`text-[10px] uppercase tracking-wider font-black px-2.5 py-1 rounded border whitespace-nowrap ${badgeCls}`}>
            BOARD {leg.transportType.toUpperCase()}
          </span>
          {leg.signboard && (
            <span className="text-base font-black text-primary truncate">
              {leg.signboard}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {leg.totalTimeMinutes > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary bg-white px-2.5 py-1 rounded-md border border-border-dark/10 shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              ~{leg.totalTimeMinutes} mins
            </span>
          )}
          <span className="font-black text-sm px-3 py-1 rounded-md border bg-accent-coral/10 text-accent-coral border-accent-coral/20">
            ₱{leg.totalFare}
          </span>
        </div>
      </div>

      {/* Timeline thread */}
      <div className="p-4 sm:p-5 relative">
        {/* The continuous vertical line — positioned relative to the node circles */}
        <div
          className={`absolute top-10 bottom-10 left-[31px] sm:left-[35px] w-1 z-0 rounded-full ${lineColor}`}
        />

        <div className="flex flex-col gap-6 relative z-10">
          {leg.stops.map((stop, i) => {
            const isFirst   = i === 0;
            const isLast    = i === leg.stops.length - 1;
            const stopLabel = isFirst ? 'Board Here'
                            : isLast  ? 'Alight Here'
                                      : 'Pass By';

            return (
              <div key={`${stop.lat}-${stop.lng}-${i}`} className="flex items-start gap-3 sm:gap-4">
                {/* Node circle */}
                <div
                  className={`w-8 h-8 shrink-0 rounded-full border-2 border-border-dark shadow-sm flex items-center justify-center z-10
                    ${isFirst || isLast ? 'bg-white ring-2 ring-offset-1 ring-border-dark/30' : 'bg-white'}`}
                >
                  {isFirst ? (
                    <MapPin className="w-4 h-4 text-accent-coral" />
                  ) : isLast ? (
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-border-dark/40" />
                  )}
                </div>

                {/* Stop content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[10px] uppercase font-bold text-secondary/70 tracking-wider leading-none mb-1">
                    {stopLabel}
                  </p>
                  <p className={`font-black text-primary leading-tight ${isFirst || isLast ? 'text-lg' : 'text-base opacity-90'}`}>
                    {stop.name}
                  </p>
                  {stop.lat != null && stop.lng != null && (
                    <div className="mt-2">
                      <StopActions
                        lat={stop.lat}
                        lng={stop.lng}
                        streetViewLabel={isFirst ? 'See Boarding Area' : 'Preview Stop'}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Walking Leg connector ────────────────────────────────────────────────────

function WalkingLegConnector({ leg }: { leg: WalkingLeg }) {
  return (
    <div className="flex items-stretch gap-4 py-1 px-1">
      {/* Dashed vertical line matching the node column */}
      <div className="flex flex-col items-center shrink-0 w-8">
        <div className="flex-1 border-l-2 border-dashed border-border-dark/40" />
        <div className="w-8 h-8 rounded-full bg-soft-beige border-2 border-border-dark/40 flex items-center justify-center shrink-0">
          <Footprints className="w-4 h-4 text-secondary" />
        </div>
        <div className="flex-1 border-l-2 border-dashed border-border-dark/40" />
      </div>

      {/* Transfer instruction text */}
      <div className="flex-1 flex items-center py-2">
        <div className="bg-soft-beige/60 border border-border-dark/20 rounded-lg px-4 py-3 w-full">
          <p className="text-xs font-black text-secondary uppercase tracking-wide mb-0.5">Transfer — Walk</p>
          <p className="text-sm font-bold text-primary leading-snug">
            {leg.distanceMeters}m to{' '}
            <span className="text-primary">{leg.to.name}</span>
            <span className="text-secondary font-medium ml-1.5">
              (~{leg.timeMinutes <= 1 ? '1 min' : `${leg.timeMinutes} mins`})
            </span>
          </p>
          {leg.distanceMeters > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              <StopActions lat={leg.from.lat} lng={leg.from.lng} streetViewLabel="See Transfer Point" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Journey summary bar ──────────────────────────────────────────────────────

function JourneySummaryBar({
  totalTimeMinutes,
  totalFare,
  legs,
}: {
  totalTimeMinutes: number;
  totalFare: number;
  legs: JourneyLeg[];
}) {
  const transitLegs  = legs.filter((l): l is TransitLeg  => l.type === 'transit');
  const walkingLegs  = legs.filter((l): l is WalkingLeg  => l.type === 'walking');
  const modeSet      = Array.from(new Set(transitLegs.map(l => l.transportType)));

  return (
    <div className="bg-surface border-2 border-border-dark rounded-xl shadow-hard p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm font-black text-primary">
        <Clock className="w-4 h-4 text-secondary" />
        ~{totalTimeMinutes} mins total
      </div>
      <div className="w-px h-5 bg-border-dark/30 hidden sm:block" />
      <div className="flex items-center gap-2 text-sm font-black text-accent-coral">
        <Coins className="w-4 h-4" />
        ₱{totalFare} total fare
      </div>
      <div className="w-px h-5 bg-border-dark/30 hidden sm:block" />
      <div className="flex flex-wrap gap-1.5 items-center">
        {modeSet.map((m, i) => (
          <React.Fragment key={m}>
            {i > 0 && <ArrowRight className="w-3.5 h-3.5 text-secondary" />}
            <span className="text-xs font-bold text-primary bg-soft-beige border border-border-dark/20 px-2 py-0.5 rounded-full">
              {m}
            </span>
          </React.Fragment>
        ))}
        {walkingLegs.length > 0 && (
          <>
            <span className="text-xs text-secondary font-medium">
              + {walkingLegs.length} {walkingLegs.length === 1 ? 'transfer' : 'transfers'}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Final arrival banner ─────────────────────────────────────────────────────

function ArrivalBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 py-2 px-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl ml-4">
      <div className="w-3 h-3 rounded-full bg-green-500 shrink-0" />
      <p className="text-sm font-bold text-green-800">
        You have arrived at <span className="font-black">{name}</span>
      </p>
    </div>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

interface JourneyItineraryProps {
  totalTimeMinutes: number;
  totalFare: number;
  legs: JourneyLeg[];
  destinationName?: string;
}

export function JourneyItinerary({
  totalTimeMinutes,
  totalFare,
  legs,
  destinationName,
}: JourneyItineraryProps) {
  if (legs.length === 0) return null;

  // Derive destination name from last transit leg's last stop if not provided
  const finalName = destinationName
    ?? (legs.findLast((l): l is TransitLeg => l.type === 'transit')?.stops.at(-1)?.name)
    ?? 'Destination';

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Summary bar */}
      <JourneySummaryBar
        totalTimeMinutes={totalTimeMinutes}
        totalFare={totalFare}
        legs={legs}
      />

      {/* Itinerary legs */}
      <div className="flex flex-col gap-2">
        {legs.map((leg, i) =>
          leg.type === 'transit' ? (
            <TransitLegCard key={`transit-${i}`} leg={leg} />
          ) : (
            <WalkingLegConnector key={`walk-${i}`} leg={leg} />
          )
        )}

        {/* Final arrival closer */}
        <ArrivalBanner name={finalName} />
      </div>
    </div>
  );
}
