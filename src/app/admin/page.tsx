import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import React from 'react';
import AdminBoard from '@/components/admin/AdminBoard';
import { TripWithPhotos } from '@/app/profile/page';
import Link from 'next/link';
import { PrimaryButton } from '@/components/ui/Button';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect('/login?returnTo=/admin');
  }

  const adminEmailsStr = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());

  if (!adminEmails.includes(user.email.toLowerCase())) {
    return (
      <div className="w-full flex justify-center py-20 px-4">
        <div className="font-bold border-4 border-border-dark bg-surface p-8 shadow-hard text-center flex flex-col gap-4 max-w-lg">
          <h2 className="text-2xl font-black uppercase tracking-tight">Admin access only.</h2>
          <p className="text-secondary font-medium">You do not have permission to review submissions.</p>
          <Link href="/">
            <PrimaryButton className="mt-4">Back to Feed</PrimaryButton>
          </Link>
        </div>
      </div>
    );
  }

  // Fetch only public trips for review
  const { data: trips } = await supabase
    .from('trips')
    .select('*, trip_photos(*), trip_stops(*), trip_days(*)')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  return (
    <div className="w-full flex justify-center pb-16 pt-6 px-4">
      <div className="w-full max-w-[1200px]">
        <AdminBoard trips={(trips || []) as unknown as TripWithPhotos[]} />
      </div>
    </div>
  );
}
