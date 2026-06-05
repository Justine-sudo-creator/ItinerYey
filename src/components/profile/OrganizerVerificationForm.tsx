'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { PrimaryButton } from '@/components/ui/Button';
import { BadgeCheck, Info, X, Zap, Award, TrendingUp, Infinity } from 'lucide-react';

export default function OrganizerVerificationForm({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showBenefitsModal, setShowBenefitsModal] = useState(false);
  const [facebookLink, setFacebookLink] = useState('');
  const [gcashRef, setGcashRef] = useState('');
  const [gcashName, setGcashName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    
    if (!facebookLink || !gcashRef || !gcashName || gcashRef.length !== 12) {
      setMessage({ type: 'error', text: 'Please provide valid Facebook link, GCash name, and 12-digit GCash Reference.' });
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase
      .from('profile_verifications')
      .insert({
        user_id: userId,
        facebook_link: facebookLink,
        gcash_reference: gcashRef,
        gcash_account_name: gcashName
      });

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Error submitting request.' });
      setIsSubmitting(false);
    } else {
      setMessage({ type: 'success', text: 'Verification requested! Admin will review within 24 hours.' });
      setIsOpen(false);
      setIsSubmitting(false);
    }
  };

  if (!isOpen && !message) {
    return (
      <div className="w-full mt-4">
        <div className="flex gap-2 w-full">
          <button 
            onClick={() => setIsOpen(true)}
            className="flex-1 py-2 bg-accent-blue text-white font-bold text-xs sm:text-sm uppercase tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center justify-center gap-1.5"
          >
            <BadgeCheck className="w-4 h-4 text-white fill-white/20 shrink-0" />
            Get Verified (₱149)
          </button>
          <button
            type="button"
            onClick={() => setShowBenefitsModal(true)}
            className="px-3 bg-surface border-2 border-border-dark shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center justify-center text-primary"
            title="Learn More About Benefits"
          >
            <Info className="w-4 h-4 shrink-0" />
          </button>
        </div>

        {/* Retro Benefits Modal Popup */}
        {showBenefitsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-surface border-4 border-border-dark p-6 max-w-sm w-full shadow-hard relative bg-[url('/noise.png')] animate-in zoom-in-95 duration-150">
              <button 
                type="button"
                onClick={() => setShowBenefitsModal(false)}
                className="absolute top-3 right-3 p-1 hover:bg-soft-beige border-2 border-transparent hover:border-border-dark transition-all rounded-sm"
              >
                <X className="w-4 h-4 text-primary" />
              </button>
              
              <div className="flex items-center gap-2 mb-4 text-accent-blue font-black uppercase text-sm tracking-wider">
                <BadgeCheck className="w-5 h-5 shrink-0 text-accent-blue" /> Organizer Benefits
              </div>
              
              <p className="text-xs font-bold text-primary mb-4 leading-relaxed">
                Upgrade to a <span className="text-accent-blue">Verified Organizer (₱149 one-time)</span> to unlock:
              </p>
              
              <ul className="text-xs font-bold text-secondary flex flex-col gap-3.5 mb-6 pl-1 text-left">
                <li className="flex items-start gap-2.5">
                  <Infinity className="w-4 h-4 text-accent-coral shrink-0 mt-0.5" />
                  <span><strong>Lifetime Free Hosting:</strong> Skip the ₱50 meetup listing fee forever.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Award className="w-4 h-4 text-accent-blue shrink-0 mt-0.5" />
                  <span><strong>Organizer Badge:</strong> Displayed on your profile and meetups.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-accent-yellow shrink-0 mt-0.5" />
                  <span><strong>Free First Boost:</strong> Pin your meetup to the top of the feed.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <TrendingUp className="w-4 h-4 text-accent-green shrink-0 mt-0.5" />
                  <span><strong>Double RSVP Approvals:</strong> Build trust with potential buddies.</span>
                </li>
              </ul>
              
              <PrimaryButton 
                onClick={() => {
                  setShowBenefitsModal(false);
                  setIsOpen(true);
                }}
                className="w-full py-2.5 text-xs sm:text-sm"
              >
                Get Verified Now
              </PrimaryButton>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 border-2 border-border-dark bg-white shadow-hard-sm">
      <h3 className="font-black text-sm uppercase tracking-wide mb-2">Organizer Verification</h3>
      {message?.type === 'success' ? (
        <p className="text-green-600 font-bold text-sm">{message.text}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {message?.type === 'error' && (
            <p className="text-accent-coral font-bold text-xs">{message.text}</p>
          )}
          <div className="flex flex-col items-center text-center gap-3 bg-soft-beige/30 p-4 border-2 border-border-dark shadow-hard-sm my-1 w-full">
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
                1. Scan QR to pay **₱149**
              </p>
              <p className="text-[10px] font-medium text-secondary">
                Or send via GCash Express to:
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="font-mono font-bold text-xs bg-white px-2 py-1 border border-border-dark">
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
            <label className="font-bold text-xs text-primary uppercase">2. Facebook Profile Link</label>
            <input 
              type="text"
              placeholder="e.g. facebook.com/profile"
              value={facebookLink}
              onChange={e => setFacebookLink(e.target.value)}
              className="w-full border-2 border-border-dark px-3 py-2 text-sm focus:outline-none focus:border-primary"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-bold text-xs text-primary uppercase">3. GCash Account Name</label>
            <input 
              type="text"
              placeholder="e.g. JUAN DELA CRUZ"
              value={gcashName}
              onChange={e => setGcashName(e.target.value)}
              className="w-full border-2 border-border-dark px-3 py-2 text-sm focus:outline-none focus:border-primary uppercase"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-bold text-xs text-primary uppercase">4. GCash Reference Number</label>
            <input 
              type="text"
              placeholder="12-digit reference number"
              value={gcashRef}
              onChange={e => setGcashRef(e.target.value)}
              maxLength={12}
              className="w-full border-2 border-border-dark px-3 py-2 text-sm focus:outline-none focus:border-primary"
              required
            />
            <p className="text-[10px] text-secondary mt-1 leading-tight">
              <strong>Security Notice:</strong> Your 12-digit reference is securely stored and only used to match merchant logs and prevent duplicate payment scams. It is never displayed publicly.
            </p>
          </div>
          <div className="flex gap-2">
            <PrimaryButton type="submit" disabled={isSubmitting} className="flex-1 py-2 text-xs">
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </PrimaryButton>
            <button 
              type="button" 
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 bg-gray-200 border-2 border-border-dark font-bold text-xs uppercase"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
