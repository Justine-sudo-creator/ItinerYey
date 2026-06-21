import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import SubmitRouteForm from '@/components/submit/SubmitRouteForm';
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
    const returnToStr = typeof searchParams.returnTo === 'string' ? searchParams.returnTo : '';
    
    let currentUrl = '/submit';
    if (returnToStr) {
      const query = new URLSearchParams();
      query.set('returnTo', returnToStr);
      currentUrl += '?' + query.toString();
    }
    
    redirect(`/login?returnTo=${encodeURIComponent(currentUrl)}`);
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div className="w-full flex justify-center pb-16 pt-6 px-4">
      <div className="w-full max-w-4xl">
        <SubmitRouteForm userProfile={profile} />
      </div>
    </div>
  );
}
