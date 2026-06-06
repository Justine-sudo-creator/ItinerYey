'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Trip, TripPhoto, TripHosting } from '@/types/supabase';
import { TripCard } from './TripCard';
import { PrimaryButton } from '@/components/ui/Button';
import { ErrorState, EmptyState, LoadingState } from '@/components/ui/States';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, SlidersHorizontal, ArrowUpDown, X } from 'lucide-react';
import { LocationAutocomplete, StructuredLocation } from '@/components/ui/LocationAutocomplete';
import { isCommuteFriendlyTrip } from '@/lib/locations';
import { matchesTransportMode, matchesVibe } from '@/lib/filters';

function getISOWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

const CHALLENGES_QUEUE = [
  {
    hashtag: 'Challenge||CommuterDream',
    title: '100% Commuter Challenge',
    description: 'Share a day-trip using only public transport (jeeps, trikes, buses, trains). No private cars allowed!',
    reward_badge: 'Transit Master||₱500 GCash',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString() // 2h ago
  },
  {
    hashtag: 'Weather||RainySeasonAlert',
    title: 'Habagat Travel Advisory',
    description: 'Heavy rains and wind warnings are up for Northern Luzon. If you have Elyu or Baguio trips planned, keep safe and double-check road advisories!',
    reward_badge: '||||https://pagasa.dost.gov.ph||https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=500',
    created_at: new Date(Date.now() - 6 * 3600000).toISOString() // 6h ago
  },
  {
    hashtag: 'Shoutout||LeaderboardSpotlight',
    title: 'Top Contributor Spotlight!',
    description: 'Shoutout to our top contributor @JustineMationg for sharing 3 amazing budget itineraries and leading the leaderboard! Salute!',
    reward_badge: '||||/profile?id=justine-id||',
    created_at: new Date(Date.now() - 24 * 3600000).toISOString() // Yesterday
  },
  {
    hashtag: 'News||RemixFeature',
    title: 'New Feature: Remix Itineraries',
    description: 'You can now copy any public trip itinerary as a custom template in your own locker. Plan faster, customize budget categories, and go!',
    reward_badge: '||||/submit||https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=500',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString() // 3d ago
  },
  {
    hashtag: 'Challenge||ElyuBeachVibe',
    title: 'La Union Beach Trip',
    description: 'Share a weekend beach budget for San Juan, La Union under ₱4,000 per head.',
    reward_badge: 'Wave Chaser||₱500 GCash',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString() // 5d ago
  }
];


type Filters = {
  destinationTypes: string[];
  maxBudget: number;
  duration: string;
  groupType: string;
  travelStyle: string;
  transportModes: string[];
  vibes: string[];
  originQuery: string;
  originStructured: StructuredLocation | null;
};

const defaultFilters: Filters = {
  destinationTypes: [],
  maxBudget: 10000,
  duration: 'Any',
  groupType: 'Any',
  travelStyle: 'Any',
  transportModes: [],
  vibes: [],
  originQuery: '',
  originStructured: null
};

interface ActiveChallenge {
  title: string;
  hashtag: string;
  description: string;
  reward_badge: string;
  created_at?: string;
}

function formatRelativeTime(dateStr: string | undefined | null) {
  if (!dateStr) return null;
  try {
    const created = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    if (diffMs < 0) return 'Just now';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  } catch (e) {
    return null;
  }
}

