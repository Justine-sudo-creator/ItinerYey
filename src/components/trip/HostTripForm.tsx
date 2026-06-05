'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { RetroPanel, SectionHeader } from '@/components/ui/Cards';
import { PrimaryButton } from '@/components/ui/Button';

import OrganizerVerificationForm from '@/components/profile/OrganizerVerificationForm';

export default function HostTripForm({ 
  tripId, 
  userId, 
  isVerified = false,
  hostingCredits = 0,
  previousBoostsCount = 0
}: { 
  tripId: string, 
  userId: string,
  isVerified?: boolean,
  hostingCredits?: number,
  previousBoostsCount?: number
}) {
  const router = useRouter();
  const supabase = createClient();
  
  const [targetDate, setTargetDate] = useState('');
  const [slotsNeeded, setSlotsNeeded] = useState(1);
  const [contactLink, setContactLink] = useState('');
  const [hostNote, setHostNote] = useState('');
  const [isBoosted, setIsBoosted] = useState(false);
  const [useCredit, setUseCredit] = useState(hostingCredits > 0);
  const [paymentReference, setPaymentReference] = useState('');
  const [copied, setCopied] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pricing Helpers
  const showListingPayment = !isVerified && !useCredit;
  const isFreeBoost = isVerified && previousBoostsCount === 0;
  const showBoostPayment = isBoosted && !isFreeBoost;
  
  const totalAmount = (showListingPayment ? 50 : 0) + (showBoostPayment ? 30 : 0);
  const requiresPayment = totalAmount > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    if (requiresPayment && (!paymentReference || paymentReference.length !== 12)) {
      setErrorMsg('Please enter a valid 12-digit GCash Reference Number for your payment.');
      setIsSubmitting(false);
      return;
    }

    try {
      const listingStatus = isVerified || useCredit ? 'free' : 'pending';
      const boostStatus = isBoosted ? (isFreeBoost ? 'approved' : 'pending') : 'none';

      const { error } = await supabase
        .from('trip_hosting')
        .insert({
          trip_id: tripId,
          host_user_id: userId,
          target_date: targetDate,
          slots_needed: slotsNeeded,
          contact_link: contactLink,
          host_note: hostNote,
          is_boosted: isBoosted,
          boost_reference: showBoostPayment ? paymentReference : null,
          boost_status: boostStatus,
          listing_reference: showListingPayment ? paymentReference : null,
          listing_status: listingStatus
        });

      if (error) throw error;

      // If welcome credit was spent, deduct it from users
      if (useCredit && !isVerified) {
        const { error: creditError } = await supabase
          .from('users')
          .update({ hosting_credits: Math.max(0, hostingCredits - 1) })
          .eq('id', userId);
        if (creditError) {
          console.error('Failed to deduct hosting credit:', creditError);
        }
      }
      
      router.refresh();
      if (isBoosted && !isFreeBoost) {
        router.push('/meetups?success=true&boost=pending');
      } else {
        router.push('/meetups?success=true');
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'An error occurred while submitting.');
      setIsSubmitting(false);
    }
  };

  return (
    <RetroPanel className="max-w-2xl mx-auto p-6">
      <SectionHeader title="Find Buddies for this Trip" />
      <p className="mb-6 font-medium text-secondary">
        Planning to go on this trip? Open slots for other travelers to join you!
      </p>

      {/* Non-negotiable Safety Disclaimer */}
      <div className="mb-6 p-4 border-2 border-accent-coral bg-accent-coral/10">
        <h3 className="font-bold text-accent-coral uppercase text-sm mb-2">⚠️ Safety Disclaimer</h3>
        <p className="text-xs font-medium text-primary leading-relaxed">
          Always meet in public places. Do not send money to people you do not know or trust. 
          ItinerYey is a platform for finding travel buddies and does not vet every user. 
          Travel at your own risk.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 bg-accent-coral text-white font-bold text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label className="font-bold text-sm text-primary uppercase">Target Date</label>
          <input 
            type="date"
            required
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="border-2 border-border-dark px-3 py-2 text-sm focus:outline-none focus:border-primary"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-bold text-sm text-primary uppercase">Slots Needed</label>
          <input 
            type="number"
            required
            min={1}
            max={20}
            value={slotsNeeded}
            onChange={e => setSlotsNeeded(parseInt(e.target.value))}
            className="border-2 border-border-dark px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-bold text-sm text-primary uppercase">Contact Link (FB, IG, Telegram)</label>
          <input 
            type="text"
            required
            placeholder="e.g. facebook.com/myprofile"
            value={contactLink}
            onChange={e => setContactLink(e.target.value)}
            className="border-2 border-border-dark px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-bold text-sm text-primary uppercase">Note for Travelers (Optional)</label>
          <textarea 
            placeholder="e.g. Looking for someone who can drive!"
            value={hostNote}
            onChange={e => setHostNote(e.target.value)}
            className="border-2 border-border-dark px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:border-primary"
          />
          <p className="text-[10px] text-secondary font-medium mt-1 leading-normal">
            Suggested tips: Mention your planned activities, target budget guidelines, transportation details, or preferred vibe for your travel buddies.
          </p>
        </div>

        {/* Pricing & Listing Fee Section */}
        <div className="p-4 border-2 border-border-dark bg-white shadow-hard-sm flex flex-col gap-3">
          <span className="font-black uppercase tracking-wider text-xs border-b border-border-dark pb-1 text-primary">Hosting & Cost Options</span>
          
          {isVerified ? (
            <p className="text-xs font-bold text-accent-green uppercase tracking-wide">
              Verified Organizer Benefit: Lifetime Unlimited Free Listings Enabled.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {hostingCredits > 0 ? (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={useCredit}
                    onChange={e => setUseCredit(e.target.checked)}
                    className="w-4 h-4 accent-primary border-2 border-border-dark"
                  />
                  <span className="font-bold text-xs uppercase text-primary">
                    Use 1 Welcome Credit (Balance: {hostingCredits}) — Free Listing!
                  </span>
                </label>
              ) : (
                <p className="text-xs font-bold text-secondary">
                  No hosting credits remaining. Listing fee: <span className="text-primary font-black">₱50</span>
                </p>
              )}

              {/* Contextual Organizer Verification Prompt */}
              <div className="mt-2 border-t border-dashed border-border-dark/20 pt-2">
                <OrganizerVerificationForm userId={userId} />
              </div>
            </div>
          )}

          {/* Boost Option */}
          <div className="mt-2 pt-2 border-t border-border-dark/20 flex flex-col gap-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox"
                checked={isBoosted}
                onChange={e => setIsBoosted(e.target.checked)}
                className="w-4 h-4 accent-primary border-2 border-border-dark"
              />
              <span className="font-bold text-xs uppercase text-primary">
                Boost this Listing {isFreeBoost ? '(FREE First Boost!)' : '(₱30)'}
              </span>
            </label>
            <p className="text-[10px] text-secondary font-medium ml-7">
              {isFreeBoost 
                ? 'Your first boost is 100% free as a Verified Organizer! Pins your meetup to the top of the feed for up to 7 days (or until the meetup date).'
                : 'Highlight and pin your hosted meetup to the top of the feed to find buddies faster. Boost lasts for up to 7 days (or until the meetup date).'
              }
            </p>
          </div>
        </div>

        {/* GCash Payment instructions (Only shows if there is a cost > 0) */}
        {requiresPayment && (
          <div className="flex flex-col gap-2 p-4 border-2 border-accent-yellow bg-accent-yellow/10">
            <span className="font-black uppercase text-xs text-primary tracking-wide">Payment Instructions (₱{totalAmount})</span>
            <p className="text-xs font-medium text-secondary">
              Pay the ₱{totalAmount} fee {totalAmount === 80 ? '(₱50 Listing + ₱30 Boost)' : ''} to GCash 0967-463-8941:
            </p>
            <div className="mt-2 flex flex-col gap-4 border-l-4 border-accent-yellow pl-4">
              <div className="flex flex-col items-center text-center gap-3 bg-white p-4 border-2 border-border-dark shadow-hard-sm w-full max-w-sm">
                <a 
                  href="/gcash_qr_code.png" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  title="Click to view full size"
                  className="w-36 h-48 border-2 border-border-dark bg-white shrink-0 flex items-center justify-center p-1 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/gcash_qr_code.png" alt="GCash QR Code" className="w-full h-full object-contain" />
                </a>
                <div className="w-full flex flex-col items-center gap-1.5 mt-1">
                  <p className="text-xs font-bold text-primary">
                    1. Scan QR to pay ₱{totalAmount} to JU****E M.
                  </p>
                  <p className="text-[10px] font-medium text-secondary">
                    Or send via Express Send to:
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs bg-soft-beige px-2 py-1 border border-border-dark">
                      0967-463-8941
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText('09674638941');
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className={`px-2 py-1 text-[10px] font-bold uppercase border border-border-dark shadow-hard-sm transition-all ${copied ? 'bg-accent-green text-white' : 'bg-accent-yellow text-primary'}`}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-bold text-xs text-primary uppercase">2. GCash Reference Number</label>
                <input 
                  type="text"
                  required
                  maxLength={12}
                  placeholder="12-digit reference number"
                  value={paymentReference}
                  onChange={e => setPaymentReference(e.target.value)}
                  className="border-2 border-border-dark px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-4 mt-4">
          <PrimaryButton type="submit" disabled={isSubmitting} className="flex-1 py-3 text-sm">
            {isSubmitting ? 'Publishing...' : 'Publish Hosting'}
          </PrimaryButton>
          <button 
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border-2 border-border-dark bg-surface font-bold text-sm uppercase shadow-hard-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    </RetroPanel>
  );
}
