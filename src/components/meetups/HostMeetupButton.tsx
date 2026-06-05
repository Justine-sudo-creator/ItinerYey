'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, Search, Heart, User, Compass, AlertCircle } from 'lucide-react';

interface TripItem {
  id: string;
  trip_name?: string | null;
  destination: string;
  cost_per_person: number;
  duration_days: number;
  trip_type?: string | null;
}

interface HostMeetupButtonProps {
  isLoggedIn: boolean;
  myTrips: TripItem[];
  savedTrips: TripItem[];
  allTrips: TripItem[];
}

type TabType = 'saved' | 'mine' | 'all';

export function HostMeetupButton({ isLoggedIn, myTrips, savedTrips, allTrips }: HostMeetupButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleOpen = () => {
    setIsOpen(true);
    setSearchQuery('');
    setActiveTab('saved');
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Determine which list to show based on active tab
  const activeList = useMemo(() => {
    switch (activeTab) {
      case 'saved':
        return savedTrips;
      case 'mine':
        return myTrips;
      case 'all':
        return allTrips;
      default:
        return [];
    }
  }, [activeTab, savedTrips, myTrips, allTrips]);

  // Filter list by search query
  const filteredTrips = useMemo(() => {
    if (!searchQuery.trim()) return activeList;
    const q = searchQuery.toLowerCase();
    return activeList.filter(t => 
      t.destination.toLowerCase().includes(q) || 
      (t.trip_name || '').toLowerCase().includes(q)
    );
  }, [activeList, searchQuery]);

  return (
    <>
      {/* Primary Neubrutalist Button */}
      <button
        onClick={handleOpen}
        className="px-4 py-2 bg-accent-coral text-primary border-2 border-border-dark font-black uppercase text-xs sm:text-sm tracking-wider shadow-hard active:translate-y-0.5 active:shadow-none hover:bg-accent-coral/90 select-none shrink-0"
      >
        Host a Meetup
      </button>

      {/* Modal Dialog Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 animate-in fade-in duration-150">
          {/* Modal Box */}
          <div 
            className="bg-surface w-full md:max-w-2xl border-4 border-border-dark shadow-hard flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 relative overflow-hidden bg-[url('/noise.png')]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-4 border-border-dark bg-soft-beige">
              <h2 className="text-lg md:text-xl font-display font-black uppercase tracking-tight">
                Host a Meetup
              </h2>
              <button 
                onClick={handleClose} 
                className="p-1 hover:bg-surface border-2 border-transparent hover:border-border-dark rounded-sm transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6 no-scrollbar">
              
              {!isLoggedIn ? (
                /* 1. NOT LOGGED IN STATE */
                <div className="flex flex-col items-center justify-center text-center py-8 gap-4">
                  <div className="w-12 h-12 bg-accent-yellow border-2 border-border-dark rounded-full flex items-center justify-center font-bold text-lg shadow-[2px_2px_0px_#000]">
                    🔑
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-primary uppercase">Log in required</h3>
                    <p className="text-xs text-secondary max-w-sm mt-1 leading-normal font-bold">
                      Please log in first to organize and host group meetups with other travelers.
                    </p>
                  </div>
                  <Link
                    href={`/login?returnTo=/meetups`}
                    className="border-2 border-border-dark px-6 py-2 bg-accent-yellow text-primary font-black uppercase text-xs tracking-wider shadow-hard active:translate-y-0.5 active:shadow-none hover:bg-accent-yellow/90 mt-2"
                  >
                    Go to Login
                  </Link>
                </div>
              ) : myTrips.length === 0 ? (
                /* 2. CONTRIBUTION LOCK STATE (0 submissions) */
                <div className="flex flex-col items-center justify-center text-center py-6 gap-4">
                  <div className="w-12 h-12 bg-accent-coral border-2 border-border-dark rounded-full flex items-center justify-center font-bold text-lg shadow-[2px_2px_0px_#000]">
                    ⚠️
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-primary uppercase">Share a Trip First</h3>
                    <p className="text-xs text-secondary max-w-md mt-1.5 leading-relaxed font-bold">
                      Before hosting a group meetup, organizers must share at least one approved trip itinerary on the platform. This helps verify your active contributions to the board.
                    </p>
                    <p className="text-[10px] text-secondary/80 max-w-xs mx-auto mt-2 italic font-bold">
                      Once you share your first trip, you can host meetups using your own trips, saved trips, or any other traveler's trip guide!
                    </p>
                  </div>
                  <Link
                    href="/submit"
                    className="border-2 border-border-dark px-6 py-2.5 bg-accent-coral text-white font-black uppercase text-xs tracking-wider shadow-hard active:translate-y-0.5 active:shadow-none hover:bg-accent-coral/90 mt-2"
                  >
                    Share Your First Trip
                  </Link>
                </div>
              ) : (
                /* 3. FULL TABBED SELECTOR */
                <div className="flex flex-col gap-4 flex-grow h-full min-h-[300px]">
                  
                  {/* Tab Navigation */}
                  <div className="grid grid-cols-3 border-2 border-border-dark bg-white font-black text-[10px] sm:text-xs uppercase tracking-wider rounded-sm overflow-hidden shrink-0">
                    <button
                      onClick={() => { setActiveTab('saved'); setSearchQuery(''); }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 border-r-2 border-border-dark hover:bg-soft-beige transition-colors ${
                        activeTab === 'saved' ? 'bg-accent-yellow' : 'bg-white'
                      }`}
                    >
                      <Heart size={14} className="shrink-0" />
                      <span>Saved ({savedTrips.length})</span>
                    </button>
                    <button
                      onClick={() => { setActiveTab('mine'); setSearchQuery(''); }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 border-r-2 border-border-dark hover:bg-soft-beige transition-colors ${
                        activeTab === 'mine' ? 'bg-accent-yellow' : 'bg-white'
                      }`}
                    >
                      <User size={14} className="shrink-0" />
                      <span>My Trips ({myTrips.length})</span>
                    </button>
                    <button
                      onClick={() => { setActiveTab('all'); setSearchQuery(''); }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 hover:bg-soft-beige transition-colors ${
                        activeTab === 'all' ? 'bg-accent-yellow' : 'bg-white'
                      }`}
                    >
                      <Compass size={14} className="shrink-0" />
                      <span>Search All</span>
                    </button>
                  </div>

                  {/* Search bar inside Modal */}
                  <div className="relative shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-secondary" />
                    </div>
                    <input
                      type="text"
                      placeholder={`Search in ${activeTab === 'saved' ? 'Saved Trips' : activeTab === 'mine' ? 'My Trips' : 'All Trips'}...`}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border-2 border-border-dark rounded-sm focus:outline-none placeholder:text-secondary/60 text-xs sm:text-sm bg-soft-beige"
                    />
                  </div>

                  {/* Scrollable list */}
                  <div className="flex-grow overflow-y-auto border-2 border-border-dark rounded-sm max-h-[350px] bg-white divide-y-2 divide-border-dark custom-scrollbar">
                    {filteredTrips.length === 0 ? (
                      <div className="p-8 text-center text-secondary font-bold text-xs italic">
                        {searchQuery ? 'No matching trips found.' : activeTab === 'saved' ? 'You haven\'t saved any trips yet.' : activeTab === 'mine' ? 'You haven\'t shared any trips yet.' : 'No public trips found.'}
                      </div>
                    ) : (
                      filteredTrips.map(trip => (
                        <div 
                          key={trip.id}
                          className="p-3 sm:p-4 flex items-center justify-between gap-4 hover:bg-soft-beige transition-colors"
                        >
                          <div className="min-w-0 flex-1 flex flex-col gap-1">
                            <h4 className="font-display font-black text-xs sm:text-sm text-primary leading-tight line-clamp-1">
                              {trip.trip_name || trip.destination}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold text-secondary">
                              <span>📍 {trip.destination}</span>
                              <span>·</span>
                              <span>₱{trip.cost_per_person.toLocaleString()}/head</span>
                              <span>·</span>
                              <span>{trip.duration_days} day{trip.duration_days > 1 ? 's' : ''}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              handleClose();
                              router.push(`/trip/${trip.id}/host`);
                            }}
                            className="px-3 py-1.5 bg-accent-yellow border-2 border-border-dark font-black uppercase text-[10px] tracking-wider shadow-[2px_2px_0px_#000] active:translate-y-0.5 active:shadow-none shrink-0"
                          >
                            Host Meetup
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