export function BrowseFeed() {
  const supabase = createClient();
  const router = useRouter();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [hostings, setHostings] = useState<TripHosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [tempFilters, setTempFilters] = useState<Filters>(defaultFilters);
  const [sortBy, setSortBy] = useState('Recently Added');

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSortModalOpen, setIsSortModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  interface LeaderboardUser {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    total_vouches: number;
  }

  const [activeChallenge, setActiveChallenge] = useState<ActiveChallenge | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [leaderboardUsers, setLeaderboardUsers] = useState<LeaderboardUser[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id || null);
    });
    fetchTrips();
    fetchChallengeAndLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchChallengeAndLeaderboard = async () => {
    try {
      // 1. Check if admin
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user?.email;
      if (email) {
        const adminList = ['justinemationg12@gmail.com'];
        if (adminList.includes(email.toLowerCase())) {
          setIsAdmin(true);
        }
      }

      // 2. Fetch active challenge from DB
      const typedSupabase = supabase as unknown as {
        from: (table: string) => {
          select: (fields: string) => {
            order: (field: string, options?: { ascending?: boolean }) => {
              limit: (n: number) => Promise<{ data: ActiveChallenge[] | null }>;
            };
          };
        };
      };

      const { data: challengeData } = await typedSupabase
        .from('active_challenge')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (challengeData && challengeData.length > 0) {
        setActiveChallenge(challengeData[0]);
      } else {
        // Fallback to local storage or automatic week-based queue
        const local = localStorage.getItem('itineryey_custom_challenge');
        if (local) {
          const parsed = JSON.parse(local);
          setActiveChallenge(parsed);
        } else {
          const weekNo = getISOWeekNumber(new Date());
          const fallback = CHALLENGES_QUEUE[weekNo % CHALLENGES_QUEUE.length];
          setActiveChallenge(fallback);
        }
      }

      // 3. Fetch top contributors for leaderboard widget
      const { data: boardData } = await supabase
        .from('users')
        .select('id, display_name, avatar_url, total_vouches')
        .gt('total_vouches', 0)
        .order('total_vouches', { ascending: false })
        .limit(10);
      
      if (boardData) {
        setLeaderboardUsers(boardData);
      }
    } catch (err) {
      console.error("Failed to load challenges/leaderboard", err);
      // Fallback
      const local = localStorage.getItem('itineryey_custom_challenge');
      if (local) {
        const parsed = JSON.parse(local);
        setActiveChallenge(parsed);
      } else {
        const weekNo = getISOWeekNumber(new Date());
        const fallback = CHALLENGES_QUEUE[weekNo % CHALLENGES_QUEUE.length];
        setActiveChallenge(fallback);
      }
    }
  };

  const fetchTrips = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: fetchedTrips, error: tripsError } = await supabase
        .from('trips')
        .select('*, trip_stops(*), trip_days(*), users!trips_user_id_fkey(display_name, avatar_url)')
        .eq('is_approved', true)
        .eq('is_public', true); // Removed order by here since client-side sort handles it

      if (tripsError) throw tripsError;

      if (fetchedTrips && fetchedTrips.length > 0) {
        const tripIds = fetchedTrips.map(t => t.id);
        const { data: fetchedPhotos, error: photosError } = await supabase
          .from('trip_photos')
          .select('*')
          .eq('is_hero', true)
          .in('trip_id', tripIds);

        if (photosError) throw photosError;
        
        const { data: fetchedHostings, error: hostingsError } = await supabase
          .from('trip_hosting')
          .select('*')
          .eq('status', 'open')
          .in('trip_id', tripIds);
          
        if (hostingsError) throw hostingsError;

        setTrips(fetchedTrips);
        setPhotos(fetchedPhotos || []);
        setHostings(fetchedHostings || []);
      } else {
        setTrips([]);
        setPhotos([]);
        setHostings([]);
      }
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = (err as Error)?.message || String(err);
      setError(`Couldn't load trips. Details: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const processedTrips = useMemo(() => {
    let result = trips;

    // Apply Filters
    result = result.filter(trip => {
      // Destination Types (OR logic if multiple selected)
      if (filters.destinationTypes.length > 0) {
        const matchesDest = filters.destinationTypes.some(type => {
          switch (type) {
            case 'Commute-Friendly':
              return isCommuteFriendlyTrip(trip);
            case 'Beach':
              return (trip.trip_type || '').includes('Beach');
            case 'Nature':
              return (trip.trip_type || '').includes('Nature');
            case 'City':
              return (trip.trip_type || '').includes('City');
            default:
              return false;
          }
        });
        if (!matchesDest) return false;
      }

      // Travel Origin
      if (filters.originStructured) {
        const { city, province } = filters.originStructured;
        const tripCity = (trip.origin_city || '').toLowerCase();
        const tripProvince = (trip.origin_province || '').toLowerCase();

        const matchCity = city ? tripCity.includes(city.toLowerCase()) : false;
        const matchProvince = province ? tripProvince.includes(province.toLowerCase()) : false;

        if (!matchCity && !matchProvince) {
          return false;
        }
      }

      // Budget
      if (trip.cost_per_person > filters.maxBudget) return false;

      // Duration
      if (filters.duration !== 'Any') {
        if (filters.duration === 'Day Trip' && trip.duration_days !== 1) return false;
        if (filters.duration === 'No Overnight' && !(trip.accommodation_cost === 0 || trip.duration_days === 1)) return false;
        if (filters.duration === 'Weekend Getaway (2-3 Days)' && !(trip.duration_days === 2 || trip.duration_days === 3)) return false;
        if (filters.duration === 'Extended Trip (4-7 Days)' && !(trip.duration_days >= 4 && trip.duration_days <= 7)) return false;
        if (filters.duration === 'Long Vacation (8+ Days)' && trip.duration_days < 8) return false;
      }

      // Group Type
      if (filters.groupType !== 'Any') {
        if (filters.groupType === 'Solo' && !(trip.group_type === 'Solo' || trip.group_size === 1)) return false;
        if (filters.groupType === 'Partner' && !(trip.group_type === 'Partner' || trip.group_size === 2)) return false;
        if (filters.groupType === 'Barkada' && !(trip.group_type === 'Friends' || trip.group_size >= 3)) return false;
        if (filters.groupType === 'Family' && trip.group_type !== 'Family') return false;
      }

      // Travel Style
      if (filters.travelStyle !== 'Any') {
        if (filters.travelStyle === 'Splurge / Luxury') {
          if (trip.travel_style !== 'Splurge' && trip.cost_per_person <= 5000) return false;
        } else {
          if (trip.travel_style !== filters.travelStyle) return false;
        }
      }

      // Transport Modes
      if (filters.transportModes.length > 0) {
        const matchesTransport = filters.transportModes.some(mode => matchesTransportMode(trip, mode));
        if (!matchesTransport) return false;
      }

      // Vibes & Activities
      if (filters.vibes.length > 0) {
        const matchesVibeFilter = filters.vibes.some(vibe => matchesVibe(trip, vibe));
        if (!matchesVibeFilter) return false;
      }

      return true;
    });

    // Apply Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(trip => {
        return (
          (trip.destination || '').toLowerCase().includes(q) ||
          (trip.destination_region || '').toLowerCase().includes(q) ||
          (trip.origin_region || '').toLowerCase().includes(q) ||
          (trip.trip_type || '').toLowerCase().includes(q) ||
          (trip.travel_style || '').toLowerCase().includes(q) ||
          (trip.trip_summary || '').toLowerCase().includes(q) ||
          (trip.tip || '').toLowerCase().includes(q)
        );
      });
    }

    // Apply Sort
    result = [...result].sort((a, b) => {
      // 1. Boosted trips always on top
      const aBoosted = hostings.some(h => h.trip_id === a.id && h.is_boosted && h.boost_status === 'approved');
      const bBoosted = hostings.some(h => h.trip_id === b.id && h.is_boosted && h.boost_status === 'approved');
      if (aBoosted && !bBoosted) return -1;
      if (!aBoosted && bBoosted) return 1;
      
      switch (sortBy) {
        case 'Recently Added':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'Budget: Low to High':
          return a.cost_per_person - b.cost_per_person;
        case 'Budget: High to Low':
          return b.cost_per_person - a.cost_per_person;
        case 'Shortest Trip':
          return a.duration_days - b.duration_days;
        case 'Longest Trip':
          return b.duration_days - a.duration_days;
        case 'Most Saved':
          return (b.save_count || 0) - (a.save_count || 0);
        default:
          return 0;
      }
    });

    return result;
  }, [trips, filters, searchQuery, sortBy, hostings]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.destinationTypes.length > 0) count += filters.destinationTypes.length;
    if (filters.maxBudget < 10000) count += 1;
    if (filters.duration !== 'Any') count += 1;
    if (filters.groupType !== 'Any') count += 1;
    if (filters.travelStyle !== 'Any') count += 1;
    if (filters.originQuery) count += 1;
    return count;
  }, [filters]);

  const getActiveFilterSummary = () => {
    const summary = [];
    if (filters.destinationTypes.length > 0) summary.push(filters.destinationTypes.join(', '));
    if (filters.originQuery) summary.push(`Starts: ${filters.originQuery}`);
    if (filters.maxBudget < 10000) summary.push(`Up to ₱${filters.maxBudget.toLocaleString()}`);
    if (filters.duration !== 'Any') summary.push(filters.duration);
    if (filters.groupType !== 'Any') summary.push(filters.groupType);
    if (filters.travelStyle !== 'Any') summary.push(filters.travelStyle);
    return summary.join(' · ');
  };

  const openFilterModal = () => {
    setTempFilters(filters);
    setIsFilterModalOpen(true);
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setIsFilterModalOpen(false);
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
    setTempFilters(defaultFilters);
  };

  if (loading) {
    return <LoadingState message="Loading real trips..." />;
  }

  if (error) {
    return (
      <ErrorState 
        title="Error" 
        message={error} 
        action={<PrimaryButton onClick={fetchTrips}>Retry</PrimaryButton>} 
      />
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* 2-Column Section: Active Challenge (Left) & Leaderboard Widget (Right) */}
      <div className="flex flex-col md:grid md:grid-cols-12 gap-3 w-full">
        {/* Column: Bulletin Board (Full-width on mobile, 7/12 cols on desktop) */}
        <div className="w-full md:col-span-8 flex">
          {activeChallenge ? (() => {
            const hashtagRaw = activeChallenge.hashtag || '';
            let type = 'Challenge';
            let hashtag = '';
            if (hashtagRaw.includes('||')) {
              const parts = hashtagRaw.split('||');
              type = parts[0] || 'Challenge';
              hashtag = parts[1] || '';
            } else {
              hashtag = hashtagRaw;
            }

            const rewardRaw = activeChallenge.reward_badge || '';
            let badge = '';
            let reward = '';
            let actionLink = '';
            let polaroidUrl = '';
            if (rewardRaw.includes('||')) {
              const parts = rewardRaw.split('||');
              badge = parts[0] || '';
              reward = parts[1] || '';
              actionLink = parts[2] || '';
              polaroidUrl = parts[3] || '';
            } else {
              badge = rewardRaw;
            }

            const relativeTime = activeChallenge.created_at ? formatRelativeTime(activeChallenge.created_at) : null;

            const NOTE_STYLES: Record<string, { bg: string; badgeBg: string; text: string; label: string; icon: string }> = {
              Challenge: {
                bg: 'bg-[#FEF08A] text-[#713F12]', // Yellow
                badgeBg: 'bg-[#CA8A04] text-white',
                text: 'text-[#854D0E]',
                label: 'Challenge',
                icon: '🏆'
              },
              Weather: {
                bg: 'bg-[#E0F2FE] text-[#0369A1]', // Blue
                badgeBg: 'bg-[#0284C7] text-white',
                text: 'text-[#075985]',
                label: 'Weather',
                icon: '🌦️'
              },
              Shoutout: {
                bg: 'bg-[#FFE4E6] text-[#BE123C]', // Pink/Rose
                badgeBg: 'bg-[#E11D48] text-white',
                text: 'text-[#9F1239]',
                label: 'Shoutout',
                icon: '📣'
              },
              News: {
                bg: 'bg-[#DCFCE7] text-[#15803D]', // Mint/Green
                badgeBg: 'bg-[#16A34A] text-white',
                text: 'text-[#166534]',
                label: 'News',
                icon: '⚡'
              },
              General: {
                bg: 'bg-[#FAFAF9] text-[#44403C]', // Cream
                badgeBg: 'bg-[#57534E] text-white',
                text: 'text-[#292524]',
                label: 'Notice',
                icon: '📌'
              }
            };

            const style = NOTE_STYLES[type] || NOTE_STYLES[type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()] || NOTE_STYLES.General;

            return (
              <div className="w-full bg-[#E5D3C3] border-4 border-[#785942] rounded-lg p-2 md:p-3 shadow-hard relative flex gap-2 sm:gap-3 h-[210px] md:h-[240px] overflow-hidden bg-[radial-gradient(#cbb09c_2px,transparent_2px)] [background-size:16px_16px]">
                {/* Pinned Sticky Note */}
                <div className={`flex-1 flex flex-col justify-between p-3 md:p-4 shadow-md border border-black/10 rotate-[-1.5deg] relative transition-transform hover:rotate-0 duration-200 ${style.bg}`}>
                  {/* Pushpin at the top center */}
                  <div className="absolute top-[-8px] left-1/2 -translate-x-1/2 z-20 text-sm md:text-lg drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.35)] select-none">
                    📌
                  </div>
                  
                  <div className="flex-1 min-w-0 pr-[72px] sm:pr-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[7px] md:text-[9px] font-black tracking-widest uppercase border border-black/10 rounded px-1.5 py-0.5 shadow-sm ${style.badgeBg}`}>
                        {style.icon} {style.label}
                      </span>
                      {hashtag && (
                        <div className="inline-block px-1.5 py-0.5 bg-[#4A3728] text-white border border-black/10 rounded font-black text-[8px] md:text-[10px] tracking-wide">
                          #{hashtag}
                        </div>
                      )}
                      {relativeTime && (
                        <span className="text-[7px] md:text-[9px] font-black uppercase tracking-wide opacity-50 ml-1">
                          · {relativeTime}
                        </span>
                      )}
                    </div>
                    <h2 className="font-display font-black text-xs md:text-base lg:text-lg text-primary tracking-tight leading-tight mt-1.5 line-clamp-1">
                      {activeChallenge.title}
                    </h2>
                    <p className={`text-[9px] md:text-xs font-bold leading-snug mt-1 line-clamp-3 ${style.text}`}>
                      {activeChallenge.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2 shrink-0 pt-1.5 border-t border-black/10 border-dashed mt-1.5">
                    {/* Action link or reward badges */}
                    <div className="flex flex-wrap gap-1 max-w-full overflow-hidden">
                      {type.toLowerCase() === 'challenge' ? (
                        <>
                          {badge && (
                            <span className="text-[7px] md:text-[9px] font-black text-[#BE123C] bg-white border border-black/15 rounded px-1.5 py-0.5 shadow-sm inline-block whitespace-nowrap">
                              {badge}
                            </span>
                          )}
                          {reward && (
                            <span className="text-[7px] md:text-[9px] font-black text-[#15803D] bg-white border border-black/15 rounded px-1.5 py-0.5 shadow-sm inline-block whitespace-nowrap">
                              {reward}
                            </span>
                          )}
                        </>
                      ) : actionLink ? (
                        <Link 
                          href={actionLink}
                          target={actionLink.startsWith('http') ? '_blank' : undefined}
                          rel={actionLink.startsWith('http') ? 'noopener noreferrer' : undefined}
                          className="px-2 py-0.5 text-[7px] md:text-[9px] font-black uppercase bg-[#4A3728] text-white border border-black/20 rounded shadow-sm hover:translate-y-0.5 hover:shadow-none transition-all"
                        >
                          {actionLink.startsWith('http') ? 'Read More →' : 'See Details →'}
                        </Link>
                      ) : null}
                    </div>

                    {isAdmin && (
                      <Link 
                        href="/admin"
                        className="text-[7px] md:text-[9px] font-black uppercase underline text-[#4A3728] hover:text-accent-coral cursor-pointer shrink-0 align-bottom"
                      >
                        Edit Board
                      </Link>
                    )}
                  </div>
                </div>

                {/* Optional Polaroid Photo - Styled to never overlap text on mobile */}
                {polaroidUrl && (
                  <div className="absolute right-2.5 top-3 sm:static flex flex-col bg-white border border-black/10 p-1 md:p-1.5 pb-2 md:pb-3 shadow-md rotate-[3deg] hover:rotate-0 duration-200 transition-transform w-[68px] md:w-[100px] shrink-0 self-center z-10">
                    <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 z-20 text-[8px] md:text-sm drop-shadow-[0_1.5px_1.5px_rgba(0,0,0,0.3)] select-none">
                      📍
                    </div>
                    <div className="w-full aspect-square relative bg-[#1E1E1E] overflow-hidden border border-black/5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={polaroidUrl} 
                        alt="Pinned photo" 
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-center font-display font-bold text-[5px] md:text-[8px] text-secondary mt-1 truncate">
                      {hashtag || 'Byahe'}
                    </div>
                  </div>
                )}
              </div>
            );
          })() : (
            <div className="w-full bg-[#E5D3C3] border-4 border-[#785942] rounded-lg p-4 shadow-hard flex justify-center items-center text-center h-[210px] md:h-[240px]">
              <p className="text-xs font-bold text-[#4A3728]">Paskilan is empty right now.</p>
            </div>
          )}
        </div>

        {/* Scrollable Leaderboard Widget (Full-width on mobile, 5/12 cols on desktop) */}
        <div className="w-full md:col-span-4 flex flex-col">
          <div className="w-full bg-surface border border-border-dark/15 rounded-lg overflow-hidden shadow-sm flex flex-col h-[162px] md:h-[240px]">
            <div className="bg-primary text-white p-2 flex items-center justify-between border-b border-border-dark/15 shrink-0">
              <span className="font-display font-black text-[9px] md:text-xs uppercase tracking-wider">
                Leaderboard
              </span>
              <span className="text-[8px] md:text-[9px] bg-accent-yellow text-primary border border-border-dark/15 rounded px-1.5 font-bold uppercase">
                Top
              </span>
            </div>
            
            <div className="flex-1 overflow-auto divide-y divide-border-dark/10 custom-scrollbar">
              {leaderboardUsers.length === 0 ? (
                <div className="p-4 text-center text-[10px] md:text-xs text-secondary font-medium italic">
                  Join the board! Share a helpful trip.
                </div>
              ) : (
                leaderboardUsers.map((user, idx) => {
                  const displayName = user.display_name || 'Traveler';
                  const isTop3 = idx < 3;
                  const medalColors = ['text-yellow-500', 'text-gray-400', 'text-amber-700'];
                  
                  return (
                    <div 
                      key={user.id} 
                      className={`flex items-center gap-2 p-2 hover:bg-soft-beige transition-colors min-w-[220px] md:min-w-0 ${
                        isTop3 ? 'bg-accent-yellow/5' : ''
                      }`}
                    >
                      <div className="w-5 shrink-0 flex justify-center text-[10px] md:text-xs font-bold text-secondary">
                        {isTop3 ? (
                          <span className={`font-black text-sm ${medalColors[idx]}`}>★</span>
                        ) : (
                          `#${idx + 1}`
                        )}
                      </div>
                      
                      <div className="flex-1 flex items-center gap-1.5 min-w-0 whitespace-nowrap">
                        <Link 
                          href={`/profile?id=${user.id}`}
                          className="w-6 h-6 shrink-0 bg-accent-yellow border border-border-dark/15 rounded-full flex items-center justify-center overflow-hidden font-bold text-primary uppercase text-[10px] hover:opacity-85 transition-opacity"
                        >
                          {user.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={user.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                          ) : (
                            displayName.charAt(0).toUpperCase()
                          )}
                        </Link>
                        <span className="font-bold text-[10px] md:text-xs text-primary">
                          {displayName}
                        </span>
                      </div>
                      
                      <div className="shrink-0">
                        <span className="text-[9px] md:text-[10px] font-black text-secondary">
                          {user.total_vouches} vouches
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>



      {/* Search Bar & Controls */}
      <div className="flex flex-row items-stretch gap-2 w-full">
        {/* Search Bar */}
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-secondary" />
          </div>
          <input
            type="text"
            placeholder="Search destination, region..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-full min-h-[48px] pl-10 pr-2 md:pr-4 py-2 md:py-3 bg-soft-beige border-2 border-border-dark rounded-sm focus:outline-none focus:ring-0 placeholder:text-secondary/70 font-medium transition-colors text-sm md:text-base"
            aria-label="Search trips"
          />
        </div>

        {/* Sort / Filter Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setIsSortModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-3 bg-soft-beige border-2 border-border-dark rounded-sm text-sm font-bold active:translate-y-[2px] active:translate-x-[2px] shadow-hard-sm transition-all h-full min-h-[48px]"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="hidden sm:inline">Sort</span>
          </button>
          <button 
            onClick={openFilterModal}
            className="flex items-center justify-center gap-1.5 px-3 bg-soft-beige border-2 border-border-dark rounded-sm text-sm font-bold active:translate-y-[2px] active:translate-x-[2px] shadow-hard-sm transition-all relative h-full min-h-[48px]"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filter {activeFilterCount > 0 && `(${activeFilterCount})`}</span>
            {activeFilterCount > 0 && <span className="sm:hidden">({activeFilterCount})</span>}
          </button>
        </div>
      </div>

      {/* Active Filters Summary */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 text-xs font-bold text-secondary flex-wrap">
          <span>Filtered: {getActiveFilterSummary()}</span>
          <button 
            onClick={clearFilters}
            className="flex items-center gap-1 hover:text-primary transition-colors uppercase tracking-wide ml-2"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}

      {/* Results Count */}
      <div className="flex justify-between items-end border-b-2 border-border-dark pb-2 mt-2">
        <p className="text-sm font-bold text-primary uppercase tracking-wide">
          {trips.length === 0
            ? 'No approved trips yet'
            : searchQuery 
            ? `Results for "${searchQuery}"`
            : activeFilterCount > 0
              ? `Showing ${processedTrips.length} matching trips`
              : 'Showing latest trips'
          }
        </p>
      </div>

      {/* Trip Feed */}
      {processedTrips.length > 0 ? (
        <>
          {/* 2-Column Mobile Masonry */}
          <div className="flex gap-3 w-full mt-2 lg:hidden">
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              {processedTrips.filter((_, idx) => idx % 2 === 0).map(trip => (
                <TripCard 
                  key={trip.id} 
                  trip={trip} 
                  heroPhoto={photos.find(p => p.trip_id === trip.id)} 
                  userId={userId}
                  hostings={hostings.filter(h => h.trip_id === trip.id)}
                />
              ))}
            </div>
            <div className="flex flex-col gap-3 flex-1 min-w-0">
              {processedTrips.filter((_, idx) => idx % 2 === 1).map(trip => (
                <TripCard 
                  key={trip.id} 
                  trip={trip} 
                  heroPhoto={photos.find(p => p.trip_id === trip.id)} 
                  userId={userId}
                  hostings={hostings.filter(h => h.trip_id === trip.id)}
                />
              ))}
            </div>
          </div>

          {/* 3-Column Desktop Masonry */}
          <div className="hidden lg:flex gap-6 w-full mt-2">
            <div className="flex flex-col gap-6 flex-1 min-w-0">
              {processedTrips.filter((_, idx) => idx % 3 === 0).map(trip => (
                <TripCard 
                  key={trip.id} 
                  trip={trip} 
                  heroPhoto={photos.find(p => p.trip_id === trip.id)} 
                  userId={userId}
                  hostings={hostings.filter(h => h.trip_id === trip.id)}
                />
              ))}
            </div>
            <div className="flex flex-col gap-6 flex-1 min-w-0">
              {processedTrips.filter((_, idx) => idx % 3 === 1).map(trip => (
                <TripCard 
                  key={trip.id} 
                  trip={trip} 
                  heroPhoto={photos.find(p => p.trip_id === trip.id)} 
                  userId={userId}
                  hostings={hostings.filter(h => h.trip_id === trip.id)}
                />
              ))}
            </div>
            <div className="flex flex-col gap-6 flex-1 min-w-0">
              {processedTrips.filter((_, idx) => idx % 3 === 2).map(trip => (
                <TripCard 
                  key={trip.id} 
                  trip={trip} 
                  heroPhoto={photos.find(p => p.trip_id === trip.id)} 
                  userId={userId}
                  hostings={hostings.filter(h => h.trip_id === trip.id)}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="mt-8">
          {trips.length === 0 ? (
            <EmptyState 
              title="Wala pang approved trips."
              message="Once trips are reviewed, they'll appear here. You can already share your own byahe to help build the board."
              action={<PrimaryButton onClick={() => router.push('/submit')}>Share Your Trip</PrimaryButton>}
            />
          ) : (
            <EmptyState 
              title="No matching trips yet."
              message="Try changing your search or filters."
              action={
                <div className="flex gap-4">
                  <button 
                    onClick={() => { setSearchQuery(''); clearFilters(); }}
                    className="px-4 py-2 text-sm font-bold border-2 border-border-dark hover:bg-soft-beige transition-colors uppercase tracking-wider"
                  >
                    Clear
                  </button>
                  <PrimaryButton onClick={() => router.push('/submit')}>Share Your Trip</PrimaryButton>
                </div>
              }
            />
          )}
        </div>
      )}
      {/* Filter Modal */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full md:max-w-lg border border-border-dark/15 md:shadow-md rounded-t-xl md:rounded-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between p-4 border-b border-border-dark/15 bg-soft-beige md:rounded-t-xl">
              <h2 className="text-xl font-display font-bold">Filter</h2>
              <button onClick={() => setIsFilterModalOpen(false)} className="p-1 hover:bg-surface border border-transparent hover:border-border-dark/15 rounded transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto p-6 flex flex-col gap-8 no-scrollbar">
              
              {/* Destination Type */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3">Destination Type</h3>
                <div className="flex flex-wrap gap-2">
                  {['Commute-Friendly', 'Beach', 'Nature', 'City'].map(type => {
                    const isSelected = tempFilters.destinationTypes.includes(type);
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          setTempFilters(prev => ({
                            ...prev,
                            destinationTypes: isSelected 
                              ? prev.destinationTypes.filter(t => t !== type)
                              : [...prev.destinationTypes, type]
                          }))
                        }}
                        className={`px-3 py-1.5 text-sm font-bold border transition-colors rounded ${
                          isSelected ? 'bg-accent-yellow border-border-dark/30' : 'bg-surface border-border-dark/15 hover:bg-soft-beige'
                        }`}
                      >
                        {type === 'Beach' ? 'Beach / Island Hopping' : type === 'City' ? 'City / Staycation' : type === 'Nature' ? 'Nature / Hiking' : type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Starting From (Origin) */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3">Starting From (Origin)</h3>
                <LocationAutocomplete 
                  label=""
                  placeholder="e.g. Quezon City, Cebu, Davao"
                  value={tempFilters.originQuery}
                  isOriginMode={true}
                  onChange={(val: string, region: string, structured: StructuredLocation | null) => {
                    setTempFilters(prev => ({
                      ...prev,
                      originQuery: val,
                      originStructured: structured
                    }));
                  }}
                />
              </div>

              {/* Budget Slider */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3 flex justify-between">
                  <span>Budget per head</span>
                  <span className="text-secondary">Up to ₱{tempFilters.maxBudget.toLocaleString()}</span>
                </h3>
                <input 
                  type="range" 
                  min="0" 
                  max="10000" 
                  step="100"
                  value={tempFilters.maxBudget}
                  onChange={(e) => setTempFilters({...tempFilters, maxBudget: Number(e.target.value)})}
                  className="w-full accent-border-dark h-2 bg-soft-beige border border-border-dark/15 rounded-full appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs font-bold text-secondary mt-1">
                  <span>₱0</span>
                  <span>₱10,000+</span>
                </div>
              </div>

              {/* Duration */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3">Duration</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { val: 'Any', label: 'Any' },
                    { val: 'Day Trip', label: 'Day Trip' },
                    { val: 'No Overnight', label: 'No Overnight' },
                    { val: 'Weekend Getaway (2-3 Days)', label: 'Weekend (2-3 Days)' },
                    { val: 'Extended Trip (4-7 Days)', label: 'Extended (4-7 Days)' },
                    { val: 'Long Vacation (8+ Days)', label: 'Long (8+ Days)' }
                  ].map(dur => (
                    <button
                      key={dur.val}
                      onClick={() => setTempFilters({...tempFilters, duration: dur.val})}
                      className={`px-3 py-1.5 text-sm font-bold border transition-colors rounded ${
                        tempFilters.duration === dur.val ? 'bg-accent-yellow border-border-dark/30' : 'bg-surface border-border-dark/15 hover:bg-soft-beige'
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transport Mode */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3">Transport Mode</h3>
                <div className="flex flex-wrap gap-2">
                  {['Roadtrip-Friendly', 'Flight Required', 'Requires Ferry'].map(mode => {
                    const isSelected = tempFilters.transportModes.includes(mode);
                    return (
                      <button
                        key={mode}
                        onClick={() => {
                          setTempFilters(prev => ({
                            ...prev,
                            transportModes: isSelected
                              ? prev.transportModes.filter(m => m !== mode)
                              : [...prev.transportModes, mode]
                          }))
                        }}
                        className={`px-3 py-1.5 text-sm font-bold border transition-colors rounded ${
                          isSelected ? 'bg-accent-yellow border-border-dark/30' : 'bg-surface border-border-dark/15 hover:bg-soft-beige'
                        }`}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vibes & Activities */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3">Travel Vibe / Activities</h3>
                <div className="flex flex-wrap gap-2">
                  {['Foodie', 'Adventure', 'Historical & Cultural', 'Relaxation & Wellness', 'Kid / Pet Friendly'].map(vibe => {
                    const isSelected = tempFilters.vibes.includes(vibe);
                    return (
                      <button
                        key={vibe}
                        onClick={() => {
                          setTempFilters(prev => ({
                            ...prev,
                            vibes: isSelected
                              ? prev.vibes.filter(v => v !== vibe)
                              : [...prev.vibes, vibe]
                          }))
                        }}
                        className={`px-3 py-1.5 text-sm font-bold border transition-colors rounded ${
                          isSelected ? 'bg-accent-yellow border-border-dark/30' : 'bg-surface border-border-dark/15 hover:bg-soft-beige'
                        }`}
                      >
                        {vibe}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group Type */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3">Group Type</h3>
                <div className="flex flex-wrap gap-2">
                  {['Any', 'Solo', 'Partner', 'Barkada', 'Family'].map(grp => (
                    <button
                      key={grp}
                      onClick={() => setTempFilters({...tempFilters, groupType: grp})}
                      className={`px-3 py-1.5 text-sm font-bold border transition-colors rounded ${
                        tempFilters.groupType === grp ? 'bg-accent-yellow border-border-dark/30' : 'bg-surface border-border-dark/15 hover:bg-soft-beige'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Travel Style */}
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide mb-3">Travel Style</h3>
                <div className="flex flex-wrap gap-2">
                  {['Any', 'Extreme Budget', 'Budget', 'Moderate', 'Splurge / Luxury'].map(style => (
                    <button
                      key={style}
                      onClick={() => setTempFilters({...tempFilters, travelStyle: style})}
                      className={`px-3 py-1.5 text-sm font-bold border transition-colors rounded ${
                        tempFilters.travelStyle === style ? 'bg-accent-yellow border-border-dark/30' : 'bg-surface border-border-dark/15 hover:bg-soft-beige'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-border-dark/15 flex gap-4 bg-soft-beige md:rounded-b-xl">
              <button 
                onClick={() => setTempFilters(defaultFilters)}
                className="flex-1 py-3 font-bold border border-border-dark/15 hover:bg-surface transition-colors rounded uppercase tracking-wide text-sm"
              >
                Reset
              </button>
              <PrimaryButton onClick={applyFilters} className="flex-1 rounded py-3 text-sm">
                Apply Filters
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Sort Modal */}
      {isSortModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200" onClick={() => setIsSortModalOpen(false)}>
          <div 
            className="bg-surface w-full md:max-w-sm border border-border-dark/15 md:shadow-md rounded-t-xl md:rounded-xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            
            <div className="flex items-center justify-between p-4 border-b border-border-dark/10 bg-soft-beige md:rounded-t-xl">
              <h2 className="text-xl font-display font-bold">Sort by</h2>
              <button onClick={() => setIsSortModalOpen(false)} className="p-1 hover:bg-surface border border-transparent hover:border-border-dark/15 rounded transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col p-2">
              {['Recently Added', 'Budget: Low to High', 'Budget: High to Low', 'Shortest Trip', 'Longest Trip', 'Most Saved'].map(option => (
                <button
                  key={option}
                  onClick={() => {
                    setSortBy(option);
                    setIsSortModalOpen(false);
                  }}
                  className={`flex items-center gap-3 p-4 font-bold text-left hover:bg-soft-beige rounded transition-colors ${
                    sortBy === option ? 'text-primary' : 'text-secondary'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border border-border-dark/30 flex items-center justify-center ${sortBy === option ? 'bg-accent-yellow' : 'bg-surface'}`}>
                    {sortBy === option && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>
                  {option}
                </button>
              ))}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
