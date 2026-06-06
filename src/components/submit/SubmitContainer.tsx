'use client';

import React, { useState, useEffect } from 'react';
import { RetroPanel, SectionHeader } from '@/components/ui/Cards';
import ShareTripForm from './ShareTripForm';
import LocalTipForm from './LocalTipForm';

import { User } from '@/types/supabase';

type SubmitContainerProps = {
  userProfile: Partial<User> | null;
  isAdmin?: boolean;
};

type TabType = 'trip' | 'tip' | 'update';

export default function SubmitContainer({ userProfile, isAdmin = false }: SubmitContainerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('trip');
  const [returnTo, setReturnTo] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Safely parse URL params on client mount to avoid SSR issues
    const params = new URLSearchParams(window.location.search);
    const typeParam = params.get('type');
    const returnToParam = params.get('returnTo');

    if (typeParam === 'trip' || typeParam === 'tip' || typeParam === 'update') {
      setActiveTab(typeParam as TabType);
    }
    if (returnToParam) {
      setReturnTo(returnToParam);
    }
    setIsMounted(true);
  }, []);

  if (!isMounted) return null; // Avoid hydration mismatch

  return (
    <RetroPanel label="Contribute" className="w-full">
      <div className="mb-6">
        <SectionHeader title="Share something useful" />
        <p className="text-secondary font-medium text-sm mt-2">
          Add your own trip to suggest a budget-friendly trip, or local tip to help others plan better.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-8 border-b border-border-dark/10 pb-4">
        <button
          onClick={() => setActiveTab('trip')}
          className={`flex-1 py-3 px-4 font-bold border border-border-dark/15 rounded-md text-sm sm:text-base transition-all shadow-sm ${
            activeTab === 'trip' 
              ? 'bg-primary text-white' 
              : 'bg-surface text-primary hover:bg-soft-beige'
          }`}
        >
          Share a Trip
        </button>
        <button
          onClick={() => setActiveTab('tip')}
          className={`flex-1 py-3 px-4 font-bold border border-border-dark/15 rounded-md text-sm sm:text-base transition-all shadow-sm ${
            activeTab === 'tip' 
              ? 'bg-primary text-white' 
              : 'bg-surface text-primary hover:bg-soft-beige'
          }`}
        >
          Local Tip
        </button>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'trip' && <ShareTripForm returnTo={returnTo} userProfile={userProfile} isAdmin={isAdmin} />}
        {activeTab === 'tip' && <LocalTipForm returnTo={returnTo} userProfile={userProfile} />}
      </div>
    </RetroPanel>
  );
}
