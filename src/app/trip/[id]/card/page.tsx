import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { RetroPanel } from '@/components/ui/Cards';
import { EmptyState } from '@/components/ui/States';
import Link from 'next/link';
import { PrimaryButton } from '@/components/ui/Button';
import TripCardGenerator from '@/components/trip/card/TripCardGenerator';
import { TripWithPhotos } from '@/app/profile/page';

export default async function TripCardPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id || null;
  const userEmail = session?.user?.email || null;

  // Check if admin
  const adminEmailsStr = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
  const isAdmin = userEmail && adminEmails.includes(userEmail.toLowerCase());

  const { data: tripData, error: tripError } = await supabase
    .from('trips')
    .select('*, trip_photos(*)')
    .eq('id', params.id)
    .single();

  if (tripError || !tripData) {
    return (
      <div className="w-full flex justify-center mt-12 px-4">
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

  // Security check: Unapproved trips only visible to owner or admin
  if (!tripData.is_approved && tripData.user_id !== userId && !isAdmin) {
    return (
      <div className="w-full flex justify-center mt-12 px-4">
        <RetroPanel className="w-full max-w-lg p-0">
          <EmptyState 
            title="This trip card is not available yet."
            message="The trip may still be pending review."
            action={<Link href={`/trip/${tripData.id}`}><PrimaryButton>Back to Trip</PrimaryButton></Link>}
          />
        </RetroPanel>
      </div>
    );
  }

  // Access logic for cost breakdown
  let hasDetailedAccess = false;

  if (isAdmin || tripData.user_id === userId) {
    hasDetailedAccess = true;
  } else if (userId) {
    const { data: profile } = await supabase
      .from('users')
      .select('has_contributed, access_expires_at')
      .eq('id', userId)
      .single();

    if (profile) {
      const now = new Date();
      if (profile.has_contributed || (profile.access_expires_at && new Date(profile.access_expires_at) > now)) {
        hasDetailedAccess = true;
      }
    }
  }

  return (
    <div className="w-full max-w-[1200px] mx-auto pt-8 pb-16 px-4">
      <Link href={`/trip/${tripData.id}`} className="inline-flex items-center gap-2 font-bold uppercase tracking-wide text-secondary hover:text-primary mb-6">
        <span>←</span> Back to Trip
      </Link>
      
      <div className="mb-8">
        <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Trip Card Generator</h1>
        <p className="text-secondary font-medium text-lg">Create a shareable card for this real trip.</p>
      </div>

      <TripCardGenerator trip={tripData as unknown as TripWithPhotos} hasDetailedAccess={hasDetailedAccess} />
    </div>
  );
}
