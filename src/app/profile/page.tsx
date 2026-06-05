import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import ProfileContainer from '@/components/profile/ProfileContainer';
import React from 'react';
import { Trip, TripPhoto, TripStop, User } from '@/types/supabase';

export const dynamic = 'force-dynamic';

export type TripWithPhotos = Trip & {
  trip_photos: TripPhoto[];
  trip_stops?: TripStop[];
};

export default async function ProfilePage({ searchParams }: { searchParams?: { id?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?returnTo=/profile');
  }

  const targetUserId = searchParams?.id || user.id;
  const isOwnProfile = targetUserId === user.id;

  // Fetch user profile
  let { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', targetUserId)
    .single();

  if (!profile) {
    if (isOwnProfile) {
      // Fallback: if public.users row is missing (e.g. signup trigger failed or old user), create it for logged in user
      const { data: newProfile, error } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email || '',
          has_contributed: false,
        })
        .select('*')
        .single();

      if (error || !newProfile) {
        return (
          <div className="w-full flex justify-center py-20">
            <div className="font-bold border-4 border-accent-coral bg-surface p-8 shadow-hard text-center flex flex-col gap-4 max-w-xl">
              <h3 className="text-xl">Database Permission Error</h3>
              <p className="text-sm font-medium">
                We couldn&apos;t create your profile row in the database. This usually means your Supabase <strong>users</strong> table is missing an INSERT policy.
              </p>
              <div className="bg-gray-100 p-2 text-xs font-mono text-left overflow-auto border-2 border-border-dark">
                {error?.message || 'Unknown Error'}
              </div>
            </div>
          </div>
        );
      }
      profile = newProfile;
    } else {
      // If we are looking up someone else and they don't exist
      return (
        <div className="w-full flex justify-center py-20">
          <div className="font-bold border-4 border-accent-coral bg-surface p-8 shadow-hard text-center max-w-xl">
            <h3 className="text-xl">Traveler Not Found</h3>
            <p className="text-sm font-medium mt-2">The requested traveler profile does not exist or has been removed.</p>
          </div>
        </div>
      );
    }
  }

  // Fetch trips belonging to the target user
  let tripsQuery = supabase
    .from('trips')
    .select('*, trip_photos(*), trip_stops(*), trip_days(*)');
  
  if (isOwnProfile) {
    tripsQuery = tripsQuery.eq('user_id', targetUserId);
  } else {
    // Only fetch public and approved trips for other users
    tripsQuery = tripsQuery
      .eq('user_id', targetUserId)
      .eq('is_public', true)
      .eq('is_approved', true);
  }

  const { data: trips } = await tripsQuery.order('created_at', { ascending: false });

  // Fetch custom achievements/badges
  const typedSupabase = supabase as unknown as {
    from: (table: string) => {
      select: (fields: string) => {
        eq: (field: string, val: string) => Promise<{ data: { id: string; badge_name: string; user_id: string; }[] | null }>;
      };
    };
  };

  const { data: badges } = await typedSupabase
    .from('user_badges')
    .select('*')
    .eq('user_id', targetUserId);

  let hostedMeetups: any[] = [];
  let joinedMeetups: any[] = [];

  if (isOwnProfile) {
    // Fetch hosted meetups
    const { data: hosted } = await supabase
      .from('trip_hosting')
      .select('*, trips!inner(destination)')
      .eq('host_user_id', targetUserId)
      .order('created_at', { ascending: false });
    
    hostedMeetups = hosted || [];

    // Fetch joined meetups
    const { data: joined } = await supabase
      .from('trip_hosting_members')
      .select('*, trip_hosting!inner(id, trip_id, target_date, host_user_id, status, host_note, trips!inner(destination), users!trip_hosting_host_user_id_fkey(display_name))')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    joinedMeetups = joined || [];
  }

  // Fetch saved trips for profile container (always fetch for the logged in user)
  let savedTrips: any[] = [];
  const { data: saved } = await supabase
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
    
  // Filter out unapproved trips unless the user owns them
  savedTrips = (saved || []).filter((st: any) => {
    if (!st.trips) return false;
    if (st.trips.is_approved) return true;
    if (st.trips.user_id === user.id) return true;
    return false;
  });

  return (
    <div className="w-full flex justify-center pb-16 pt-6 px-4">
      <div className="w-full max-w-5xl">
        <ProfileContainer 
          userProfile={profile as User} 
          userTrips={(trips || []) as unknown as TripWithPhotos[]} 
          userBadges={badges || []}
          isOwnProfile={isOwnProfile}
          hostedMeetups={hostedMeetups}
          joinedMeetups={joinedMeetups}
          savedTrips={savedTrips}
        />
      </div>
    </div>
  );
}
