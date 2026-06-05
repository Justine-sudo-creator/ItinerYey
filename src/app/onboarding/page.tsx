'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RetroPanel, SectionHeader } from '@/components/ui/Cards';
import { SelectInput } from '@/components/ui/Inputs';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { ORIGIN_REGIONS, TRAVEL_STYLES } from '@/lib/constants';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import OrganizerVerificationForm from '@/components/profile/OrganizerVerificationForm';
import { ShieldCheck, ArrowRight, Award } from 'lucide-react';

const BUDGET_OPTIONS = [
  'Under ₱500',
  '₱500-₱1,000',
  '₱1,000-₱2,000',
  '₱2,000-₱5,000',
  '₱5,000+',
];

const COMPANION_OPTIONS = [
  'Solo',
  'Partner',
  'Friends',
  'Family',
  'Mixed',
];

const TRIP_PREFERENCE_OPTIONS = [
  'Beach',
  'Mountain',
  'City',
  'Nature',
  'Mixed',
];

const FREQUENCY_OPTIONS = [
  'Once a year',
  '2-3 times a year',
  'Monthly',
  'Whenever I can',
];

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [step, setStep] = useState(1);
  const [region, setRegion] = useState('');
  const [budget, setBudget] = useState('');
  const [travelStyle, setTravelStyle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [creditAwarded, setCreditAwarded] = useState(false);
  const [alreadyHasCredit, setAlreadyHasCredit] = useState(false);
  
  // UI only state
  const [companion, setCompanion] = useState('');
  const [tripPreference, setTripPreference] = useState('');
  const [frequency, setFrequency] = useState('');

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('display_name, avatar_url, region, travel_style, typical_budget, bio, social_link, completed_profile_credit_awarded')
          .eq('id', user.id)
          .single();
        if (profile) {
          if (profile.display_name) setDisplayName(profile.display_name);
          if (profile.region) setRegion(profile.region);
          if (profile.travel_style) setTravelStyle(profile.travel_style);
          if (profile.typical_budget) setBudget(profile.typical_budget);
          if (profile.avatar_url) setAvatarPreview(profile.avatar_url);
          if (profile.bio) setBio(profile.bio);
          if (profile.completed_profile_credit_awarded) setAlreadyHasCredit(true);
        }
      }
    };
    fetchUser();
  }, [supabase]);

  const handleNextStep = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let finalAvatarUrl = avatarPreview;
      if (avatarFile) {
        const { uploadToCloudinary } = await import('@/utils/cloudinary');
        finalAvatarUrl = await uploadToCloudinary(avatarFile, `avatars/${user.id}`);
      }

      // Check if profile is fully complete
      const isProfileComplete = 
        !!displayName && 
        !!finalAvatarUrl && 
        !!bio && 
        !!region && 
        !!budget && 
        !!travelStyle;

      // Fetch current credits to increment if applicable
      const { data: currentProfile } = await supabase
        .from('users')
        .select('completed_profile_credit_awarded, hosting_credits')
        .eq('id', user.id)
        .single();
      
      const alreadyAwarded = currentProfile?.completed_profile_credit_awarded || false;
      const currentCredits = currentProfile?.hosting_credits || 0;

      let newCredits = currentCredits;
      let shouldAward = false;

      if (isProfileComplete && !alreadyAwarded) {
        newCredits = currentCredits + 1;
        shouldAward = true;
      }

      // Save preferences and profile details
      const { error } = await supabase
        .from('users')
        .update({
          display_name: displayName || null,
          avatar_url: finalAvatarUrl || null,
          bio: bio || null,
          region: region || null,
          typical_budget: budget || null,
          travel_style: travelStyle || null,
          hosting_credits: newCredits,
          completed_profile_credit_awarded: alreadyAwarded || shouldAward
        })
        .eq('id', user.id);

      if (error) throw error;
      
      if (shouldAward) {
        setCreditAwarded(true);
      }
      
      // Redirect directly to home page/feed now
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error saving onboarding preferences:', error);
      alert('Failed to save profile preferences. Redirecting to feed...');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPreferences = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          region: 'Not set',
          typical_budget: 'Not set',
          travel_style: 'Not set'
        })
        .eq('id', user.id);
      
      if (error) throw error;
      setRegion('Not set');
      setBudget('Not set');
      setTravelStyle('Not set');
      
      // Redirect directly to home page/feed now
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Error skipping onboarding preferences:', err);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full pb-10 px-4">
      <RetroPanel label="Welcome! Complete Your Profile" className="w-full max-w-lg mt-6 md:mt-10 animate-in fade-in duration-200">
        <SectionHeader title="Let's get to know you" />
        
        <div className="bg-accent-yellow/10 border-2 border-border-dark p-3.5 mb-6 text-xs font-semibold text-primary flex flex-col gap-1 shadow-hard-sm">
          <span className="font-black text-accent-coral uppercase tracking-wide">Complete Profile Bonus</span>
          Upload a profile pic, write a bio, and complete preferences to earn 1 Free Welcome Hosting Credit to post your first meetup for free!
        </div>

        <div className="flex flex-col gap-5">
          {/* Core Profile Details */}
          <div className="flex flex-col gap-2 p-4 border-2 border-border-dark bg-white shadow-hard-sm">
            <span className="font-black uppercase tracking-wider text-xs border-b-2 border-border-dark pb-1 text-primary">Core Profile Info</span>
            
            <div className="flex flex-col gap-1 mt-2">
              <label className="font-bold text-xs text-primary uppercase">Display Name</label>
              <input 
                type="text"
                placeholder="e.g. JuanTraveler"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="border-2 border-border-dark px-3 py-1.5 text-xs focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-col gap-1 mt-2">
              <label className="font-bold text-xs text-primary uppercase">Profile Picture</label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 bg-soft-beige border-2 border-border-dark rounded-full overflow-hidden flex items-center justify-center font-bold text-xs uppercase">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    '?'
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setAvatarFile(e.target.files[0]);
                      setAvatarPreview(URL.createObjectURL(e.target.files[0]));
                    }
                  }}
                  className="text-xs file:mr-2 file:py-1 file:px-2 file:border file:border-border-dark file:bg-white file:font-bold file:uppercase cursor-pointer w-full"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1 mt-2">
              <label className="font-bold text-xs text-primary uppercase">Short Bio</label>
              <textarea 
                placeholder="e.g. Travel blogger looking for hiking buddies in Benguet!"
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="border-2 border-border-dark px-3 py-1.5 text-xs h-16 resize-none focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <SelectInput 
            label="1. Where are you usually traveling from?" 
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            options={ORIGIN_REGIONS.map(r => ({ value: r, label: r }))}
          />
          
          <SelectInput 
            label="2. Typical travel budget per person (per day)?" 
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            options={BUDGET_OPTIONS.map(o => ({ value: o, label: o }))}
          />

           <SelectInput 
            label="3. How do you usually travel?" 
            value={companion}
            onChange={(e) => setCompanion(e.target.value)}
            options={COMPANION_OPTIONS.map(o => ({ value: o, label: o }))}
          />

          <SelectInput 
            label="4. What is your travel style?" 
            value={travelStyle}
            onChange={(e) => setTravelStyle(e.target.value)}
            options={TRAVEL_STYLES.map(s => ({ value: s, label: s }))}
          />

          <SelectInput 
            label="5. What trips do you enjoy?" 
            value={tripPreference}
            onChange={(e) => setTripPreference(e.target.value)}
            options={TRIP_PREFERENCE_OPTIONS.map(o => ({ value: o, label: o }))}
          />

          <SelectInput 
            label="6. How often do you travel?" 
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            options={FREQUENCY_OPTIONS.map(o => ({ value: o, label: o }))}
          />
        </div>

        <div className="flex gap-4 mt-8 pt-6 border-t-2 border-border-dark">
          <PrimaryButton onClick={handleNextStep} disabled={loading} className="flex-1 flex items-center justify-center gap-2">
            {loading ? 'Saving...' : 'Finish & Go to Feed'} <ArrowRight className="w-4 h-4" />
          </PrimaryButton>
          <SecondaryButton onClick={handleSkipPreferences} disabled={loading} className="flex-1">
            Skip preferences
          </SecondaryButton>
        </div>
      </RetroPanel>
    </div>
  );
}

