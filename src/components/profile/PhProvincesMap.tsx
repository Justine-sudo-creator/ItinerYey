'use client';

import React, { useMemo, useState, useRef, MouseEvent, WheelEvent, useEffect } from 'react';
import Philippines from '@react-map/philippines';
import { User, Trip } from '@/types/supabase';
import { X, Map as MapIcon, Share2, Plus, Minus, RotateCcw } from 'lucide-react';
import MapShareCard from './MapShareCard';

export const MAP_PROVINCES = [
  'Surigao del Sur', 'Tarlac', 'Tawi-Tawi', 'Zambales', 'Zamboanga del Norte',
  'Zamboanga Sibugay', 'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan',
  'Albay', 'Antique', 'Apayao', 'Aurora', 'Bataan', 'Batanes', 'Batangas',
  'Benguet', 'Biliran', 'Bohol', 'Bukidnon', 'Bulacan', 'Cagayan',
  'Camarines Norte', 'Camarines Sur', 'Camiguin', 'Capiz', 'Catanduanes',
  'Cavite', 'Cebu', 'Compostela Valley', 'Davao del Norte', 'Davao del Sur',
  'Davao Oriental', 'Dinagat Islands', 'Eastern Samar', 'Guimaras', 'Ifugao',
  'Ilocos Norte', 'Ilocos Sur', 'Iloilo', 'Isabela', 'Kalinga', 'La Union',
  'Laguna', 'Lanao del Norte', 'Lanao del Sur', 'Leyte', 'Maguindanao',
  'Marinduque', 'Masbate', 'Metropolitan Manila', 'Misamis Occidental',
  'Misamis Oriental', 'Mountain Province', 'Negros Occidental', 'Negros Oriental',
  'Cotabato', 'Northern Samar', 'Nueva Ecija', 'Nueva Vizcaya', 'Mindoro Occidental',
  'Mindoro Oriental', 'Palawan', 'Pampanga', 'Pangasinan', 'Quezon', 'Quirino',
  'Rizal', 'Romblon', 'Samar', 'Sarangani', 'Siquijor', 'Sorsogon',
  'South Cotabato', 'Southern Leyte', 'Sultan Kudarat', 'Sulu', 'Surigao del Norte',
  'Basilan', 'Zamboanga del Sur'
];

interface PhProvincesMapProps {
  trips: Trip[];
  userProfile: User;
}

export function getTravelerLevel(uniqueProvinceCount: number): {
  title: string;
  min: number;
  max: number;
  next: string | null;
  description: string;
} {
  if (uniqueProvinceCount === 0) {
    return {
      title: 'Baguhan',
      min: 0,
      max: 1,
      next: 'Lakbayer',
      description: 'Your journey is just beginning. Submit a trip to claim your first province'
    };
  }
  if (uniqueProvinceCount <= 5) {
    return {
      title: 'Lakbayer',
      min: 1,
      max: 5,
      next: 'Explorer',
      description: 'An active local traveler exploring regional wonders'
    };
  }
  if (uniqueProvinceCount <= 15) {
    return {
      title: 'Explorer',
      min: 6,
      max: 15,
      next: 'Byahero',
      description: 'A seasoned traveler with a curiosity for diverse destinations'
    };
  }
  if (uniqueProvinceCount <= 30) {
    return {
      title: 'Byahero',
      min: 16,
      max: 30,
      next: 'Manlalakbay',
      description: 'A devoted adventurer mapping the archipelago'
    };
  }
  if (uniqueProvinceCount <= 50) {
    return {
      title: 'Manlalakbay',
      min: 31,
      max: 50,
      next: 'Palaboy',
      description: 'An elite wanderer who has crossed regions and seas'
    };
  }
  return {
    title: 'Palaboy',
    min: 51,
    max: 82,
    next: null,
    description: 'The ultimate honor. A master traveler who has wandered almost everywhere'
  };
}

export function resolveProvinceName(dbName: string | null | undefined): string | null {
  if (!dbName) return null;
  const name = dbName.trim().toLowerCase();

  if (
    name.includes('manila') ||
    name.includes('ncr') ||
    name.includes('national capital region') ||
    name === 'pasig' ||
    name === 'quezon city' ||
    name === 'makati' ||
    name === 'taguig'
  ) {
    return 'Metropolitan Manila';
  }

  if (name.includes('davao de oro') || name.includes('compostela')) {
    return 'Compostela Valley';
  }

  if (name.includes('occidental mindoro') || (name.includes('mindoro') && name.includes('occidental'))) {
    return 'Mindoro Occidental';
  }

  if (name.includes('oriental mindoro') || (name.includes('mindoro') && name.includes('oriental'))) {
    return 'Mindoro Oriental';
  }

  if (name.includes('cotabato')) {
    return 'Cotabato';
  }

  if (name === 'samar' || name.includes('western samar')) {
    return 'Samar';
  }

  const found = MAP_PROVINCES.find((p) => p.toLowerCase() === name || name.includes(p.toLowerCase()));
  return found || null;
}

