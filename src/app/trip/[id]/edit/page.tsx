import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import ShareTripForm from '@/components/submit/ShareTripForm';
import { TripWithPhotos } from '@/app/profile/page';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function EditTripPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=/trip/${params.id}/edit`);
  }

  // Fetch the trip
  const { data: trip } = await supabase
    .from('trips')
    .select('*, trip_photos(*), trip_stops(*), trip_days(*)')
    .eq('id', params.id)
    .single();

  if (!trip) {
    return (
      <div className="w-full flex justify-center py-20 px-4">
        <div className="font-bold border-4 border-border-dark bg-surface p-8 shadow-hard text-center flex flex-col gap-4 max-w-lg">
          <h2 className="text-2xl font-black uppercase tracking-tight">Trip Not Found</h2>
          <p className="text-secondary font-medium">The trip you are trying to edit does not exist.</p>
        </div>
      </div>
    );
  }

  // Check admin
  const adminEmailsStr = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
  const isAdmin = user.email ? adminEmails.includes(user.email.toLowerCase()) : false;

  if (trip.user_id !== user.id && !isAdmin) {
    return (
      <div className="w-full flex justify-center py-20 px-4">
        <div className="font-bold border-4 border-border-dark bg-surface p-8 shadow-hard text-center flex flex-col gap-4 max-w-lg">
          <h2 className="text-2xl font-black uppercase tracking-tight">Access Denied</h2>
          <p className="text-secondary font-medium">You can&apos;t edit this trip.</p>
          <Link href={`/trip/${params.id}`} className="text-accent-blue underline uppercase text-sm tracking-wide">
            Back to Trip
          </Link>
        </div>
      </div>
    );
  }

  // Fetch user profile
  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single();

  return (
    <div className="w-full flex justify-center pt-6 pb-16 px-4">
      <div className="w-full max-w-[800px]">
        <ShareTripForm 
          returnTo={`/trip/${params.id}`} 
          userProfile={profile} 
          mode="edit" 
          initialData={trip as unknown as TripWithPhotos} 
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}
