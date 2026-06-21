'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Route, RouteSegment } from '@/types/supabase';

const LeafletRouteMap = dynamic(
  () => import('./LeafletRouteMap'),
  { 
    ssr: false, 
    loading: () => (
      <div className="w-full h-full min-h-[140px] border-4 border-border-dark rounded-md bg-soft-beige shadow-hard flex items-center justify-center animate-pulse">
        <span className="font-bold text-secondary uppercase tracking-wider text-sm">Loading Map...</span>
      </div>
    ) 
  }
);

interface RouteMapProps {
  route: Route;
  segments: RouteSegment[];
  compact?: boolean;
}

export function RouteMap({ route, segments, compact }: RouteMapProps) {
  return <LeafletRouteMap route={route} segments={segments} compact={compact} />;
}
