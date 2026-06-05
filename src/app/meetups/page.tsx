import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { MeetupsListContainer } from '@/components/meetups/MeetupsListContainer';

export const dynamic = 'force-dynamic';

export default async function MeetupsPage({ searchParams }: { searchParams?: { success?: string; boost?: string; tab?: string } }) {
  const supabase = createClient();
  const successParam = searchParams?.success === 'true';
  const boostParam = searchParams?.boost || '';

  // Get active session
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Fetch hostings and user details in parallel to avoid waterfalls
  const hostingsPromise = supabase
    .from('trip_hosting')
    .select('*, users!trip_hosting_host_user_id_fkey(display_name, avatar_url, is_verified_organizer)')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  const hostedPromise = user 
    ? supabase
        .from('trip_hosting')
        .select('*, users!trip_hosting_host_user_id_fkey(display_name, avatar_url, is_verified_organizer)')
        .eq('host_user_id', user.id)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: null, error: null });

  const joinedPromise = user
    ? supabase
        .from('trip_hosting_members')
        .select('*, trip_hosting!inner(*, users!trip_hosting_host_user_id_fkey(display_name, avatar_url, is_verified_organizer))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    : Promise.resolve({ data: null, error: null });

  const mineTripsPromise = user
    ? supabase
        .from('trips')
        .select('id, trip_name, destination, cost_per_person, duration_days, trip_type')
        .eq('user_id', user.id)
        .eq('is_approved', true)
        .eq('is_public', true)
    : Promise.resolve({ data: null, error: null });

  const savedTripsPromise = user
    ? supabase
        .from('saved_trips')
        .select('trip_id, trips(id, trip_name, destination, cost_per_person, duration_days, trip_type)')
        .eq('user_id', user.id)
    : Promise.resolve({ data: null, error: null });

  const allTripsPromise = supabase
    .from('trips')
    .select('id, trip_name, destination, cost_per_person, duration_days, trip_type')
    .eq('is_approved', true)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(50);

  const [
    hostingsResult,
    hostedResult,
    joinedResult,
    mineTripsResult,
    savedTripsResult,
    allTripsResult
  ] = await Promise.all([
    hostingsPromise,
    hostedPromise,
    joinedPromise,
    mineTripsPromise,
    savedTripsPromise,
    allTripsPromise
  ]);

  const hostings = hostingsResult.data || [];
  const hostingError = hostingsResult.error;
  const userHostedMeetups = hostedResult.data || [];
  const userJoinedMeetups = joinedResult.data || [];
  let myTrips = mineTripsResult.data || [];
  let savedTrips = [];
  if (savedTripsResult.data) {
    savedTrips = savedTripsResult.data.map((s: any) => s.trips).filter(Boolean);
  }
  const allTrips = allTripsResult.data || [];

  if (hostingError) {
    console.error('Failed to load meetups', hostingError);
  }

  const openHostings = hostings.filter(h => {
    const isHostVerified = h.users?.is_verified_organizer || false;
    return isHostVerified || h.listing_status === 'free' || h.listing_status === 'approved';
  });

  // Calculate the union list of trip IDs to fetch details for
  const allDisplayHostings = [...openHostings, ...userHostedMeetups];
  userJoinedMeetups.forEach((j: any) => {
    if (j.trip_hosting && !allDisplayHostings.some(h => h.id === j.trip_hosting.id)) {
      allDisplayHostings.push(j.trip_hosting);
    }
  });

  const tripIds = Array.from(new Set(allDisplayHostings.map(h => h.trip_id)));
  let trips: any[] = [];
  let photos: any[] = [];
  const membersCountMap: Record<string, number> = {};

  if (tripIds.length > 0) {
    const hostingIds = allDisplayHostings.map(h => h.id);

    const tripsPromise = supabase
      .from('trips')
      .select('*, users!trips_user_id_fkey(display_name, avatar_url)')
      .in('id', tripIds);

    const photosPromise = supabase
      .from('trip_photos')
      .select('*')
      .eq('is_hero', true)
      .in('trip_id', tripIds);

    const membersPromise = supabase
      .from('trip_hosting_members')
      .select('hosting_id')
      .in('hosting_id', hostingIds)
      .eq('status', 'approved');

    const [tripsResult, photosResult, membersResult] = await Promise.all([
      tripsPromise,
      photosPromise,
      membersPromise
    ]);

    trips = tripsResult.data || [];
    photos = photosResult.data || [];
    if (membersResult.data) {
      membersResult.data.forEach(m => {
        membersCountMap[m.hosting_id] = (membersCountMap[m.hosting_id] || 0) + 1;
      });
    }
  }

  return (
    <MeetupsListContainer
      user={user}
      openHostings={openHostings}
      userHostedMeetups={userHostedMeetups}
      userJoinedMeetups={userJoinedMeetups}
      trips={trips}
      photos={photos}
      membersCountMap={membersCountMap}
      myTrips={myTrips}
      savedTrips={savedTrips}
      allTrips={allTrips}
      successParam={successParam}
      boostParam={boostParam}
    />
  );
}
