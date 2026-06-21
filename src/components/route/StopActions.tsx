'use client';

import React from 'react';
import { Camera, Navigation } from 'lucide-react';

interface StopActionsProps {
  lat: number;
  lng: number;
  streetViewLabel: string;
}

export function StopActions({ lat, lng, streetViewLabel }: StopActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <a
        href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-bold border-2 border-border-dark px-2.5 py-1.5 bg-accent-yellow/40 hover:bg-accent-yellow rounded-sm shadow-hard-sm transition-all"
      >
        <Camera className="w-3.5 h-3.5 shrink-0" />
        {streetViewLabel}
      </a>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-bold border border-border-dark/60 px-2.5 py-1.5 text-secondary hover:text-primary hover:border-border-dark rounded-sm transition-all"
      >
        <Navigation className="w-3 h-3 shrink-0" />
        Directions
      </a>
    </div>
  );
}
