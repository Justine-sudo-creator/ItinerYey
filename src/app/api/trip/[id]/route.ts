import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Trip, TripStop, TripDay } from '@/types/supabase';

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const tripId = params.id;
  
  try {
    const payload = await request.json();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminEmailsStr = process.env.ADMIN_EMAILS || '';
    const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
    const isAdmin = adminEmails.includes(user.email.toLowerCase());

    const { data: trip } = await supabase.from('trips').select('*').eq('id', tripId).single();
    
    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    if (trip.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Safely construct update payload with whitelisted fields
    const updatePayload: Partial<Trip> = {
      trip_name: payload.trip_name,
      destination: payload.destination,
      destination_region: payload.destination_region,
      destination_place_id: payload.destination_place_id,
      destination_lat: payload.destination_lat,
      destination_lng: payload.destination_lng,
      destination_city: payload.destination_city,
      destination_province: payload.destination_province,
      destination_country: payload.destination_country,
      origin_region: payload.origin_region,
      origin_place_id: payload.origin_place_id,
      origin_lat: payload.origin_lat,
      origin_lng: payload.origin_lng,
      origin_city: payload.origin_city,
      origin_province: payload.origin_province,
      origin_country: payload.origin_country,
      origin_area: payload.origin_area,
      end_area: payload.end_area,
      route_context: payload.route_context,
      travel_date: payload.travel_date,
      group_size: payload.group_size,
      group_type: payload.group_type,
      trip_type: payload.trip_type,
      duration_days: payload.duration_days,
      trip_duration_label: payload.trip_duration_label,
      cost_per_person: payload.cost_per_person,
      transport_cost: payload.transport_cost,
      transport_cost_scope: payload.transport_cost_scope,
      food_cost: payload.food_cost,
      activities_cost: payload.activities_cost,
      accommodation_cost: payload.accommodation_cost,
      detailed_costs: payload.detailed_costs,
      tip: payload.tip,
      honest_warning: payload.honest_warning,
      would_return: payload.would_return,
      travel_style: payload.travel_style,
      submission_tier: payload.submission_tier,
      trip_summary: payload.trip_summary,
      is_public: payload.is_public,
      is_curated: payload.is_curated,
      attribution_source: payload.attribution_source,
    };

    // Strip undefined properties
    Object.keys(updatePayload).forEach(key => {
      const k = key as keyof Partial<Trip>;
      if (updatePayload[k] === undefined) {
        delete updatePayload[k];
      }
    });

    // Moderation logic: if a regular user edits an approved trip, it must go back to pending review
    if (!isAdmin && trip.is_approved) {
      updatePayload.is_approved = false;
      updatePayload.review_status = 'pending_edit';
    }

    const { error: tripError } = await supabase.from('trips').update(updatePayload).eq('id', tripId);
    
    if (tripError) {
      throw tripError;
    }

    // Handle nested records safely if provided
    if (payload.stops) {
      const { error: delError } = await adminClient.from('trip_stops').delete().eq('trip_id', tripId);
      if (delError) {
        console.error('DELETE STOPS ERROR:', delError);
      }
      if (payload.stops.length > 0) {
        const { error: insError } = await adminClient.from('trip_stops').insert(payload.stops.map((s: Omit<TripStop, 'id' | 'trip_id' | 'created_at'>) => ({ ...s, trip_id: tripId })));
        if (insError) {
          console.error('INSERT STOPS ERROR:', insError);
        }
      }
    }

    if (payload.days) {
      const { error: delError } = await adminClient.from('trip_days').delete().eq('trip_id', tripId);
      if (delError) {
        console.error('DELETE DAYS ERROR:', delError);
      }
      if (payload.days.length > 0) {
        const { error: insError } = await adminClient.from('trip_days').insert(payload.days.map((d: Omit<TripDay, 'id' | 'trip_id'>) => ({ ...d, trip_id: tripId })));
        if (insError) {
          console.error('INSERT DAYS ERROR:', insError);
        }
      }
    }

    return NextResponse.json({ success: true, is_approved: updatePayload.is_approved ?? trip.is_approved });
  } catch (error: unknown) {
    console.error('Update trip error:', error);
    return NextResponse.json({ error: (error as Error).message || 'Server error' }, { status: 500 });
  }
}
