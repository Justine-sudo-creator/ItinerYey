import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Trip, TripStop, TripDay, TripPhoto } from '@/types/supabase';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const originalTripId = params.id;

  try {
    // 1. Get logged-in user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to remix a trip.' }, { status: 401 });
    }

    // 2. Fetch original trip
    const { data: originalTrip, error: originalTripError } = await adminClient
      .from('trips')
      .select('*')
      .eq('id', originalTripId)
      .single();

    if (originalTripError || !originalTrip) {
      return NextResponse.json({ error: 'Original trip not found.' }, { status: 404 });
    }

    // 3. Fetch nested trip data
    const { data: originalStops } = await adminClient.from('trip_stops').select('*').eq('trip_id', originalTripId);
    const { data: originalDays } = await adminClient.from('trip_days').select('*').eq('trip_id', originalTripId);
    const { data: originalPhotos } = await adminClient.from('trip_photos').select('*').eq('trip_id', originalTripId);

    // 4. Construct payload for the new cloned trip (draft mode in Locker)
    const clonedTripPayload: Omit<Trip, 'id' | 'created_at'> = {
      user_id: user.id,
      trip_name: originalTrip.trip_name, // Keep the original name exactly as requested
      destination: originalTrip.destination,
      destination_region: originalTrip.destination_region,
      destination_place_id: originalTrip.destination_place_id,
      destination_lat: originalTrip.destination_lat,
      destination_lng: originalTrip.destination_lng,
      destination_city: originalTrip.destination_city,
      destination_province: originalTrip.destination_province,
      destination_country: originalTrip.destination_country,
      origin_region: originalTrip.origin_region,
      origin_place_id: originalTrip.origin_place_id,
      origin_lat: originalTrip.origin_lat,
      origin_lng: originalTrip.origin_lng,
      origin_city: originalTrip.origin_city,
      origin_province: originalTrip.origin_province,
      origin_country: originalTrip.origin_country,
      origin_area: originalTrip.origin_area,
      end_area: originalTrip.end_area,
      route_context: originalTrip.route_context,
      travel_date: originalTrip.travel_date,
      group_size: originalTrip.group_size,
      group_type: originalTrip.group_type,
      trip_type: originalTrip.trip_type,
      duration_days: originalTrip.duration_days,
      trip_duration_label: originalTrip.trip_duration_label,
      cost_per_person: originalTrip.cost_per_person,
      transport_cost: originalTrip.transport_cost,
      transport_cost_scope: originalTrip.transport_cost_scope,
      food_cost: originalTrip.food_cost,
      activities_cost: originalTrip.activities_cost,
      accommodation_cost: originalTrip.accommodation_cost,
      detailed_costs: originalTrip.detailed_costs,
      tip: originalTrip.tip,
      honest_warning: originalTrip.honest_warning,
      would_return: originalTrip.would_return,
      travel_style: originalTrip.travel_style,
      submission_tier: originalTrip.submission_tier,
      trip_summary: originalTrip.trip_summary,
      is_approved: false, // remix drafts start unapproved
      is_public: false, // remix drafts start private in Locker
      is_curated: false,
      attribution_source: null,
      claimed_by: null,
      claim_request_by: null,
      review_status: 'draft',
      save_count: 0,
      helpful_count: 0,
      view_count: 0,
    };

    // 5. Insert new cloned trip
    const { data: newTrip, error: insertTripError } = await adminClient
      .from('trips')
      .insert(clonedTripPayload)
      .select('id')
      .single();

    if (insertTripError || !newTrip) {
      throw insertTripError || new Error('Failed to create remixed trip in database.');
    }

    const newTripId = newTrip.id;

    // 6. Clone trip stops (if any exist)
    if (originalStops && originalStops.length > 0) {
      const clonedStops = originalStops.map((s: TripStop) => ({
        trip_id: newTripId,
        stop_name: s.stop_name,
        stop_note: s.stop_note,
        display_order: s.display_order,
      }));
      const { error: stopsError } = await adminClient.from('trip_stops').insert(clonedStops);
      if (stopsError) {
        console.error('Failed to clone trip stops:', stopsError);
      }
    }

    // 7. Clone trip days (if any exist)
    if (originalDays && originalDays.length > 0) {
      const clonedDays = originalDays.map((d: TripDay) => ({
        trip_id: newTripId,
        day_number: d.day_number,
        time_of_day: d.time_of_day,
        activity: d.activity,
        cost: d.cost,
        display_order: d.display_order,
      }));
      const { error: daysError } = await adminClient.from('trip_days').insert(clonedDays);
      if (daysError) {
        console.error('Failed to clone trip days:', daysError);
      }
    }

    // 8. Clone trip photos (if any exist)
    if (originalPhotos && originalPhotos.length > 0) {
      const clonedPhotos = originalPhotos.map((p: TripPhoto) => ({
        trip_id: newTripId,
        photo_url: p.photo_url,
        caption: p.caption,
        is_hero: p.is_hero,
        display_order: p.display_order,
      }));
      const { error: photosError } = await adminClient.from('trip_photos').insert(clonedPhotos);
      if (photosError) {
        console.error('Failed to clone trip photos:', photosError);
      }
    }

    return NextResponse.json({ success: true, newTripId });
  } catch (error: unknown) {
    console.error('Remix trip server error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Cloning operation failed. Server error.' },
      { status: 500 }
    );
  }
}
