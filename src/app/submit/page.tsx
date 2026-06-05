import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import SubmitContainer from '@/components/submit/SubmitContainer';
import React from 'react';

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function SubmitPage({ searchParams }: Props) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Reconstruct the submit URL to redirect back here after signup
    const typeStr = typeof searchParams.type === 'string' ? searchParams.type : '';
    const returnToStr = typeof searchParams.returnTo === 'string' ? searchParams.returnTo : '';
    
    let currentUrl = '/submit';
    if (typeStr || returnToStr) {
      const query = new URLSearchParams();
      if (typeStr) query.set('type', typeStr);
      if (returnToStr) query.set('returnTo', returnToStr);
      currentUrl += '?' + query.toString();
    }
    
    redirect(`/signup?returnTo=${encodeURIComponent(currentUrl)}`);
  }

  // Load user profile to pass default region/travel style down if we want
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const adminEmailsStr = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
  const isAdmin = user.email ? adminEmails.includes(user.email.toLowerCase()) : false;

  return (
    <div className="w-full flex justify-center pb-16 pt-6 px-4">
      <div className="w-full max-w-4xl">
        <SubmitContainer userProfile={profile} isAdmin={isAdmin} />
      </div>
    </div>
  );
}
