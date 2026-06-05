'use client';

import React, { useState, useRef, useEffect } from 'react';
import { TripWithPhotos } from '@/app/profile/page';
import { toPng } from 'html-to-image';
import ExportableTripCard, { CardFormat, CardTheme } from './ExportableTripCard';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { SelectInput } from '@/components/ui/Inputs';

interface TripCardGeneratorProps {
  trip: TripWithPhotos;
  hasDetailedAccess: boolean;
}

export default function TripCardGenerator({ trip, hasDetailedAccess }: TripCardGeneratorProps) {
  const [format, setFormat] = useState<CardFormat>('square');
  const [theme, setTheme] = useState<CardTheme>('cream');
  
  const [showHero, setShowHero] = useState(true);
  const [showCost, setShowCost] = useState(hasDetailedAccess);
  const [showRoute, setShowRoute] = useState(true);
  const [showTip, setShowTip] = useState(true);
  const [showBrand, setShowBrand] = useState(true);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [copied, setCopied] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.1); // Start small to avoid inflating initial layout measurement

  // Responsive scaling to fit the large high-res card into the screen preview
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        // Calculate available width by subtracting container padding (md:p-8 = 64px, p-4 = 32px) and borders (8px)
        const padding = window.innerWidth >= 768 ? 72 : 40;
        const containerWidth = containerRef.current.clientWidth - padding; 
        let targetWidth = 1080;
        if (format === 'compact') targetWidth = 1200;
        
        const newScale = Math.min(1, containerWidth / targetWidth);
        setScale(newScale);
      }
    };
    
    // Slight delay on initial load to ensure layout is ready
    setTimeout(handleResize, 50);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [format]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    setExportError('');

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 1, // Already large dimensions, don't double it
      });

      const link = document.createElement('a');
      const slug = trip.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      link.download = `itineryey-${slug}-trip-card.png`;
      link.href = dataUrl;
      link.click();
    } catch (err: unknown) {
      console.error(err);
      setExportError("Couldn't export with this photo. Try hiding the hero photo (CORS block) and downloading again.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    const text = `Real trip to ${trip.destination}${trip.origin_region ? ` from ${trip.origin_region}` : ''}\n₱${trip.cost_per_person.toLocaleString()}/head · ${trip.duration_days} day(s) · ${trip.group_size} pax\n\nTip: ${trip.tip || ''}\n\nSee more on ItinerYey.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  // Toggle Checkbox helper
  const ToggleBox = ({ label, checked, onChange, disabled = false, description = '' }: { label: string, checked: boolean, onChange: (c: boolean) => void, disabled?: boolean, description?: string }) => (
    <label className={`flex flex-col border-2 border-border-dark p-3 cursor-pointer ${disabled ? 'opacity-50 bg-gray-100 cursor-not-allowed' : 'bg-white hover:bg-soft-beige transition-colors'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-6 h-6 border-2 border-border-dark flex items-center justify-center bg-white flex-shrink-0`}>
          {checked && <div className="w-3 h-3 bg-primary" />}
        </div>
        <span className="font-bold text-sm uppercase tracking-wide">{label}</span>
      </div>
      {description && <p className="text-xs text-secondary mt-2 ml-9">{description}</p>}
      <input type="checkbox" checked={checked} onChange={(e) => { if(!disabled) onChange(e.target.checked); }} className="hidden" disabled={disabled} />
    </label>
  );

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start pb-24 xl:pb-0">
      
      {/* Left: Preview Area */}
      <div className="w-full min-w-0 xl:flex-1 xl:sticky top-24 z-10" ref={containerRef}>
        <div className="bg-surface border-4 border-border-dark shadow-hard p-4 md:p-8 flex items-center justify-center overflow-hidden min-h-[300px] w-full">
          
          {/* Scaling wrapper */}
          <div 
            className="relative"
            style={{ 
              width: (format === 'compact' ? 1200 : 1080) * scale,
              height: (format === 'story' ? 1920 : format === 'compact' ? 630 : 1080) * scale,
            }}
          >
            <div 
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: format === 'compact' ? 1200 : 1080,
                height: format === 'story' ? 1920 : format === 'compact' ? 630 : 1080,
              }}
            >
              <div ref={cardRef}>
                <ExportableTripCard 
                  trip={trip} 
                  format={format} 
                  theme={theme} 
                  showHero={showHero}
                  showCost={showCost}
                  showRoute={showRoute}
                  showTip={showTip}
                  showBrand={showBrand}
                />
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* Controls Area */}
      <div className="w-full xl:w-[400px] shrink-0 flex flex-col gap-6">
        <div className="bg-white border-4 border-border-dark shadow-hard p-6">
          <h3 className="font-black uppercase tracking-tight text-xl mb-4">Layout Options</h3>
          
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">Format</label>
              <SelectInput 
                value={format} 
                onChange={(e) => setFormat(e.target.value as CardFormat)}
                options={[
                  { value: 'square', label: 'Square Post (1080x1080)' },
                  { value: 'story', label: 'Story (1080x1920)' },
                  { value: 'compact', label: 'Compact / Link (1200x630)' },
                ]}
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-secondary mb-2">Theme</label>
              <div className="grid grid-cols-2 gap-2">
                {(['cream', 'yellow', 'coral', 'blue'] as CardTheme[]).map(t => (
                  <button 
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`p-2 border-2 border-border-dark font-bold text-xs uppercase tracking-wide transition-all ${
                      theme === t 
                        ? 'bg-primary text-white shadow-hard translate-x-[-2px] translate-y-[-2px]' 
                        : 'bg-white hover:bg-soft-beige'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border-4 border-border-dark shadow-hard p-6">
          <h3 className="font-black uppercase tracking-tight text-xl mb-4">Content Toggles</h3>
          <div className="flex flex-col gap-2">
            <ToggleBox label="Hero Photo" checked={showHero} onChange={setShowHero} />
            <ToggleBox 
              label="Cost Breakdown" 
              checked={showCost} 
              onChange={setShowCost} 
              disabled={!hasDetailedAccess}
              description={!hasDetailedAccess ? "Full breakdown unlocks after contributing." : ""}
            />
            <ToggleBox label="Route / Origin" checked={showRoute} onChange={setShowRoute} />
            <ToggleBox label="Traveler Tip" checked={showTip} onChange={setShowTip} />
            <ToggleBox label="ItinerYey Branding" checked={showBrand} onChange={setShowBrand} />
          </div>
        </div>

        <div className="bg-surface border-4 border-border-dark shadow-hard p-6 flex flex-col gap-3">
          {exportError && (
            <div className="p-3 bg-accent-coral text-white font-bold text-xs border-2 border-border-dark mb-2">
              {exportError}
            </div>
          )}
          <PrimaryButton onClick={handleDownload} disabled={isExporting} className="w-full text-lg py-4">
            {isExporting ? 'Generating...' : 'Download PNG'}
          </PrimaryButton>
          <SecondaryButton onClick={handleCopy} className="w-full">
            {copied ? 'Copied to clipboard!' : 'Copy Share Text'}
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}
