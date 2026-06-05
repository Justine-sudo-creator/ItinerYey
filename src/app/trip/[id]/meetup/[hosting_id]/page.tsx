import { createClient } from '@/utils/supabase/server';
import { notFound, redirect } from 'next/navigation';
import MeetupPageView from '@/components/trip/MeetupPageView';

export const dynamic = 'force-dynamic';

export default async function MeetupPage({ params }: { params: { id: string, hosting_id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=/trip/${params.id}/meetup/${params.hosting_id}`);
  }

  // Fetch the trip
  const { data: trip } = await supabase
    .from('trips')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!trip) notFound();

  // Fetch the hosting info
  const { data: hosting } = await supabase
    .from('trip_hosting')
    .select('*, users!trip_hosting_host_user_id_fkey(*)')
    .eq('id', params.hosting_id)
    .single();

  if (!hosting) notFound();

  // Fetch members
  const { data: members } = await supabase
    .from('trip_hosting_members')
    .select('*, users!inner(*)')
    .eq('hosting_id', params.hosting_id);

  // Fetch messages
  const { data: messages } = await supabase
    .from('trip_hosting_messages')
    .select('*, users!user_id(*), parent:reply_to_id(content, user_id, users!user_id(display_name))')
    .eq('hosting_id', params.hosting_id)
    .order('created_at', { ascending: true });

  const isHost = hosting.host_user_id === user.id;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <MeetupPageView 
        trip={trip as any}
        hosting={hosting as any}
        members={(members as any) || []}
        messages={(messages as any) || []}
        currentUserId={user.id}
        isHost={isHost}
      />
    </div>
  );
}
