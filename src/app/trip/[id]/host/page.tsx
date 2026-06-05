import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import HostTripForm from '@/components/trip/HostTripForm';

export default async function HostTripPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=/trip/${params.id}/host`);
  }

  // Check if trip exists and is public/approved
  const { data: trip } = await supabase
    .from('trips')
    .select('id, is_public, is_approved')
    .eq('id', params.id)
    .single();

  if (!trip || !trip.is_public || !trip.is_approved) {
    redirect(`/trip/${params.id}`);
  }

  // Fetch user profile info
  const { data: profile } = await supabase
    .from('users')
    .select('is_verified_organizer, hosting_credits')
    .eq('id', user.id)
    .single();

  const isVerified = profile?.is_verified_organizer || false;
  const hostingCredits = profile?.hosting_credits || 0;

  // Query previous boosted meetups count to check if this is the first boost
  const { count: previousBoostsCount } = await supabase
    .from('trip_hosting')
    .select('*', { count: 'exact', head: true })
    .eq('host_user_id', user.id)
    .eq('is_boosted', true);

  const boostCount = previousBoostsCount || 0;

  return (
    <div className="w-full py-12 px-4">
      <HostTripForm 
        tripId={params.id} 
        userId={user.id} 
        isVerified={isVerified}
        hostingCredits={hostingCredits}
        previousBoostsCount={boostCount}
      />
    </div>
  );
}
