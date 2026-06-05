'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ProfileVerification, TripHosting, User, Trip } from '@/types/supabase';
import { PrimaryButton } from '@/components/ui/Button';
import { 
  approveVerification, 
  rejectVerification, 
  approveBoost, 
  rejectBoost,
  approveListing,
  rejectListing
} from '@/app/admin/actions';

export default function AdminPaymentsTab() {
  const supabase = createClient();
  const [verifications, setVerifications] = useState<(ProfileVerification & { users: User })[]>([]);
  const [listings, setListings] = useState<(TripHosting & { users: User, trips: Trip })[]>([]);
  const [boosts, setBoosts] = useState<(TripHosting & { users: User, trips: Trip })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    setLoading(true);
    
    // Fetch pending organizer verifications (₱149)
    const { data: vData } = await supabase
      .from('profile_verifications')
      .select('*, users!inner(*)')
      .eq('status', 'pending');
      
    // Fetch pending meetup hosting listings (₱50 or ₱100 if boosted)
    const { data: lData } = await supabase
      .from('trip_hosting')
      .select('*, users!inner(*), trips!inner(*)')
      .eq('listing_status', 'pending');

    // Fetch pending boosts for ALREADY approved/free listings (₱30)
    const { data: bData } = await supabase
      .from('trip_hosting')
      .select('*, users!inner(*), trips!inner(*)')
      .neq('listing_status', 'pending')
      .eq('boost_status', 'pending');

    setVerifications((vData as any) || []);
    setListings((lData as any) || []);
    setBoosts((bData as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleApproveVerification = async (id: string, userId: string) => {
    try {
      await approveVerification(id, userId);
      fetchPayments();
    } catch (e) {
      console.error('Failed to approve verification:', e);
    }
  };

  const handleRejectVerification = async (id: string) => {
    try {
      await rejectVerification(id);
      fetchPayments();
    } catch (e) {
      console.error('Failed to reject verification:', e);
    }
  };

  const handleApproveListing = async (id: string) => {
    try {
      await approveListing(id);
      fetchPayments();
    } catch (e) {
      console.error('Failed to approve listing:', e);
    }
  };

  const handleRejectListing = async (id: string) => {
    try {
      await rejectListing(id);
      fetchPayments();
    } catch (e) {
      console.error('Failed to reject listing:', e);
    }
  };

  const handleApproveBoost = async (id: string) => {
    try {
      await approveBoost(id);
      fetchPayments();
    } catch (e) {
      console.error('Failed to approve boost:', e);
    }
  };

  const handleRejectBoost = async (id: string) => {
    try {
      await rejectBoost(id);
      fetchPayments();
    } catch (e) {
      console.error('Failed to reject boost:', e);
    }
  };

  if (loading) {
    return <div className="p-8 text-center font-bold">Loading payments queue...</div>;
  }

  return (
    <div className="bg-surface border-4 border-border-dark shadow-hard p-6 flex flex-col gap-6">
      <h2 className="text-2xl font-black uppercase tracking-tight border-b-4 border-border-dark pb-3">Payments Queue</h2>

      <div className="flex flex-col gap-8">
        {/* Organizer Verifications */}
        <section>
          <h3 className="font-bold text-lg mb-3">Organizer Verification Requests (₱149)</h3>
          {verifications.length === 0 ? (
            <div className="bg-soft-beige p-4 text-secondary italic font-bold">No pending verifications.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {verifications.map(v => (
                <div key={v.id} className="border-2 border-border-dark p-4 bg-white shadow-hard-sm">
                  <p className="font-bold text-sm">User: {v.users.display_name} ({v.users.email})</p>
                  <p className="text-sm">FB Link: <a href={v.facebook_link} target="_blank" className="text-accent-blue underline">{v.facebook_link}</a></p>
                  <div className="text-sm font-mono mt-2 bg-accent-yellow/20 p-2 border border-border-dark flex flex-col gap-1">
                    <p><strong>GCash Name:</strong> {v.gcash_account_name || 'N/A'}</p>
                    <p><strong>GCash Ref:</strong> {v.gcash_reference}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <PrimaryButton onClick={() => handleApproveVerification(v.id, v.user_id)} className="flex-1 py-2 text-xs">Approve</PrimaryButton>
                    <button onClick={() => handleRejectVerification(v.id)} className="flex-1 py-2 text-xs bg-accent-coral text-white border-2 border-border-dark font-bold uppercase tracking-wide">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Meetup Listings (₱50 or ₱100 if boosted) */}
        <section>
          <h3 className="font-bold text-lg mb-3">Meetup Listings Queue (₱50 / ₱80)</h3>
          {listings.length === 0 ? (
            <div className="bg-soft-beige p-4 text-secondary italic font-bold">No pending listings.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listings.map(l => {
                const amount = l.is_boosted ? 80 : 50;
                return (
                  <div key={l.id} className="border-2 border-border-dark p-4 bg-white shadow-hard-sm">
                    <p className="font-bold text-sm">Host: {l.users?.display_name} ({l.users?.email})</p>
                    <p className="text-sm">Trip: <a href={`/trip/${l.trip_id}`} target="_blank" className="text-accent-blue underline">{l.trips?.destination}</a></p>
                    <p className="text-sm">Target Date: {l.target_date}</p>
                    <p className="text-xs font-bold text-accent-coral uppercase tracking-wide mt-1">
                      Amount: ₱{amount} {l.is_boosted && '(Includes Boost)'}
                    </p>
                    <div className="text-sm font-mono mt-2 bg-accent-yellow/20 p-2 border border-border-dark">
                      GCash Ref: {l.listing_reference || 'N/A'}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <PrimaryButton onClick={() => handleApproveListing(l.id)} className="flex-1 py-2 text-xs">Approve</PrimaryButton>
                      <button onClick={() => handleRejectListing(l.id)} className="flex-1 py-2 text-xs bg-accent-coral text-white border-2 border-border-dark font-bold uppercase tracking-wide">Reject</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Trip Boosts */}
        <section>
          <h3 className="font-bold text-lg mb-3">Trip Boost Requests (₱30)</h3>
          {boosts.length === 0 ? (
            <div className="bg-soft-beige p-4 text-secondary italic font-bold">No pending boosts.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {boosts.map(h => (
                <div key={h.id} className="border-2 border-border-dark p-4 bg-white shadow-hard-sm">
                  <p className="font-bold text-sm">Host: {h.users?.display_name} ({h.users?.email})</p>
                  <p className="text-sm">Trip: <a href={`/trip/${h.trip_id}`} target="_blank" className="text-accent-blue underline">{h.trips?.destination}</a></p>
                  <p className="text-sm">Target Date: {h.target_date}</p>
                  <p className="text-sm font-mono mt-2 bg-accent-yellow/20 p-2 border border-border-dark">GCash Ref: {h.boost_reference}</p>
                  <div className="flex gap-2 mt-4">
                    <PrimaryButton onClick={() => handleApproveBoost(h.id)} className="flex-1 py-2 text-xs">Approve</PrimaryButton>
                    <button onClick={() => handleRejectBoost(h.id)} className="flex-1 py-2 text-xs bg-accent-coral text-white border-2 border-border-dark font-bold uppercase tracking-wide">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
