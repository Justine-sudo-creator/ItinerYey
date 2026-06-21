'use client';

import React from 'react';
import { RouteSegment } from '@/types/supabase';
import { Footprints, Lightbulb, Clock } from 'lucide-react';
import { StopActions } from './StopActions';

interface MarkerIndicator {
  background: string;
  text: string;
}

interface RouteLegCardProps {
  legSegments: RouteSegment[];
  startIndex: number;
  getMarkerIndicator: (
    lat: number | null | undefined,
    lng: number | null | undefined,
    defaultRole: 'boarding' | 'drop_off',
    defaultIndex: number
  ) => MarkerIndicator;
}

function ArrivalTip({ tip }: { tip: string }) {
  return (
    <div className="mt-1 flex gap-1.5 items-start bg-accent-yellow/10 border border-accent-yellow/40 rounded px-2.5 py-1.5 ml-8 max-w-fit">
      <Lightbulb className="w-3.5 h-3.5 shrink-0 text-accent-yellow mt-0.5" />
      <div>
        <p className="text-[10px] uppercase font-bold text-secondary tracking-wider leading-none mb-0.5">Tip</p>
        <p className="text-xs font-semibold text-primary leading-snug">{tip}</p>
      </div>
    </div>
  );
}

function getTransportStyles(type: string) {
  const t = type.toLowerCase();
  if (t.includes('jeep')) return { line: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800 border-amber-200' };
  if (t.includes('uv')) return { line: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  if (t.includes('mrt') || t.includes('lrt') || t.includes('train')) return { line: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800 border-blue-200' };
  if (t.includes('bus')) return { line: 'bg-red-500', badge: 'bg-red-100 text-red-800 border-red-200' };
  if (t.includes('walk')) return { line: 'border-l-2 border-dashed border-gray-400 bg-transparent', badge: 'bg-gray-100 text-gray-700 border-gray-300', isWalk: true };
  return { line: 'bg-primary', badge: 'bg-primary/10 text-primary border-primary/20' };
}

export function RouteLegCard({ legSegments, startIndex, getMarkerIndicator }: RouteLegCardProps) {
  if (legSegments.length === 0) return null;

  const firstSeg = legSegments[0];
  const isWalk = firstSeg.transport_type.toLowerCase() === 'walk';
  const styles = getTransportStyles(firstSeg.transport_type);

  // Calculate totals
  const totalFare = legSegments.reduce((sum, seg) => sum + (seg.fare || 0), 0);
  const totalMins = legSegments.reduce((sum, seg) => {
    const match = seg.estimated_duration?.match(/\d+/);
    return sum + (match ? parseInt(match[0], 10) : 0);
  }, 0);

  return (
    <div className="bg-surface border border-border-dark rounded-xl shadow-hard overflow-hidden mb-4">
      {/* Leg Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 border-b border-border-dark/10 bg-soft-beige gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] uppercase tracking-wider font-black px-2 py-1 rounded border flex items-center gap-1.5 shrink-0 ${styles.badge}`}>
            {isWalk ? <Footprints className="w-3.5 h-3.5" /> : null}
            {isWalk ? 'WALK' : `BOARD ${firstSeg.transport_type.toUpperCase()}`}
          </span>
          {firstSeg.signboard && (
            <span className="text-base font-black text-primary uppercase">{firstSeg.signboard}</span>
          )}
        </div>
        
        <div className="flex items-center gap-3 shrink-0">
          {totalMins > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-secondary bg-white px-2 py-1 rounded-md border border-border-dark/10 shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              ~{totalMins} mins
            </span>
          )}
          <div className={`font-black text-sm px-3 py-1 rounded-md border ${isWalk ? 'bg-white text-secondary/60 border-border-dark/10 shadow-sm italic' : 'bg-accent-coral/10 text-accent-coral border-accent-coral/20'}`}>
            {isWalk ? 'No Fare' : `₱${totalFare}`}
          </div>
        </div>
      </div>

      {/* Timeline Thread */}
      <div className="p-4 sm:p-5 relative">
        {/* The continuous vertical line */}
        <div className={`absolute top-8 bottom-8 left-[31px] sm:left-[35px] w-1 z-0 ${styles.isWalk ? styles.line : `${styles.line} rounded-full`}`} />

        <div className="flex flex-col gap-6 relative z-10">
          {/* First Node (Origin of Leg) */}
          <div className="flex items-start gap-3 sm:gap-4">
            <div
              className="w-8 h-8 shrink-0 border-2 border-border-dark rounded-full shadow-sm flex items-center justify-center text-[11px] font-black text-primary bg-white z-10"
              style={{ background: getMarkerIndicator(firstSeg.boarding_lat, firstSeg.boarding_lng, 'boarding', startIndex).background }}
            >
              {getMarkerIndicator(firstSeg.boarding_lat, firstSeg.boarding_lng, 'boarding', startIndex).text}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <p className="text-[10px] uppercase font-bold text-secondary/70 tracking-wider leading-none mb-1">
                {isWalk ? 'Start Walk' : 'Board Here'}
              </p>
              <p className="text-lg font-black text-primary leading-tight">{firstSeg.boarding_name}</p>
              {firstSeg.boarding_tip && <ArrivalTip tip={firstSeg.boarding_tip} />}
              {firstSeg.boarding_lat != null && firstSeg.boarding_lng != null && (
                <div className="mt-2">
                  <StopActions lat={firstSeg.boarding_lat} lng={firstSeg.boarding_lng} streetViewLabel={isWalk ? 'View Landmark' : 'See Boarding Area'} />
                </div>
              )}
            </div>
          </div>

          {/* Subsequent Nodes (Drop-offs) */}
          {legSegments.map((seg, i) => {
            const globalIndex = startIndex + i;
            const indicator = getMarkerIndicator(seg.drop_off_lat, seg.drop_off_lng, 'drop_off', globalIndex);
            const isLastNode = i === legSegments.length - 1;

            return (
              <div key={seg.id} className="flex items-start gap-3 sm:gap-4">
                <div
                  className="w-8 h-8 shrink-0 border-2 border-border-dark rounded-full shadow-sm flex items-center justify-center text-[11px] font-black text-primary bg-white z-10"
                  style={{ background: indicator.background }}
                >
                  {indicator.text}
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-[10px] uppercase font-bold text-secondary/70 tracking-wider leading-none mb-1">
                    {isLastNode ? (isWalk ? 'Arrive Here' : 'Alight Here') : 'Pass By'}
                  </p>
                  <p className={`text-lg font-black text-primary leading-tight ${!isLastNode && 'opacity-90'}`}>{seg.drop_off_name}</p>
                  {seg.drop_off_tip && <ArrivalTip tip={seg.drop_off_tip} />}
                  {seg.drop_off_lat != null && seg.drop_off_lng != null && (
                    <div className="mt-2">
                      <StopActions lat={seg.drop_off_lat} lng={seg.drop_off_lng} streetViewLabel="Preview Stop" />
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
