'use client';

import React from 'react';
import Link from 'next/link';
import { Route, RouteSegment } from '@/types/supabase';
import { ShieldCheck, Clock, Bus, RefreshCw } from 'lucide-react';

interface RouteCardProps {
  route: Route;
  segments?: RouteSegment[];
}

export function RouteCard({ route, segments = [] }: RouteCardProps) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const verifiedMonth = route.travel_date_month ? monthNames[route.travel_date_month - 1] : '';
  const verifiedYear  = route.travel_date_year || '';

  const transportModes = Array.from(new Set(segments.map((s) => s.transport_type)));
  const mainMode = transportModes[0] || 'Route';
  void mainMode; // computed for future use

  const isHighlyVerified = (route.confidence_score || 0) >= 80;

  // Detect loop routes — when the splitting fallback set origin === destination
  const isLoop = (route.origin || '').trim().toLowerCase() === (route.destination || '').trim().toLowerCase();

  return (
    <Link href={`/route/${route.id}`} className="block">
      <div className="bg-surface border border-border-dark rounded-xl p-4 shadow-hard hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 h-full flex items-center gap-4 cursor-pointer">

        {/* Icon — loop gets a distinct circular-arrow icon */}
        <div
          className={`flex items-center justify-center w-14 h-14 rounded-2xl border shrink-0 ${
            isLoop
              ? 'bg-indigo-50 border-indigo-200'
              : 'bg-soft-beige border-border-dark'
          }`}
        >
          {isLoop
            ? <RefreshCw className="w-6 h-6 text-indigo-500" />
            : <Bus className="w-6 h-6 text-primary" />
          }
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              {isLoop ? (
                /* ── Loop / Circular route layout ─────────────────── */
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-xs font-bold text-indigo-600 mb-1.5">
                    <RefreshCw className="w-3 h-3" /> Circular Route
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-primary truncate">
                    {route.origin}
                    <span className="ml-2 text-sm font-medium text-secondary">(Loop Line)</span>
                  </h3>
                </>
              ) : (
                /* ── Normal A → B layout ──────────────────────────── */
                <>
                  <p className="text-sm uppercase tracking-[0.18em] font-semibold text-secondary mb-1">
                    {route.origin} → {route.destination}
                  </p>
                  <h3 className="text-base sm:text-lg font-extrabold text-primary truncate">
                    {route.origin} to {route.destination}
                  </h3>
                </>
              )}
            </div>

            {isHighlyVerified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-bold text-green-700 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                {route.confidence_score}% Verified
              </span>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-primary font-semibold">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-secondary" />
              {route.estimated_duration || 'Unknown'}
            </div>
            <div className="flex items-center gap-2 justify-end text-right">
              <span className="text-secondary">Fare</span>
              <span>₱{route.total_fare || 0}</span>
            </div>
          </div>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-2 text-right text-xs text-secondary shrink-0">
          <span>Last verified</span>
          <span className="font-semibold text-primary">
            {verifiedMonth} {verifiedYear}
          </span>
        </div>
      </div>
    </Link>
  );
}
