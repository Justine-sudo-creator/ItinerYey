'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';

// Dynamically import the map picker without SSR
const LeafletMapPicker = dynamic(
  () => import('./LeafletMapPicker'),
  { ssr: false, loading: () => <div className="w-full h-[400px] bg-soft-beige animate-pulse flex items-center justify-center border-2 border-border-dark"><span className="font-bold text-secondary">Loading Map...</span></div> }
);

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (lat: number, lng: number) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  label?: string;
  existingPins?: Array<{ lat: number; lng: number; label: string; role: 'origin' | 'destination' | 'boarding' | 'drop_off' }>;
}

export function MapPickerModal({
  isOpen,
  onClose,
  onSelect,
  initialLat,
  initialLng,
  label,
  existingPins
}: MapPickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-primary/80 backdrop-blur-sm">
      <div className="bg-white w-full max-w-3xl rounded-md shadow-hard border-4 border-border-dark flex flex-col relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b-2 border-border-dark bg-surface">
          <h2 className="font-display font-black text-xl text-primary">
            {label ? `Pin Location: ${label}` : 'Pin Location on Map'}
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-black/5 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-primary" />
          </button>
        </div>

        {/* Map Body */}
        <div className="p-4 bg-white">
          <LeafletMapPicker 
            initialLat={initialLat} 
            initialLng={initialLng} 
            existingPins={existingPins}
            onSelect={(lat, lng) => {
              onSelect(lat, lng);
              onClose();
            }} 
          />
        </div>
      </div>
    </div>
  );
}
