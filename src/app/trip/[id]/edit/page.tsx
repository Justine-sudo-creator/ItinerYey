import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import ShareTripForm from '@/components/submit/ShareTripForm';
import React from 'react';

export const dynamic = 'force-dynamic';

type Props = {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function EditTripPage({ params, searchParams }: Props) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Authentication Check
  if (!user) {
    console.log('--- EDIT PAGE DEBUG: No user session found, redirecting to login ---');
    redirect(`/login?returnTo=${encodeURIComponent(`/trip/${params.id}/edit`)}`);
  }

  // 2. Fetch Trip
  const { data: trip } = await supabase
    .from('trips')
    .select('*, trip_photos(*), trip_stops(*), trip_days(*)')
    .eq('id', params.id)
    .single();

  if (!trip) {
    console.log('--- EDIT PAGE DEBUG: Trip not found, redirecting to feed ---');
    redirect('/');
  }

  // 3. Admin / Ownership checks
  const adminEmailsStr = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
  const isAdmin = user.email ? adminEmails.includes(user.email.toLowerCase()) : false;
  const isOwner = trip.user_id === user.id;

  console.log('--- EDIT PAGE DEBUG ---', {
    tripId: trip.id,
    userId: user.id,
    tripOwnerId: trip.user_id,
    isOwner,
    isAdmin,
    successParam: searchParams.success,
  });

  // Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const isSuccess = searchParams.success === 'true';

  return (
    <div className="w-full flex justify-center pb-16 pt-6 px-4">
      <div className="w-full max-w-4xl">
        <ShareTripForm
          returnTo={`/trip/${trip.id}`}
          userProfile={profile}
          mode="edit"
          initialData={trip as any}
          isAdmin={isAdmin}
          externalSuccess={isSuccess}
        />
      </div>
    </div>
  );
}