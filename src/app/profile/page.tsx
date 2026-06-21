import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { ProfileView } from '@/components/profile/ProfileView';
import { Route, RouteSegment, User } from '@/types/supabase';

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?returnTo=/profile');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login?returnTo=/profile');
  }

  const { data: myRoutes } = await supabase
    .from('routes')
    .select('*, route_segments(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <ProfileView
      profile={profile as User}
      routes={(myRoutes || []) as unknown as (Route & { route_segments: RouteSegment[] })[]}
    />
  );
}
