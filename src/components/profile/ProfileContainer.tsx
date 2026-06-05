'use client';

import React, { useState } from 'react';
import { User } from '@/types/supabase';
import { TripWithPhotos } from '@/app/profile/page';
import { RetroPanel } from '@/components/ui/Cards';
import ProfileHeader from './ProfileHeader';
import ProfileEditor from './ProfileEditor';
import ContributionStats from './ContributionStats';
import MyContributions from './MyContributions';
import { PrimaryButton } from '@/components/ui/Button';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import OrganizerVerificationForm from './OrganizerVerificationForm';
import MyMeetups from './MyMeetups';
import VouchButton from './VouchButton';
import PhProvincesMap from './PhProvincesMap';
import MapShareCard from './MapShareCard';
import SavedTripsContainer from '@/components/saved/SavedTripsContainer';

type ProfileContainerProps = {
  userProfile: User;
  userTrips: TripWithPhotos[];
  userBadges?: { id: string; badge_name: string; }[];
  isOwnProfile?: boolean;
  hostedMeetups?: any[];
  joinedMeetups?: any[];
  savedTrips?: any[];
};

export default function ProfileContainer({ 
  userProfile, 
  userTrips, 
  userBadges = [], 
  isOwnProfile = true,
  hostedMeetups = [],
  joinedMeetups = [],
  savedTrips = []
}: ProfileContainerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [mainTab, setMainTab] = useState<'contributions' | 'meetups' | 'saved'>('contributions');
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top Row: Profile Info & Stats */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Profile Info & Actions */}
        <div className="w-full lg:w-[300px] xl:w-[340px] shrink-0 flex flex-col gap-4 lg:gap-6">
          <RetroPanel className="w-full flex flex-col justify-start">
            {!isEditing ? (
              <div className="flex flex-col gap-4">
                <ProfileHeader profile={userProfile} badges={userBadges} isOwnProfile={isOwnProfile} userTrips={userTrips} />
                {isOwnProfile && (
                  <div className="flex flex-col gap-2 mt-4">
                    <PrimaryButton onClick={() => setIsEditing(true)} className="py-2.5 text-xs sm:text-sm">Edit Profile</PrimaryButton>
                    <button 
                      onClick={handleSignOut}
                      className="w-full py-2 bg-white border-2 border-border-dark font-bold text-accent-coral text-xs sm:text-sm uppercase tracking-wide hover:bg-accent-coral hover:text-white transition-colors shadow-hard-sm"
                    >
                      Sign Out
                    </button>
                    
                    {!userProfile.is_verified_organizer && (
                      <OrganizerVerificationForm userId={userProfile.id} />
                    )}
                  </div>
                )}
                {!isOwnProfile && (
                  <div className="flex flex-col gap-2 mt-4">
                    <VouchButton targetUserId={userProfile.id} />
                  </div>
                )}
              </div>
            ) : (
              <ProfileEditor 
                profile={userProfile} 
                onCancel={() => setIsEditing(false)} 
                onSuccess={() => {
                  setIsEditing(false);
                  router.refresh();
                }} 
              />
            )}
          </RetroPanel>
        </div>

        {/* Right Column: Stats & Map */}
        <div className="w-full flex-1 flex flex-col gap-6">
          <ContributionStats trips={userTrips} isOwnProfile={isOwnProfile} />
          
          {/* Dynamic Traveler Map Panel */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center border-b-2 border-border-dark pb-2">
              <span className="font-display font-black text-xl uppercase tracking-tight text-primary">Travel Map</span>
            </div>
            <PhProvincesMap trips={userTrips} userProfile={userProfile} />
          </div>
        </div>
      </div>

      {/* Bottom Row: Full-width Contributions, Meetups, Saved Tabs */}
      {isOwnProfile ? (
        <div className="flex flex-col gap-6 w-full">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <button 
              onClick={() => setMainTab('contributions')}
              className={`py-2 sm:py-3 font-bold uppercase tracking-wide border border-border-dark/15 rounded-md shadow-sm transition-all hover:-translate-y-0.5 text-[9px] xs:text-[10px] sm:text-xs md:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 ${
                mainTab === 'contributions' ? 'bg-accent-yellow text-primary' : 'bg-white text-secondary'
              }`}
            >
              <span className="truncate">Trips</span>
            </button>
            <button 
              onClick={() => setMainTab('meetups')}
              className={`py-2 sm:py-3 font-bold uppercase tracking-wide border border-border-dark/15 rounded-md shadow-sm transition-all hover:-translate-y-0.5 text-[9px] xs:text-[10px] sm:text-xs md:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 ${
                mainTab === 'meetups' ? 'bg-accent-yellow text-primary' : 'bg-white text-secondary'
              }`}
            >
              <span className="truncate">Meetups ({hostedMeetups.length + joinedMeetups.length})</span>
            </button>
            <button 
              onClick={() => setMainTab('saved')}
              className={`py-2 sm:py-3 font-bold uppercase tracking-wide border border-border-dark/15 rounded-md shadow-sm transition-all hover:-translate-y-0.5 text-[9px] xs:text-[10px] sm:text-xs md:text-sm flex flex-col sm:flex-row items-center justify-center gap-1 ${
                mainTab === 'saved' ? 'bg-accent-yellow text-primary' : 'bg-white text-secondary'
              }`}
            >
              <span className="truncate">Saved ({savedTrips.length})</span>
            </button>
          </div>
          
          {mainTab === 'contributions' && (
            <MyContributions trips={userTrips} isOwnProfile={isOwnProfile} userProfile={userProfile} />
          )}
          
          {mainTab === 'meetups' && (
            <MyMeetups 
              hostedMeetups={hostedMeetups} 
              joinedMeetups={joinedMeetups} 
              userProfile={userProfile}
            />
          )}

          {mainTab === 'saved' && (
            <div className="animate-in fade-in">
              <SavedTripsContainer 
                initialSavedTrips={savedTrips} 
                currentUserId={userProfile.id}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full">
          <MyContributions trips={userTrips} isOwnProfile={isOwnProfile} userProfile={userProfile} />
        </div>
      )}
    </div>
  );
}