export default function PhProvincesMap({ trips, userProfile }: PhProvincesMapProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Zoom & Pan States
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Custom Selection State for Tooltip (desktop hover, mobile tap)
  const [inspectedProvince, setInspectedProvince] = useState<string | null>(null);

  const uniqueProvinces = useMemo(() => {
    const set = new Set<string>();
    trips.forEach((t) => {
      const resolved = resolveProvinceName(t.destination_province || t.destination_region || t.destination);
      if (resolved) {
        set.add(resolved);
      }
    });
    return Array.from(set);
  }, [trips]);

  const uniqueCount = uniqueProvinces.length;
  const levelInfo = getTravelerLevel(uniqueCount);

  const cityColors = useMemo(() => {
    const colors: Record<string, string> = {};
    MAP_PROVINCES.forEach((prov) => {
      if (uniqueProvinces.includes(prov)) {
        colors[prov] = '#f25c54'; // Coral
      } else {
        colors[prov] = '#ded8c9'; // Sand-gray background for clarity
      }
    });
    return colors;
  }, [uniqueProvinces]);

  // Mouse Pan Event Handlers
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  // Touch Pan Event Handlers (Mobile support)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      dragStart.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.current.x,
      y: touch.clientY - dragStart.current.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Zoom wheel event handler
  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomFactor = 0.15;
    const nextScale = e.deltaY < 0 ? scale + zoomFactor : scale - zoomFactor;
    setScale(Math.max(0.6, Math.min(4, nextScale)));
  };

  const zoomIn = () => setScale(prev => Math.min(4, prev + 0.25));
  const zoomOut = () => setScale(prev => Math.max(0.6, prev - 0.25));
  const resetMap = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setInspectedProvince(null);
  };

  // Attach tap/click listeners on paths for clean province inspection
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const paths = document.querySelectorAll('.map svg path');
      
      const handlePathInteraction = (e: any) => {
        const idAttr = e.currentTarget.getAttribute('id') || '';
        const provName = idAttr.split('-')[0];
        if (provName) {
          setInspectedProvince(provName);
        }
      };

      paths.forEach((path) => {
        path.addEventListener('mouseenter', handlePathInteraction);
        path.addEventListener('click', handlePathInteraction);
        path.addEventListener('touchstart', handlePathInteraction, { passive: true });
      });

      return () => {
        paths.forEach((path) => {
          path.removeEventListener('mouseenter', handlePathInteraction);
          path.removeEventListener('click', handlePathInteraction);
          path.removeEventListener('touchstart', handlePathInteraction);
        });
      };
    }, 400);

    return () => clearTimeout(timer);
  }, [isOpen, scale, position]);

  return (
    <div className="w-full border-2 border-border-dark bg-surface p-4 sm:p-5 shadow-hard-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Left side: Stats & Level */}
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Traveler Rank:</span>
          <span className="text-xl font-black uppercase text-primary tracking-tight">
            {levelInfo.title}
          </span>
          <span className="text-xs text-secondary font-semibold">
            &bull; {levelInfo.description}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-secondary shrink-0">Progress:</span>
            <div className="w-32 h-3.5 bg-soft-beige border-2 border-border-dark relative overflow-hidden shrink-0">
              <div 
                className="h-full bg-accent-coral border-r-2 border-border-dark transition-all duration-500" 
                style={{ width: `${Math.min(100, Math.max(4, (uniqueCount / 82) * 100))}%` }}
              />
            </div>
          </div>
          <span className="text-[11px] font-bold uppercase text-accent-coral">
            {uniqueCount} / 82 Provinces Explored
          </span>
        </div>

        {uniqueCount > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5 items-center max-h-16 overflow-y-auto pr-1">
            <span className="text-[10px] font-black uppercase text-secondary mr-1">Unlocked:</span>
            {uniqueProvinces.sort().map((prov) => (
              <span 
                key={prov} 
                className="px-1.5 py-0.5 text-[9px] font-bold border border-border-dark bg-accent-yellow/10 text-primary shadow-hard-xs"
              >
                {prov}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right side: Open Map Modal Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="shrink-0 w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 border-2 border-border-dark bg-white shadow-hard-sm hover:bg-soft-beige active:translate-y-0.5 transition-all font-black text-xs uppercase text-primary"
      >
        <MapIcon className="w-4 h-4 text-accent-coral shrink-0" />
        <span>Open Travel Map</span>
      </button>

      {/* Large Modal for Interactive Map */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-border-dark max-w-xl w-full shadow-hard animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b-2 border-border-dark p-4 bg-white z-10">
              <div className="flex items-center gap-2">
                <MapIcon className="w-5 h-5 text-accent-coral shrink-0" />
                <span className="font-black uppercase tracking-tight text-md">Travel Map - {uniqueCount}/82 Collected</span>
              </div>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  resetMap();
                }} 
                className="p-1 hover:bg-soft-beige border border-transparent hover:border-border-dark"
              >
                <X className="w-5 h-5 text-primary" />
              </button>
            </div>

            {/* Modal Body / Map Container */}
            <div className="flex-1 overflow-hidden p-6 bg-white flex flex-col items-center gap-4 relative">
              
              {/* Selected Province Info Panel */}
              <div className="w-full text-center py-2.5 px-4 border-2 border-border-dark bg-soft-beige/30 font-bold uppercase tracking-wider text-xs z-10">
                {inspectedProvince ? (
                  <span>
                    {inspectedProvince} &mdash;{' '}
                    <span className={uniqueProvinces.includes(inspectedProvince) ? 'text-accent-coral' : 'text-secondary'}>
                      {uniqueProvinces.includes(inspectedProvince) ? 'Visited' : 'Unvisited'}
                    </span>
                  </span>
                ) : (
                  <span className="text-secondary font-medium normal-case">Hover or tap a province to inspect details</span>
                )}
              </div>
              
              {/* Dynamic Interactive SVG Map Container */}
              <div 
                className="relative w-full h-[380px] sm:h-[450px] border-2 border-border-dark bg-soft-beige/20 shadow-hard-sm overflow-hidden cursor-grab active:cursor-grabbing select-none"
                style={{ touchAction: 'none' }} // Prevents browser scroll on touch movements inside the map
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleDragEnd}
                onWheel={handleWheel}
              >
                {/* Transform Wrapper */}
                <div 
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                    transformOrigin: 'center center',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                  }}
                  className="w-full h-full flex items-center justify-center map"
                >
                  <div className="w-[380px] h-[480px] flex items-center justify-center">
                    <Philippines
                      type="select-single"
                      size={440}
                      mapColor="#fffdf9"
                      strokeColor="#1a1a1a"
                      strokeWidth={0.5}
                      selectColor="#f25c54"
                      hoverColor="#ffe1a8"
                      cityColors={cityColors}
                      disableClick={true}
                      hints={false} // Disable internal fixed-position tooltips
                    />
                  </div>
                </div>

                {/* Neubrutalist Zoom Controls Overlay inside the Map frame */}
                <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-20">
                  <button 
                    onClick={zoomIn} 
                    className="w-8 h-8 flex items-center justify-center border-2 border-border-dark bg-white hover:bg-soft-beige shadow-hard-xs font-black"
                    title="Zoom In"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={zoomOut} 
                    className="w-8 h-8 flex items-center justify-center border-2 border-border-dark bg-white hover:bg-soft-beige shadow-hard-xs font-black"
                    title="Zoom Out"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={resetMap} 
                    className="w-8 h-8 flex items-center justify-center border-2 border-border-dark bg-white hover:bg-soft-beige shadow-hard-xs font-black"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="border-t-2 border-border-dark p-4 bg-soft-beige flex gap-3 z-10">
              <button 
                onClick={() => setShowShareModal(true)}
                className="flex-1 py-3 border-2 border-border-dark bg-accent-yellow font-black uppercase text-xs tracking-wider shadow-hard-sm hover:bg-white active:translate-y-0.5 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4 shrink-0" /> Share My Map Card
              </button>
              <button 
                onClick={() => {
                  setIsOpen(false);
                  resetMap();
                }}
                className="flex-1 py-3 border-2 border-border-dark bg-white font-black uppercase text-xs tracking-wider shadow-hard-sm hover:bg-soft-beige active:translate-y-0.5 transition-all"
              >
                Close Map
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Card Generator */}
      {showShareModal && (
        <MapShareCard 
          userProfile={userProfile} 
          userTrips={trips} 
          onClose={() => setShowShareModal(false)} 
        />
      )}
    </div>
  );
}
