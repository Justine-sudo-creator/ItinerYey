import { createClient } from '@/utils/supabase/server';
import SubmitRouteForm from '@/components/submit/SubmitRouteForm';
import { notFound, redirect } from 'next/navigation';
import { Route, RouteSegment, User } from '@/types/supabase';

interface EditRoutePageProps {
  params: { id: string };
}

export default async function EditRoutePage({ params }: EditRoutePageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(`/route/${params.id}/edit`)}`);
  }

  const { data: routeData, error } = await supabase
    .from('routes')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !routeData) {
    notFound();
  }

  if (routeData.user_id !== user.id) {
    notFound();
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: segments } = await supabase
    .from('route_segments')
    .select('*')
    .eq('route_id', params.id)
    .order('display_order', { ascending: true });

  return (
    <div className="w-full flex justify-center pb-16 pt-6 px-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl font-display font-black text-primary mb-6">Edit Route</h1>
        <SubmitRouteForm
          userProfile={profile as User}
          existingRoute={routeData as Route}
          existingSegments={(segments || []) as RouteSegment[]}
        />
      </div>
    </div>
  );
}
