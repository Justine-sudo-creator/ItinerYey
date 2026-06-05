/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { TripWithPhotos } from '@/app/profile/page';

export type CardFormat = 'square' | 'story' | 'compact';
export type CardTheme = 'cream' | 'yellow' | 'coral' | 'blue';

interface ExportableTripCardProps {
  trip: TripWithPhotos;
  format: CardFormat;
  theme: CardTheme;
  showHero: boolean;
  showCost: boolean;
  showRoute: boolean;
  showTip: boolean;
  showBrand: boolean;
}

export default function ExportableTripCard({
  trip,
  format,
  theme,
  showHero,
  showCost,
  showRoute,
  showTip,
  showBrand
}: ExportableTripCardProps) {
  
  const heroPhoto = trip.trip_photos?.find(p => p.is_hero) || trip.trip_photos?.[0];

  // Map formats to exact pixel dimensions to ensure high-quality export
  const formatStyles: Record<CardFormat, { width: number; height: number; scaleMode: string }> = {
    square: { width: 1080, height: 1080, scaleMode: 'aspect-square' },
    story: { width: 1080, height: 1920, scaleMode: 'aspect-[9/16]' },
    compact: { width: 1200, height: 630, scaleMode: 'aspect-[1200/630]' }
  };

  const themeStyles: Record<CardTheme, { bg: string; border: string; textPrimary: string; textSecondary: string; accentBg: string }> = {
    cream: { bg: 'bg-[#F9F6F0]', border: 'border-[#1E1E1E]', textPrimary: 'text-[#1E1E1E]', textSecondary: 'text-[#4A4A4A]', accentBg: 'bg-white' },
    yellow: { bg: 'bg-[#FFE873]', border: 'border-[#1E1E1E]', textPrimary: 'text-[#1E1E1E]', textSecondary: 'text-[#1E1E1E]', accentBg: 'bg-[#FFF8D6]' },
    coral: { bg: 'bg-[#FF6B6B]', border: 'border-[#1E1E1E]', textPrimary: 'text-[#1E1E1E]', textSecondary: 'text-[#1E1E1E]', accentBg: 'bg-[#FFB4B4]' },
    blue: { bg: 'bg-[#4ECDC4]', border: 'border-[#1E1E1E]', textPrimary: 'text-[#1E1E1E]', textSecondary: 'text-[#1E1E1E]', accentBg: 'bg-[#A8E6E2]' }
  };

  const dims = formatStyles[format];
  const colors = themeStyles[theme];

  // Helper to check if a location matches a key destination
  const getDestinationBaseline = (dest: string): number => {
    const d = dest.toLowerCase();
    if (d.includes('tagaytay')) return 2500;
    if (d.includes('union') || d.includes('elyu') || d.includes('san juan')) return 5000;
    if (d.includes('baguio')) return 4500;
    if (d.includes('bgc') || d.includes('bonifacio') || d.includes('manila') || d.includes('makati') || d.includes('ortigas') || d.includes('pasay')) return 1200;
    
    // Check if international
    if (trip.destination_country && trip.destination_country !== 'Philippines') {
      return 7000;
    }
    return 2000; // General domestic fallback
  };

  const getMatipidScore = (): { percentage: number; isWais: boolean } => {
    const baseline = getDestinationBaseline(trip.destination);
    const days = trip.duration_days || 1;
    const cost = trip.cost_per_person || 0;
    
    const dailyCost = cost / days;
    
    if (dailyCost < baseline) {
      const diff = baseline - dailyCost;
      const pct = Math.round((diff / baseline) * 100);
      return { percentage: pct, isWais: true };
    }
    return { percentage: 0, isWais: false };
  };

  const matipid = getMatipidScore();

  // Helper for rendering the inner content based on format layout
  const renderInnerContent = () => {
    const summaryText = trip.trip_summary || `${trip.duration_days}-day trip to ${trip.destination} from ${trip.origin_region}.`;

    if (format === 'compact') {
      return (
        <div className="flex h-full border-[12px] border-[#1E1E1E] relative">
          {/* Wais Traveler Badge for Compact Format */}
          {matipid.isWais && (
            <div className="absolute top-6 right-6 z-10 bg-accent-yellow text-primary border-4 border-[#1E1E1E] px-4 py-2 font-black text-xl uppercase tracking-wider rotate-12 shadow-[4px_4px_0px_#1E1E1E]">
              🎒 WAIS TRAVELER
            </div>
          )}

          {/* Left Side */}
          <div className="w-[45%] h-full flex flex-col border-r-[12px] border-[#1E1E1E]">
            {showHero ? (
              <div className="relative w-full h-full bg-[#1E1E1E]">
                {heroPhoto ? (
                  <img 
                    src={heroPhoto.photo_url} 
                    alt={trip.destination} 
                    className="absolute inset-0 w-full h-full object-cover" 
                    crossOrigin="anonymous" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-3xl text-white opacity-50 bg-[url('/noise.png')]">NO PHOTO</div>
                )}
                {showBrand && (
                  <div className={`absolute top-6 left-6 px-4 py-2 text-2xl font-black uppercase tracking-widest border-4 ${colors.border} ${colors.bg} shadow-[8px_8px_0px_#1E1E1E]`}>
                    ITINERYEY
                  </div>
                )}
              </div>
            ) : (
              <div className={`w-full h-full flex items-center justify-center ${colors.accentBg} p-12`}>
                <h1 className="text-[100px] font-black uppercase leading-[0.9] tracking-tighter text-center">
                  {trip.destination}
                </h1>
              </div>
            )}
          </div>
          
          {/* Right Side */}
          <div className={`w-[55%] h-full p-12 flex flex-col justify-between ${colors.bg}`}>
            <div>
              <div className="flex justify-between items-start mb-8">
                <div>
                  {showHero && <h2 className="text-[72px] font-black uppercase leading-[0.9] tracking-tighter mb-4">{trip.destination}</h2>}
                  <p className="text-[32px] font-bold uppercase tracking-widest">{trip.destination_region}</p>
                </div>
                <div className={`border-[6px] ${colors.border} ${colors.accentBg} px-6 py-4 shadow-[8px_8px_0px_#1E1E1E] text-center`}>
                  <p className="text-[48px] font-black uppercase leading-none">₱{trip.cost_per_person.toLocaleString()}</p>
                  <p className="text-[20px] font-bold uppercase tracking-widest mt-1">
                    {trip.group_size === 1 && trip.cost_scope !== 'group_total'
                      ? 'Solo Spend'
                      : trip.cost_scope === 'group_total'
                      ? 'Group Total'
                      : 'My Share'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mb-8">
                <span className={`border-[4px] ${colors.border} ${colors.accentBg} px-4 py-2 text-[24px] font-bold uppercase tracking-wide`}>
                  {trip.trip_duration_label || `${trip.duration_days} Day${trip.duration_days > 1 ? 's' : ''}`}
                </span>
                <span className={`border-[4px] ${colors.border} ${colors.accentBg} px-4 py-2 text-[24px] font-bold uppercase tracking-wide`}>
                  {trip.group_size} Pax
                </span>
                {showRoute && trip.origin_region && (
                  <span className={`border-[4px] ${colors.border} ${colors.accentBg} px-4 py-2 text-[24px] font-bold uppercase tracking-wide`}>
                    From {trip.origin_region}
                  </span>
                )}
              </div>

              {showTip && trip.tip && (
                <div className={`border-[6px] ${colors.border} ${colors.accentBg} p-6 mb-8`}>
                  <p className="font-black uppercase tracking-widest text-[20px] mb-2">Traveler Tip</p>
                  <p className="text-[28px] font-medium leading-tight line-clamp-4">{trip.tip}</p>
                </div>
              )}
            </div>

            {showBrand && (
              <div className="text-[24px] font-bold uppercase tracking-widest opacity-80">
                Plan better with real trips. <span className="underline decoration-4 underline-offset-8">itineryey.app</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Square and Story Layouts (Vertical flow)
    const isStory = format === 'story';
    
    return (
      <div className={`flex flex-col h-full border-[12px] border-[#1E1E1E] ${colors.bg} relative`}>
        {/* Wais Traveler Badge for Square / Story */}
        {matipid.isWais && (
          <div className="absolute top-[180px] right-[60px] z-10 bg-accent-yellow text-primary border-4 border-[#1E1E1E] px-6 py-3 font-black text-2xl uppercase tracking-wider rotate-12 shadow-[6px_6px_0px_#1E1E1E] animate-pulse">
            🎒 WAIS TRAVELER
          </div>
        )}

        <div className={`flex-1 flex flex-col p-[60px] ${isStory ? 'p-[80px]' : ''}`}>
          
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div className={`border-[4px] ${colors.border} ${colors.accentBg} px-4 py-2 font-black uppercase tracking-widest text-[20px]`}>
              REAL TRIP BOARD
            </div>
            {showBrand && <div className="font-black text-[32px] tracking-tight">ITINERYEY</div>}
          </div>

          {/* Title */}
          <div className="mb-8">
            <h1 className={`${isStory ? 'text-[120px]' : 'text-[96px]'} font-black uppercase leading-[0.9] tracking-tighter mb-2`}>{trip.destination}</h1>
            <p className="text-[36px] font-bold uppercase tracking-widest">{trip.destination_region}</p>
          </div>

          {/* Hero */}
          {showHero && (
            <div className={`relative w-full ${isStory ? 'h-[500px]' : 'h-[360px]'} border-[8px] ${colors.border} mb-8 shadow-[12px_12px_0px_#1E1E1E] bg-[#1E1E1E]`}>
              {heroPhoto ? (
                <img 
                  src={heroPhoto.photo_url} 
                  alt={trip.destination} 
                  className="absolute inset-0 w-full h-full object-cover" 
                  crossOrigin="anonymous" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-3xl text-white opacity-50 bg-[url('/noise.png')]">NO PHOTO</div>
              )}
            </div>
          )}

          {/* Key Facts */}
          <div className="flex flex-wrap gap-4 mb-8">
            <span className={`border-[4px] ${colors.border} ${colors.accentBg} px-6 py-4 shadow-[6px_6px_0px_#1E1E1E]`}>
              <p className="font-bold text-[18px] uppercase tracking-widest mb-1 opacity-80">
                {trip.group_size === 1 && trip.cost_scope !== 'group_total'
                  ? 'Solo Spend'
                  : trip.cost_scope === 'group_total'
                  ? 'Group Total'
                  : 'My Share'}
              </p>
              <p className="font-black text-[42px] leading-none">₱{trip.cost_per_person.toLocaleString()}</p>
            </span>
            <span className={`border-[4px] ${colors.border} ${colors.accentBg} px-6 py-4 flex flex-col justify-center`}>
              <p className="font-black text-[32px] leading-none uppercase">{trip.trip_duration_label || `${trip.duration_days} Day${trip.duration_days > 1 ? 's' : ''}`}</p>
            </span>
            <span className={`border-[4px] ${colors.border} ${colors.accentBg} px-6 py-4 flex flex-col justify-center`}>
              <p className="font-black text-[32px] leading-none uppercase">{trip.group_size} Pax</p>
            </span>
            {showRoute && trip.origin_region && (
              <span className={`border-[4px] ${colors.border} ${colors.accentBg} px-6 py-4 flex flex-col justify-center`}>
                <p className="font-black text-[32px] leading-none uppercase">From {trip.origin_region}</p>
              </span>
            )}
          </div>

          {/* Summary */}
          <div className={`border-[6px] ${colors.border} bg-white p-6 mb-8 shadow-[8px_8px_0px_#1E1E1E]`}>
            <p className={`font-medium ${isStory ? 'text-[28px]' : 'text-[24px]'} leading-tight`}>{summaryText}</p>
          </div>

          {/* Tip */}
          {showTip && trip.tip && (
            <div className={`border-[8px] ${colors.border} ${colors.accentBg} p-8 mb-8 shadow-[12px_12px_0px_#1E1E1E]`}>
              <p className="font-black uppercase tracking-widest text-[24px] mb-4">Traveler Tip</p>
              <p className={`font-medium ${isStory ? 'text-[36px]' : 'text-[32px]'} leading-tight line-clamp-4`}>{trip.tip}</p>
            </div>
          )}

          {/* Cost Breakdown */}
          {showCost && (
            <div className={`mt-auto border-t-[8px] border-dashed ${colors.border} pt-8`}>
              <p className="font-black uppercase tracking-widest text-[24px] mb-4">Detailed Breakdown</p>
              <div className="grid grid-cols-2 gap-4">
                <div className={`border-[4px] ${colors.border} bg-white px-4 py-3 flex justify-between`}>
                  <span className="font-bold text-[24px] uppercase">Transport</span>
                  <span className="font-black text-[24px]">₱{trip.transport_cost?.toLocaleString() || 0}</span>
                </div>
                <div className={`border-[4px] ${colors.border} bg-white px-4 py-3 flex justify-between`}>
                  <span className="font-bold text-[24px] uppercase">Food</span>
                  <span className="font-black text-[24px]">₱{trip.food_cost?.toLocaleString() || 0}</span>
                </div>
                <div className={`border-[4px] ${colors.border} bg-white px-4 py-3 flex justify-between`}>
                  <span className="font-bold text-[24px] uppercase">Activities</span>
                  <span className="font-black text-[24px]">₱{trip.activities_cost?.toLocaleString() || 0}</span>
                </div>
                <div className={`border-[4px] ${colors.border} bg-white px-4 py-3 flex justify-between`}>
                  <span className="font-bold text-[24px] uppercase">Lodging</span>
                  <span className="font-black text-[24px]">₱{trip.accommodation_cost?.toLocaleString() || 0}</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        {showBrand && (
          <div className={`border-t-[12px] ${colors.border} p-6 flex justify-between items-center ${colors.accentBg}`}>
            <span className="font-black text-[28px] uppercase tracking-wide">Plan better with real trips.</span>
            <span className="font-bold text-[24px] underline decoration-4 underline-offset-8">itineryey.app</span>
          </div>
        )}
      </div>
    );
  };


  return (
    <div 
      className={`relative overflow-hidden ${colors.textPrimary}`}
      style={{ 
        width: `${dims.width}px`, 
        height: `${dims.height}px`,
        // Default font family for the export to ensure consistency
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {renderInnerContent()}
    </div>
  );
}
