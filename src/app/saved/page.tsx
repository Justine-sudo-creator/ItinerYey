import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import SavedTripsContainer from '@/components/saved/SavedTripsContainer';
import React from 'react';
import { Trip, TripPhoto, SavedTrip } from '@/types/supabase';

export const dynamic = 'force-dynamic';

export type SavedTripWithDetails = SavedTrip & {
  trips: Trip & {
    trip_photos: TripPhoto[];
  };
};

export default async function SavedTripsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?returnTo=/saved');
  }

  // Fetch saved trips for the current user, joined with the actual trip and photos
  const { data: savedTrips } = await supabase
    .from('saved_trips')
    .select(`
      *,
      trips (
        *,
        trip_photos (*)
      )
    `)
    .eq('user_id', user.id)
    .order('saved_at', { ascending: false });

  // Filter out unapproved trips UNLESS the current user is the owner of that unapproved trip.
  const filteredSavedTrips = (savedTrips as unknown as SavedTripWithDetails[] || []).filter(st => {
    if (!st.trips) return false;
    if (st.trips.is_approved) return true;
    if (st.trips.user_id === user.id) return true;
    return false;
  });

  return (
    <div className="w-full flex justify-center pb-16 pt-6 px-4">
      <div className="w-full max-w-4xl">
        <SavedTripsContainer initialSavedTrips={filteredSavedTrips} currentUserId={user.id} />
      </div>
    </div>
  );
}
