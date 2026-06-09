import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  
  // Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Extract nested relational data
    const { stops, days, ...tripPayload } = body;

    // 1. Verify trip ownership or admin status before editing
    const { data: existingTrip, error: fetchError } = await supabase
      .from('trips')
      .select('user_id')
      .eq('id', params.id)
      .single();

    if (fetchError || !existingTrip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 44 });
    }

    const adminEmailsStr = process.env.ADMIN_EMAILS || '';
    const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
    const isAdmin = user.email ? adminEmails.includes(user.email.toLowerCase()) : false;
    const isOwner = existingTrip.user_id === user.id;

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized to edit this trip' }, { status: 403 });
    }

    // 2. Perform the main trip update
    const { error: tripUpdateError } = await supabase
      .from('trips')
      .update(tripPayload)
      .eq('id', params.id);

    if (tripUpdateError) throw tripUpdateError;

    // 3. Update trip stops (delete existing, then insert updated list)
    const { error: deleteStopsError } = await supabase
      .from('trip_stops')
      .delete()
      .eq('trip_id', params.id);

    if (deleteStopsError) throw deleteStopsError;

    if (stops && stops.length > 0) {
      const stopsToInsert = stops.map((s: any) => ({
        trip_id: params.id,
        stop_name: s.stop_name,
        stop_note: s.stop_note,
        display_order: s.display_order,
        lat: s.lat,
        lng: s.lng,
      }));

      const { error: insertStopsError } = await supabase
        .from('trip_stops')
        .insert(stopsToInsert);

      if (insertStopsError) throw insertStopsError;
    }

    // 4. Update trip timeline/days (delete existing, then insert updated list)
    const { error: deleteDaysError } = await supabase
      .from('trip_days')
      .delete()
      .eq('trip_id', params.id);

    if (deleteDaysError) throw deleteDaysError;

    if (days && days.length > 0) {
      const daysToInsert = days.map((d: any) => ({
        trip_id: params.id,
        day_number: d.day_number,
        time_of_day: d.time_of_day,
        activity: d.activity,
        cost: d.cost,
        display_order: d.display_order,
      }));

      const { error: insertDaysError } = await supabase
        .from('trip_days')
        .insert(daysToInsert);

      if (insertDaysError) throw insertDaysError;
    }

    // Return a clean JSON response to let client-side router handle success state
    return NextResponse.json({ success: true, id: params.id });

  } catch (error: any) {
    console.error('API Edit Trip Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update trip' },
      { status: 500 }
    );
  }
}