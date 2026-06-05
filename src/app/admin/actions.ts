'use server';

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

// Reusable function to verify if the caller is an admin
async function verifyAdmin() {
  const supabaseAuth = createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user || !user.email) {
    throw new Error('Not authenticated.');
  }

  const adminEmailsStr = process.env.ADMIN_EMAILS || '';
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());

  if (!adminEmails.includes(user.email.toLowerCase())) {
    throw new Error('Unauthorized. Admin access only.');
  }

  return user;
}

// Instantiate a privileged client bypassing RLS
function getAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured in server environment.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function approveTrip(tripId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { error } = await supabase
    .from('trips')
    .update({ is_approved: true, review_status: 'approved' })
    .eq('id', tripId);

  if (error) {
    throw new Error('Failed to approve trip: ' + error.message);
  }

  revalidatePath('/admin');
  revalidatePath('/'); // Revalidate public feed
  return { success: true };
}

export async function unpublishTrip(tripId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { error } = await supabase
    .from('trips')
    .update({ is_approved: false, review_status: 'rejected' })
    .eq('id', tripId);

  if (error) {
    throw new Error('Failed to unpublish trip: ' + error.message);
  }

  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

export async function deleteTrip(tripId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  // Explicitly delete child relational data first
  await supabase.from('saved_trips').delete().eq('trip_id', tripId);
  await supabase.from('trip_days').delete().eq('trip_id', tripId);
  await supabase.from('trip_photos').delete().eq('trip_id', tripId);

  // TODO for MVP: Delete physical photos from Supabase Storage
  // (Requires fetching the URLs, parsing the paths, and deleting from 'trip-photos' bucket)

  // Delete the actual trip
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId);

  if (error) {
    throw new Error('Failed to delete trip: ' + error.message);
  }

  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

export async function approveClaim(tripId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { data: trip, error: fetchError } = await supabase
    .from('trips')
    .select('claim_request_by')
    .eq('id', tripId)
    .single();

  if (fetchError || !trip || !trip.claim_request_by) {
    throw new Error('No pending claim request found for this trip.');
  }

  const claimerId = trip.claim_request_by;

  const { error } = await supabase
    .from('trips')
    .update({
      user_id: claimerId,
      claimed_by: claimerId,
      claim_request_by: null,
      claim_proof: null
    })
    .eq('id', tripId);

  if (error) {
    throw new Error('Failed to approve claim: ' + error.message);
  }

  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

export async function submitClaimRequest(tripId: string, proof: string) {
  const supabaseAuth = createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated.');
  }

  const supabase = getAdminSupabaseClient();
  
  const { error } = await supabase
    .from('trips')
    .update({
      claim_request_by: user.id,
      claim_proof: proof
    })
    .eq('id', tripId);

  if (error) {
    throw new Error('Failed to submit claim request: ' + error.message);
  }

  revalidatePath('/admin');
  revalidatePath(`/trip/${tripId}`);
  return { success: true };
}

export async function awardBadge(userId: string, badgeName: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { error } = await supabase
    .from('user_badges')
    .insert({
      user_id: userId,
      badge_name: badgeName
    });

  if (error) {
    throw new Error('Failed to award badge: ' + error.message);
  }

  revalidatePath('/admin');
  revalidatePath(`/profile/${userId}`);
  return { success: true };
}

export async function removeBadge(badgeId: string, userId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { error } = await supabase
    .from('user_badges')
    .delete()
    .eq('id', badgeId);

  if (error) {
    throw new Error('Failed to delete badge: ' + error.message);
  }

  revalidatePath('/admin');
  revalidatePath(`/profile/${userId}`);
  return { success: true };
}

export async function updateActiveChallenge(title: string, description: string, hashtag: string, reward_badge: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { error } = await supabase
    .from('active_challenge')
    .insert({
      title,
      description,
      hashtag,
      reward_badge
    });

  if (error) {
    throw new Error('Failed to update active challenge: ' + error.message);
  }

  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

export async function approveVerification(verificationId: string, userId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { error: vError } = await supabase
    .from('profile_verifications')
    .update({ status: 'approved' })
    .eq('id', verificationId);

  if (vError) throw new Error('Failed to approve verification status: ' + vError.message);

  const { error: uError } = await supabase
    .from('users')
    .update({ is_verified_organizer: true })
    .eq('id', userId);

  if (uError) throw new Error('Failed to set user verified organizer status: ' + uError.message);

  revalidatePath('/admin');
  return { success: true };
}

export async function rejectVerification(verificationId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { error } = await supabase
    .from('profile_verifications')
    .update({ status: 'rejected' })
    .eq('id', verificationId);

  if (error) throw new Error('Failed to reject verification: ' + error.message);

  revalidatePath('/admin');
  return { success: true };
}

export async function approveBoost(hostingId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { error } = await supabase
    .from('trip_hosting')
    .update({ 
      boost_status: 'approved',
      boosted_at: new Date().toISOString()
    })
    .eq('id', hostingId);

  if (error) throw new Error('Failed to approve boost: ' + error.message);

  revalidatePath('/admin');
  revalidatePath('/'); // Revalidate feed to show boosted styling
  return { success: true };
}

export async function rejectBoost(hostingId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { error } = await supabase
    .from('trip_hosting')
    .update({ boost_status: 'rejected' })
    .eq('id', hostingId);

  if (error) throw new Error('Failed to reject boost: ' + error.message);

  revalidatePath('/admin');
  return { success: true };
}

export async function approveListing(hostingId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { data: hosting, error: fetchError } = await supabase
    .from('trip_hosting')
    .select('is_boosted')
    .eq('id', hostingId)
    .single();

  if (fetchError || !hosting) {
    throw new Error('Meetup hosting not found');
  }

  const { error } = await supabase
    .from('trip_hosting')
    .update({ 
      listing_status: 'approved',
      boost_status: hosting.is_boosted ? 'approved' : 'none',
      boosted_at: hosting.is_boosted ? new Date().toISOString() : null
    })
    .eq('id', hostingId);

  if (error) throw new Error('Failed to approve listing: ' + error.message);

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/meetups');
  return { success: true };
}

export async function rejectListing(hostingId: string) {
  await verifyAdmin();
  const supabase = getAdminSupabaseClient();

  const { error } = await supabase
    .from('trip_hosting')
    .update({ 
      listing_status: 'rejected',
      boost_status: 'rejected'
    })
    .eq('id', hostingId);

  if (error) throw new Error('Failed to reject listing: ' + error.message);

  revalidatePath('/admin');
  revalidatePath('/');
  revalidatePath('/meetups');
  return { success: true };
}
