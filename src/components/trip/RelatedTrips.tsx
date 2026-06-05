import React from 'react';
import { Trip, TripPhoto } from '@/types/supabase';
import { TripCard } from '@/components/feed/TripCard';

export function RelatedTrips({ trips, photos, userId }: { trips: Trip[]; photos: TripPhoto[]; userId?: string | null }) {
  if (!trips || trips.length === 0) return null;

  return (
    <div className="w-full mt-12 border-t-2 border-border-dark pt-8">
      <h2 className="text-xl md:text-2xl font-display font-bold text-primary mb-6">
        More trips like this
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6 w-full">
        {trips.map((trip) => {
          const heroPhoto = photos.find((p) => p.trip_id === trip.id);
          return <TripCard key={trip.id} trip={trip} heroPhoto={heroPhoto} userId={userId} />;
        })}
      </div>
    </div>
  );
}
