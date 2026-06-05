import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { targetUserId } = await request.json();
    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing target user ID' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.id === targetUserId) {
      return NextResponse.json({ error: 'Cannot vouch for yourself' }, { status: 400 });
    }

    // Since we don't have a secure RPC for atomic increment in MVP,
    // and RLS prevents updating other users from the client,
    // we use the service role key or we can just call an RPC if we create one.
    // Let's assume the DB has a simple increment function or we just do it via service role.
    
    // Instead of setting up service role for this MVP API, 
    // we can use a raw update on the supabase client if we configure the policy.
    // Actually, we can just use `rpc` if we create the rpc in the migration.
    
    // Wait, since we are in the server component, can we update? No, server component uses the user's JWT.
    // Let's create the RPC in our phase 3 migration!
    const { error } = await supabase.rpc('increment_vouch_count', { target_user_id: targetUserId });

    if (error) {
      console.error('Vouch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Insert Vouch notification
    try {
      const { data: actorProfile } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .single();

      const actorName = actorProfile?.display_name || 'Someone';

      await supabase
        .from('notifications')
        .insert({
          user_id: targetUserId,
          actor_id: user.id,
          type: 'vouch_received',
          title: 'New Vouch!',
          message: `${actorName} has vouched for you! Your trust index has increased.`,
          link: `/profile?id=${targetUserId}`
        });
    } catch (notifErr) {
      console.error('Failed to send vouch notification:', notifErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
