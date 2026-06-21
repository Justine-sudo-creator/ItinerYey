'use client';

import React, { useState } from 'react';
import { Route, RouteSegment } from '@/types/supabase';
import { RouteMap } from './RouteMap';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';

interface RouteMapCollapsibleProps {
  route: Route;
  segments: RouteSegment[];
  googleMapsUrl: string;
}

export function RouteMapCollapsible({ route, segments, googleMapsUrl }: RouteMapCollapsibleProps) {
  const [expanded, setExpanded] = useState(false);
  const hasCoords =
    route.origin_lat && route.origin_lng && route.destination_lat && route.destination_lng;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h2 className="text-lg font-display font-black text-primary flex items-center gap-2">
          <MapPin className="w-5 h-5 text-accent-coral" />
          Route Map
        </h2>
        <div className="flex items-center gap-2">
          {hasCoords && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 bg-[#FAFAF9] hover:bg-[#F59E0B] text-primary hover:text-[#1C1917] font-bold px-3 py-1.5 border-2 border-border-dark rounded shadow-hard-sm hover:translate-y-[-1px] active:translate-y-[1px] transition-all text-[11px] shrink-0"
            >
              Open in Google Maps ↗
            </a>
          )}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-bold border-2 border-border-dark px-3 py-1.5 bg-surface hover:bg-accent-yellow rounded-sm shadow-hard-sm transition-all"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Collapse
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Expand map
              </>
            )}
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          expanded ? 'h-[320px] md:h-[400px]' : 'h-[160px]'
        }`}
      >
        <RouteMap route={route} segments={segments} compact={!expanded} />
      </div>
    </div>
  );
}
