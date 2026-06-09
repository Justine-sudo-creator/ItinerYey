'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Users, Calendar, ArrowRight } from 'lucide-react';
import { RetroPanel } from '@/components/ui/Cards';
import { HostMeetupButton } from './HostMeetupButton';

interface MeetupsListContainerProps {
  user: any;
  openHostings: any[];
  userHostedMeetups: any[];
  userJoinedMeetups: any[];
  trips: any[];
  photos: any[];
  membersCountMap: Record<string, number>;
  myTrips: any[];
  savedTrips: any[];
  allTrips: any[];
  successParam?: boolean;
  boostParam?: string;
}

export function MeetupsListContainer({
  user,
  openHostings,
  userHostedMeetups,
  userJoinedMeetups,
  trips,
  photos,
  membersCountMap,
  myTrips,
  savedTrips,
  allTrips,
  successParam,
  boostParam
}: MeetupsListContainerProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');

  // Helper to check active boost duration (7-day limit or target_date)
  const isBoostActive = (hosting: any) => {
    if (!hosting.is_boosted || hosting.boost_status !== 'approved') {
      return false;
    }
    const boostStart = hosting.boosted_at || hosting.created_at;
    if (!boostStart) return false;

    const boostedDate = new Date(boostStart).getTime();
    const eventDate = new Date(hosting.target_date).getTime();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    return (now - boostedDate) < sevenDaysMs && now < eventDate;
  };

  // Helper to calculate boost time remaining
  const getBoostTimeLeft = (hosting: any) => {
    if (!hosting.is_boosted || hosting.boost_status !== 'approved') {
      return null;
    }
    const boostStart = hosting.boosted_at || hosting.created_at;
    if (!boostStart) return null;

    const boostedDate = new Date(boostStart).getTime();
    const eventDate = new Date(hosting.target_date).getTime();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    const boostExpiry = boostedDate + sevenDaysMs;
    const expiry = Math.min(boostExpiry, eventDate);
    const diffMs = expiry - now;
    if (diffMs <= 0) return null;

    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays > 1) {
      return `${diffDays}d left`;
    }
    const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
    if (diffHours > 1) {
      return `${diffHours}h left`;
    }
    const diffMins = Math.ceil(diffMs / (60 * 1000));
    return `${diffMins}m left`;
  };

  // Process and filter meetups based on current active tab on the client
  const displayHostings = useMemo(() => {
    let list = openHostings;
    if (activeTab === 'mine') {
      const joinedHostings = userJoinedMeetups.map(j => j.trip_hosting).filter(Boolean);
      const combined = [...userHostedMeetups];
      joinedHostings.forEach(jh => {
        if (!combined.some(c => c.id === jh.id)) {
          combined.push(jh);
        }
      });
      list = combined;
    }

    // Sort displayHostings: active boosted first, then created_at desc
    return [...list].sort((a, b) => {
      const aBoost = isBoostActive(a);
      const bBoost = isBoostActive(b);
      if (aBoost && !bBoost) return -1;
      if (!aBoost && bBoost) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [activeTab, openHostings, userHostedMeetups, userJoinedMeetups]);

  const formatDate = (dateStr: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(dateStr).toLocaleDateString('en-US', options);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 px-4 flex flex-col gap-8">
      {/* Header section with host action button */}
      <div className="flex flex-row justify-between items-start gap-4">
        <div>
          <h1 className="font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tighter mb-2">
            Active Meetups
          </h1>
          <p className="text-secondary font-medium text-sm sm:text-base max-w-xl leading-relaxed">
            Gusto mong sumama sa gala? Find group travels hosted by verified organizers and fellow travelers in the community.
          </p>
        </div>
        <div className="pt-2">
          <HostMeetupButton 
            isLoggedIn={!!user}
            myTrips={myTrips}
            savedTrips={savedTrips}
            allTrips={allTrips}
          />
        </div>
      </div>

      {/* Success/Pending Boost Banners */}
      {successParam && (
        <div className="w-full animate-in fade-in slide-in-from-top-4 duration-300">
          {boostParam === 'pending' ? (
            <RetroPanel className="border-accent-yellow bg-accent-yellow/5 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-accent-yellow px-2 py-0.5 text-xs font-bold border border-border-dark uppercase">Pending Boost Verification</span>
              </div>
              <p className="text-sm font-semibold text-primary">
                🎉 Meetup successfully published! Your GCash payment verification is currently pending admin review.
              </p>
              <p className="text-xs font-semibold text-secondary">
                Your meetup will be highlighted and pinned to the top as soon as the reference number is verified.
              </p>
            </RetroPanel>
          ) : (
            <RetroPanel className="border-accent-green bg-emerald-50/50 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-[#10B981] text-white px-2 py-0.5 text-xs font-bold border border-border-dark uppercase">Meetup Published</span>
              </div>
              <p className="text-sm font-semibold text-primary">
                🎉 Your meetup is now live! Other travelers can now view and join your group.
              </p>
            </RetroPanel>
          )}
        </div>
      )}

      {/* Tab Selector */}
      {user && (
        <div className="flex border-b-2 border-border-dark font-black uppercase text-xs sm:text-sm select-none gap-6 shrink-0 w-full mb-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-2 transition-all border-b-4 ${
              activeTab === 'all'
                ? 'border-accent-yellow text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            } -mb-[2px]`}
          >
            All Meetups
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`pb-2 transition-all border-b-4 ${
              activeTab === 'mine'
                ? 'border-accent-yellow text-primary'
                : 'border-transparent text-secondary hover:text-primary'
            } -mb-[2px]`}
          >
            My Meetups ({userHostedMeetups.length + userJoinedMeetups.length})
          </button>
        </div>
      )}

      {displayHostings.length === 0 ? (
        <RetroPanel className="text-center py-12 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-200">
          {activeTab === 'mine' ? (
            <>
              <p className="text-secondary font-bold text-lg">Wala ka pang active meetups.</p>
              <p className="text-xs text-secondary max-w-sm">
                You haven&apos;t hosted or joined any group meetups yet.
              </p>
              <button 
                onClick={() => setActiveTab('all')}
                className="inline-flex items-center gap-2 border-2 border-border-dark px-4 py-2 bg-accent-coral text-primary font-black uppercase text-sm shadow-hard transition-all active:translate-y-0.5 active:shadow-none hover:bg-accent-coral/90"
              >
                Explore Active Meetups
              </button>
            </>
          ) : (
            <>
              <p className="text-secondary font-bold text-lg">Wala pang active meetups ngayon.</p>
              <p className="text-xs text-secondary max-w-sm">
                Be the first to organize a trip! Share a trip itinerary first, and then start hosting a group meetup from the trip details page.
              </p>
              <Link 
                href="/submit"
                className="inline-flex items-center gap-2 border-2 border-border-dark px-4 py-2 bg-accent-coral text-primary font-black uppercase text-sm shadow-hard transition-all active:translate-y-0.5 active:shadow-none hover:bg-accent-coral/90"
              >
                Share a Trip
              </Link>
            </>
          )}
        </RetroPanel>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 animate-in fade-in duration-300">
          {displayHostings.map(hosting => {
            const trip = trips.find(t => t.id === hosting.trip_id);
            if (!trip) return null;

            const host = hosting.users;
            const heroPhoto = photos.find(p => p.trip_id === trip.id);
            const joinedCount = membersCountMap[hosting.id] || 0;
            const hostName = host?.display_name || 'Traveler';
            const originCity = trip.origin_city || trip.origin_province || 'Manila';
            const durationLabel = trip.trip_duration_label || `${trip.duration_days} day${trip.duration_days > 1 ? 's' : ''}`;
            const isFeatured = isBoostActive(hosting);
            const spotsRemaining = hosting.slots_needed - joinedCount;

            return (
              <div 
                key={hosting.id}
                className={`flex flex-col bg-soft-beige border rounded-lg overflow-hidden hover:-translate-y-0.5 transition-all duration-200 shadow-sm hover:shadow-md h-full ${
                  hosting.status === 'canceled'
                    ? 'border-accent-coral/30 opacity-75'
                    : isFeatured 
                      ? 'border-accent-yellow ring-2 ring-accent-yellow/20' 
                      : 'border-border-dark/15'
                }`}
              >
                {/* Photo Area */}
                <div className="relative w-full aspect-[16/10] md:aspect-[16/9] border-b border-border-dark/15 overflow-hidden bg-soft-beige/20">
                  {heroPhoto ? (
                    <Image 
                      src={heroPhoto.photo_url} 
                      alt={trip.destination} 
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 33vw"
                      className={`object-cover ${hosting.status === 'canceled' ? 'grayscale opacity-80' : ''}`}
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full p-4 text-center">
                      <span className="font-bold text-muted uppercase tracking-widest text-[8px] md:text-[10px] border border-dashed border-border-dark/20 p-1.5 md:p-2 rounded">
                        No photo yet
                      </span>
                    </div>
                  )}

                  {/* Hosting Tier / Boost Overlay */}
                  {isFeatured && hosting.status !== 'canceled' && (
                    <div className="absolute top-1.5 left-1.5 z-10 bg-accent-yellow border border-border-dark/15 rounded px-1.5 py-0.5 text-[8px] md:text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                      <span>Featured</span>
                      {getBoostTimeLeft(hosting) && (
                        <span className="text-secondary/80 font-bold border-l border-border-dark/20 pl-1">
                          {getBoostTimeLeft(hosting)}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Slots remaining badge */}
                  {hosting.status !== 'canceled' && (
                    <div className="absolute bottom-1.5 right-1.5 z-10 bg-accent-coral text-white border border-border-dark/15 rounded px-1.5 py-0.5 text-[8px] md:text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-0.5 md:gap-1">
                      <Users size={10} className="text-white fill-white/20 shrink-0" />
                      <span>
                        {spotsRemaining > 0 ? `${spotsRemaining} left` : 'Full'}
                      </span>
                    </div>
                  )}

                  {/* Status Overlay */}
                  {hosting.status === 'canceled' ? (
                    <div className="absolute top-1.5 right-1.5 z-10 bg-accent-coral text-white border border-border-dark/15 rounded px-1.5 py-0.5 text-[8px] md:text-[10px] font-black uppercase tracking-wider shadow-sm">
                      Canceled
                    </div>
                  ) : (
                    user && hosting.host_user_id === user.id && (
                      <div className="absolute top-1.5 right-1.5 z-10 flex flex-col gap-1 items-end">
                        {hosting.listing_status === 'pending' && (
                          <span className="bg-accent-yellow text-primary border border-border-dark/15 rounded px-1.5 py-0.5 text-[7px] md:text-[8px] font-black uppercase tracking-wider shadow-sm">
                            Pending Review
                          </span>
                        )}
                        {hosting.listing_status === 'rejected' && (
                          <span className="bg-accent-coral text-white border border-border-dark/15 rounded px-1.5 py-0.5 text-[7px] md:text-[8px] font-black uppercase tracking-wider shadow-sm">
                            Rejected
                          </span>
                        )}
                        {hosting.is_boosted && hosting.boost_status === 'pending' && (
                          <span className="bg-accent-yellow text-primary border border-border-dark/15 rounded px-1.5 py-0.5 text-[7px] md:text-[8px] font-black uppercase tracking-wider shadow-sm">
                            Boost Pending
                          </span>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Content Area */}
                <div className="p-2.5 md:p-4 flex flex-col flex-grow gap-2 md:gap-3">
                  {/* Host Info */}
                  <div className="flex items-center gap-1.5">
                    <div className="relative w-5 h-5 md:w-6 md:h-6 shrink-0 bg-accent-yellow border border-border-dark/15 rounded-full flex items-center justify-center overflow-hidden font-bold text-primary uppercase text-[10px] md:text-xs">
                      {host?.avatar_url ? (
                        <Image 
                          src={host.avatar_url} 
                          alt="Avatar" 
                          fill
                          sizes="24px"
                          className="object-cover" 
                        />
                      ) : (
                        hostName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] md:text-xs font-bold text-primary leading-none truncate">
                        <span className="hidden md:inline text-secondary/80 font-bold">Hosted by </span>@{hostName}
                      </p>
                      {host?.is_verified_organizer && (
                        <span className="text-[7px] md:text-[8px] font-black text-accent-green uppercase tracking-wider block leading-none mt-0.5">Verified</span>
                      )}
                    </div>
                  </div>

                  {/* Destination */}
                  <div className="min-w-0">
                    <h3 className="font-display font-black text-xs sm:text-sm md:text-lg text-primary leading-tight whitespace-normal break-words">
                      {trip.trip_name || trip.destination}
                    </h3>
                    <div className="flex items-start gap-0.5 md:gap-1 text-[9px] sm:text-xs font-bold text-secondary mt-0.5 min-w-0">
                      <MapPin size={10} className="shrink-0 text-secondary mt-0.5" />
                      <span className="whitespace-normal break-words leading-tight text-secondary">
                        {originCity} <span className="text-accent-coral font-bold mx-0.5">to</span> <span className="text-primary font-bold">{trip.destination}</span>
                      </span>
                    </div>
                  </div>

                  {/* Date, Budget, and Duration Grid */}
                  <div className="grid grid-cols-3 gap-1 md:gap-2 py-1.5 md:py-2 border-y border-border-dark/10 border-dashed text-[8px] md:text-[10px]">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-black text-secondary uppercase text-[7px] md:text-[8px] tracking-wider leading-none">Date</span>
                      <div className="font-bold flex items-center gap-0.5 text-primary truncate leading-tight">
                        <span className="truncate">{formatDate(hosting.target_date)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-black text-secondary uppercase text-[7px] md:text-[8px] tracking-wider leading-none">Budget</span>
                      <div className="font-bold flex items-center gap-0.5 text-primary leading-tight">
                        <span className="truncate">₱{trip.cost_per_person.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-black text-secondary uppercase text-[7px] md:text-[8px] tracking-wider leading-none">Duration</span>
                      <div className="font-bold flex items-center gap-0.5 text-primary leading-tight truncate">
                        <span className="truncate">{durationLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Host note */}
                  {hosting.host_note && (
                    <p className="text-[9px] md:text-[11px] font-bold text-secondary italic line-clamp-1 md:line-clamp-2 bg-soft-beige/30 p-1.5 border border-border-dark/10 rounded-sm leading-snug">
                      "{hosting.host_note}"
                    </p>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-wider px-1 md:px-1.5 py-0.5 border border-border-dark/15 bg-white text-secondary rounded shadow-sm">
                      {trip.trip_type}
                    </span>
                    {trip.travel_style && (
                      <span className="text-[8px] md:text-[9px] font-black uppercase tracking-wider px-1 md:px-1.5 py-0.5 border border-border-dark/15 bg-white text-secondary rounded shadow-sm">
                        {trip.travel_style}
                      </span>
                    )}
                  </div>

                  {/* Spacer */}
                  <div className="flex-grow"></div>

                  {/* Action Button */}
                  <Link 
                    href={`/trip/${trip.id}/meetup/${hosting.id}`}
                    className="w-full flex items-center justify-center gap-1 border border-border-dark/15 rounded-md py-1.5 md:py-2.5 bg-accent-yellow text-primary font-black uppercase text-[9px] md:text-xs tracking-wider shadow-sm hover:-translate-y-0.5 active:translate-y-0 transition-all hover:bg-accent-yellow/90 mt-1"
                  >
                    <span>View Meetup</span>
                    <ArrowRight size={12} className="shrink-0" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
