import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createServiceClient } from '@/utils/supabase/service';

export async function POST(request: Request) {
  try {
    const { id, type } = await request.json();
    if (!id || !type) {
      return NextResponse.json({ error: 'Missing parameter id or type' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    if (type === 'hosting') {
      // Deleting a hosting requires checking if the user owns the hosting
      let hosting = null;
      
      const { data: byId } = await serviceClient
        .from('trip_hosting')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (byId) {
        hosting = byId;
      } else {
        // Fallback: search by trip_id and host_user_id if the id passed is actually a trip_id
        const { data: byComposite } = await serviceClient
          .from('trip_hosting')
          .select('*')
          .eq('trip_id', id)
          .eq('host_user_id', user.id)
          .maybeSingle();
          
        if (byComposite) {
          hosting = byComposite;
        }
      }

      if (!hosting) {
        return NextResponse.json({ error: 'Hosting not found' }, { status: 404 });
      }

      if (hosting.host_user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { error: deleteErr } = await serviceClient
        .from('trip_hosting')
        .delete()
        .eq('id', hosting.id);

      if (deleteErr) throw deleteErr;
    } else if (type === 'membership') {
      // Find registration: check if the id matches trip_hosting_members.id 
      // or if it represents the hosting_id and we should delete the logged in user's registration
      let membership = null;
      
      const { data: byId } = await serviceClient
        .from('trip_hosting_members')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (byId) {
        membership = byId;
      } else {
        // Fallback: look up by hosting_id and current user_id composite
        const { data: byComposite } = await serviceClient
          .from('trip_hosting_members')
          .select('*')
          .eq('hosting_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (byComposite) {
          membership = byComposite;
        }
      }

      if (!membership) {
        return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
      }

      if (membership.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { error: deleteErr } = await serviceClient
        .from('trip_hosting_members')
        .delete()
        .eq('id', membership.id);

      if (deleteErr) throw deleteErr;
    } else {
      return NextResponse.json({ error: 'Invalid delete type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
