'use client';

import React, { useState } from 'react';
import { SavedTripWithDetails } from '@/app/saved/page';
import { RetroPanel, SectionHeader } from '@/components/ui/Cards';
import SavedTripCard from './SavedTripCard';
import { PrimaryButton } from '@/components/ui/Button';
import Link from 'next/link';

type SavedTripsContainerProps = {
  initialSavedTrips: SavedTripWithDetails[];
  currentUserId: string;
};

export default function SavedTripsContainer({ initialSavedTrips, currentUserId }: SavedTripsContainerProps) {
  const [savedTrips, setSavedTrips] = useState<SavedTripWithDetails[]>(initialSavedTrips);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');

  const handleUnsave = (tripId: string) => {
    setSavedTrips(prev => prev.filter(st => st.trip_id !== tripId));
  };

  const filteredTrips = savedTrips.filter(st => {
    const trip = st.trips;
    if (!trip) return false;
    
    // Type Filter
    if (selectedType !== 'All' && trip.trip_type !== selectedType) return false;
    
    // Search Query Filter (match destination, region, or travel style)
    const matchesSearch = 
      trip.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (trip.destination_region && trip.destination_region.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (trip.travel_style && trip.travel_style.toLowerCase().includes(searchQuery.toLowerCase()));
      
    return matchesSearch;
  });

  const tripTypes = ['All', ...Array.from(new Set(savedTrips.map(st => st.trips?.trip_type).filter((t): t is string => !!t)))];

  if (savedTrips.length === 0) {
    return (
      <RetroPanel className="w-full text-center py-16">
        <h2 className="text-3xl font-black uppercase tracking-tight mb-4">No saved trips yet.</h2>
        <p className="text-secondary font-medium mb-8">Save trips you want to revisit later.</p>
        <Link href="/">
          <PrimaryButton className="px-8 py-3 text-lg">Browse Trips</PrimaryButton>
        </Link>
      </RetroPanel>
    );
  }

  return (
    <RetroPanel label="Saved" className="w-full">
      <SectionHeader title="Your Saved Trips" />
      
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mt-4 mb-2">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search saved trips (e.g. Baguio, Foodie, Beach)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 px-3 border-2 border-border-dark font-bold text-sm bg-white placeholder-secondary/50 focus:outline-none focus:bg-soft-beige transition-colors"
          />
        </div>
        {tripTypes.length > 2 && (
          <div className="flex flex-wrap gap-1.5 items-center">
            {tripTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`py-1.5 px-3 border-2 border-border-dark text-xs font-black uppercase tracking-wider transition-all shadow-hard-xs hover:translate-y-[1px] hover:shadow-none ${
                  selectedType === type ? 'bg-accent-yellow text-primary' : 'bg-white text-secondary'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        )}
      </div>

      {filteredTrips.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border-dark bg-white/30 font-bold text-secondary text-sm mt-4">
          No saved trips match your search criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {filteredTrips.map(st => (
            <SavedTripCard 
              key={st.id} 
              savedTrip={st} 
              currentUserId={currentUserId} 
              onUnsave={() => handleUnsave(st.trip_id)} 
            />
          ))}
        </div>
      )}
    </RetroPanel>
  );
}
