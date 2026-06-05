import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { TripDetailView } from '@/components/trip/TripDetailView';
import { RelatedTrips } from '@/components/trip/RelatedTrips';
import { RetroPanel } from '@/components/ui/Cards';
import { EmptyState } from '@/components/ui/States';
import Link from 'next/link';
import { PrimaryButton } from '@/components/ui/Button';
import { TripPhoto, Trip } from '@/types/supabase';

export default async function TripDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || null;

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('*, trip_stops(*), users!trips_user_id_fkey(display_name, avatar_url)')
    .eq('id', params.id)
    .single();

  if (tripError || !trip) {
    return (
      <div className="w-full flex justify-center mt-12">
        <RetroPanel className="w-full max-w-lg p-0">
          <EmptyState 
            title="Trip not found."
            message="This trip may have been removed or is not available."
            action={<Link href="/"><PrimaryButton>Back to Feed</PrimaryButton></Link>}
          />
        </RetroPanel>
      </div>
    );
  }

  const userEmail = session?.user?.email || null;
  const adminEmailsStr = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
  const isAdmin = userEmail ? adminEmails.includes(userEmail.toLowerCase()) : false;

  // Security check: Unapproved or private trips only visible to owner/admin
  if ((!trip.is_approved || !trip.is_public) && trip.user_id !== userId && !isAdmin) {
    return (
      <div className="w-full flex justify-center mt-12">
        <RetroPanel className="w-full max-w-lg p-0">
          <EmptyState 
            title="This trip is not available yet."
            message="It may still be pending review or is kept private by the author."
            action={<Link href="/"><PrimaryButton>Back to Feed</PrimaryButton></Link>}
          />
        </RetroPanel>
      </div>
    );
  }

  // Fetch photos
  const { data: photos } = await supabase
    .from('trip_photos')
    .select('*')
    .eq('trip_id', trip.id);

  // Fetch days
  const { data: days } = await supabase
    .from('trip_days')
    .select('*')
    .eq('trip_id', trip.id);

  // Fetch business (Featured Local Spot)
  const currentDate = new Date().toISOString();
  const { data: businessData } = await supabase
    .from('businesses')
    .select('*')
    .eq('destination', trip.destination)
    .eq('is_featured', true)
    .limit(1);
    
  let business = null;
  if (businessData && businessData.length > 0) {
    const b = businessData[0];
    if (b.feature_start && b.feature_end) {
      if (currentDate >= b.feature_start && currentDate <= b.feature_end) business = b;
    } else {
      business = b;
    }
  }

  // Fetch User profile logic
  let hasContributed = false;
  let accessExpiresAt = null;
  let initialSaved = false;

  if (userId) {
    const { data: profile } = await supabase
      .from('users')
      .select('has_contributed, access_expires_at')
      .eq('id', userId)
      .single();

    if (profile) {
      hasContributed = profile.has_contributed;
      accessExpiresAt = profile.access_expires_at;
    }

    const { data: savedTrip } = await supabase
      .from('saved_trips')
      .select('id')
      .match({ user_id: userId, trip_id: trip.id })
      .single();

    if (savedTrip) {
      initialSaved = true;
    }
  }

  // Fetch Related Trips using scoring
  const { data: potentialTrips } = await supabase
    .from('trips')
    .select('*, users!trips_user_id_fkey(display_name, avatar_url)')
    .eq('is_approved', true)
    .neq('id', trip.id)
    .order('created_at', { ascending: false })
    .limit(50);

  let relatedTrips: Trip[] = [];
  if (potentialTrips) {
    const { getRelatedTripScore } = await import('@/lib/locations');
    relatedTrips = [...potentialTrips]
      .sort((a, b) => getRelatedTripScore(trip, b) - getRelatedTripScore(trip, a))
      .slice(0, 4);
  }

  let relatedPhotos: TripPhoto[] = [];
  if (relatedTrips.length > 0) {
    const relatedIds = relatedTrips.map(t => t.id);
    const { data: rPhotos } = await supabase
      .from('trip_photos')
      .select('*')
      .eq('is_hero', true)
      .in('trip_id', relatedIds);
    relatedPhotos = rPhotos || [];
  }
  // Fetch active hostings for this trip (status = 'open' or 'full')
  const { data: hostingsData } = await supabase
    .from('trip_hosting')
    .select('*, users!trip_hosting_host_user_id_fkey(display_name, avatar_url, is_verified_organizer, vouch_count)')
    .eq('trip_id', trip.id)
    .in('status', ['open', 'full']);

  const hostingIds = hostingsData ? hostingsData.map(h => h.id) : [];
  const { data: membersData } = hostingIds.length > 0 ? await supabase
    .from('trip_hosting_members')
    .select('hosting_id, status')
    .in('hosting_id', hostingIds) : { data: [] };

  let joinedHostingIds: string[] = [];
  if (userId) {
    const { data: memberships } = await supabase
      .from('trip_hosting_members')
      .select('hosting_id')
      .eq('user_id', userId);
    if (memberships) {
      joinedHostingIds = memberships.map(m => m.hosting_id);
    }
  }

  // Map members to hostings and Sort: Boosted hostings (boost_status = approved) first, then recently created
  const hostings = hostingsData ? [...hostingsData].map(h => ({
    ...h,
    trip_hosting_members: (membersData || []).filter(m => m.hosting_id === h.id)
  })).sort((a, b) => {
    const aBoosted = a.is_boosted && a.boost_status === 'approved';
    const bBoosted = b.is_boosted && b.boost_status === 'approved';
    if (aBoosted && !bBoosted) return -1;
    if (!aBoosted && bBoosted) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }) : [];

  return (
    <div className="w-full pb-12">
      <TripDetailView 
        trip={trip}
        photos={photos || []}
        days={days || []}
        business={business}
        userId={userId}
        initialHasContributed={hasContributed}
        initialAccessExpiresAt={accessExpiresAt}
        initialSaved={initialSaved}
        isAdmin={isAdmin}
        hostings={hostings}
        joinedHostingIds={joinedHostingIds}
      />
      <RelatedTrips trips={relatedTrips} photos={relatedPhotos} userId={userId} />
    </div>
  );
}
