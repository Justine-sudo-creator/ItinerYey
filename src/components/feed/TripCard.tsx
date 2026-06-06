import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trip, TripPhoto, TripHosting } from '@/types/supabase';
import { SaveTripButton } from '@/components/trip/SaveTripButton';
import { MapPin, Users, BadgeCheck, CircleDot } from 'lucide-react';

interface TripCardProps {
  trip: Trip;
  heroPhoto?: TripPhoto | null;
  userId?: string | null;
  hostings?: TripHosting[];
}

export function TripCard({ trip, heroPhoto, userId, hostings = [] }: TripCardProps) {
  const originName = trip.origin_city || trip.origin_province || (trip.origin_region ? trip.origin_region.split(',')[0] : 'Unknown');
  const durationLabel = trip.trip_duration_label || `${trip.duration_days} day${trip.duration_days > 1 ? 's' : ''}`;

  // Determine cost suffix
  const categoriesWithCosts = [trip.transport_cost, trip.food_cost, trip.activities_cost, trip.accommodation_cost].filter(c => c && c > 0).length;
  let costSuffix = '';
  if (categoriesWithCosts < 3 && trip.submission_tier === 'basic' && (!trip.detailed_costs || trip.detailed_costs.length === 0)) {
    costSuffix = '+';
  }

  const isTotal = true;

  const getBadgeContext = () => {
    if (trip.group_size === 1 && trip.cost_scope !== 'group_total') {
      return 'Solo';
    }
    if (trip.cost_scope === 'group_total') {
      return `Group total (${trip.group_size} pax)`;
    }
    return `My share (${trip.group_size} pax)`;
  };

  let attributionName = 'Traveler';
  if (trip.users && trip.users.display_name) {
    attributionName = `@${trip.users.display_name}`;
  } else if (!trip.users) {
    attributionName = 'Anonymous Traveler';
  }

  const isBoosted = hostings.some(h => h.is_boosted && h.boost_status === 'approved');
  const hasMeetup = hostings.length > 0;

  return (
    <Link 
      href={`/trip/${trip.id}`} 
      className={`flex flex-col bg-soft-beige border rounded-lg overflow-hidden hover:-translate-y-0.5 transition-all duration-200 shadow-sm hover:shadow-md ${isBoosted ? 'border-accent-yellow ring-2 ring-accent-yellow/20' : 'border-border-dark/15'}`}
    >
      <div className="flex flex-col flex-grow w-full">
        {/* Photo Area */}
        <div className="relative w-full h-44 sm:h-56 border-b border-border-dark/15 overflow-hidden bg-soft-beige/20">
          {heroPhoto ? (
            <div className="relative w-full h-full">
              <Image 
                src={heroPhoto.photo_url} 
                alt={heroPhoto.caption || trip.destination} 
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
                priority={false}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-full p-4 text-center">
              <span className="font-bold text-muted uppercase tracking-widest text-[10px] border border-dashed border-border-dark/20 p-2 rounded">
                No photo yet
              </span>
            </div>
          )}

          {/* Save Button Overlay */}
          <div className="absolute top-2 right-2 z-10 bg-white/90 rounded-full shadow-sm backdrop-blur-sm transition-transform hover:scale-105">
            <SaveTripButton tripId={trip.id} userId={userId || null} initialSaveCount={trip.save_count || 0} />
          </div>

          {/* Badge Tier Indicator Overlay (Icon only) */}
          {trip.is_public !== false && (() => {
            const isDetailed = trip.submission_tier === 'Detailed Trip' || trip.submission_tier === 'full' || (trip.detailed_costs && trip.detailed_costs.length > 0);
            return (
              <div className="absolute top-3 left-3 z-10" title={isDetailed ? 'Detailed Guide' : 'Budget Snapshot'}>
                {isDetailed ? (
                  <BadgeCheck className="w-5 h-5 text-[#10B981] drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)] fill-white" />
                ) : (
                  <CircleDot className="w-5 h-5 text-white/90 drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)] fill-gray-400" />
                )}
              </div>
            );
          })()}

          {/* Hosting Badge Overlay */}
          {hasMeetup && (
            <div className="absolute bottom-2 left-2 z-10 bg-accent-coral text-white border border-border-dark/15 rounded-md px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
              <Users className="w-3 h-3 text-white fill-white/20 shrink-0" />
              <span>Join Meetup</span>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-3 md:p-4 flex flex-col flex-grow gap-2">
          {/* Attribution */}
          <div className="flex items-center gap-1.5">
            <div className="relative w-5 h-5 shrink-0 bg-accent-yellow border border-border-dark/15 rounded-full flex items-center justify-center font-bold text-primary uppercase text-[9px] overflow-hidden">
              {trip.users?.avatar_url ? (
                <Image 
                  src={trip.users.avatar_url} 
                  alt="Avatar" 
                  fill
                  sizes="20px"
                  className="object-cover" 
                />
              ) : (
                attributionName.replace('@', '').charAt(0)
              )}
            </div>
            <p className="text-[10px] md:text-[11px] font-bold text-secondary truncate">
              <span className="hidden sm:inline">Shared by </span>{attributionName}
            </p>
          </div>

          {/* Primary Title (Trip Name or Destination Fallback) */}
          <h3 className="font-display font-bold text-sm sm:text-base md:text-lg leading-tight text-primary line-clamp-1">
            {trip.trip_name ? trip.trip_name : trip.destination}
          </h3>

          {/* Price + Group/Solo metadata */}
          <div className="flex flex-wrap items-baseline gap-1">
            <span className="font-display font-black text-sm sm:text-base md:text-lg text-accent-coral tracking-tight leading-tight">
              ₱{trip.cost_per_person.toLocaleString()}{costSuffix}
            </span>
            <span className="text-[10px] sm:text-[11px] md:text-xs font-bold text-secondary">
              · {getBadgeContext()} · {durationLabel}
            </span>
          </div>

          {/* Destination + Origin */}
          <div className="flex items-center gap-1 text-[11px] sm:text-xs md:text-sm font-bold text-secondary min-w-0">
            <MapPin className="w-3.5 h-3.5 shrink-0 text-secondary" />
            <span>
              {trip.destination} · From {originName}
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-grow"></div>
        </div>
      </div>
    </Link>
  );
}
