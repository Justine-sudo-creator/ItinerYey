'use client';

import React, { useEffect, useState } from 'react';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { X } from 'lucide-react';

export function AccessBanner() {
  const { profile, loading } = useCurrentUserProfile();
  const [hoursLeft, setHoursLeft] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    const isDismissed = sessionStorage.getItem('access_banner_dismissed') === 'true';
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  useEffect(() => {
    if (profile?.access_expires_at && !profile.has_contributed) {
      const expiresAt = new Date(profile.access_expires_at).getTime();
      const now = new Date().getTime();
      const diffHours = (expiresAt - now) / (1000 * 60 * 60);
      
      if (diffHours > 0) {
        setHoursLeft(diffHours);
      } else {
        setHoursLeft(null);
      }
    } else {
      setHoursLeft(null);
    }
  }, [profile]);

  const handleDismiss = () => {
    sessionStorage.setItem('access_banner_dismissed', 'true');
    setDismissed(true);
  };

  if (loading || hoursLeft === null || dismissed) return null;

  const displayHours = hoursLeft < 1 ? 'less than 1 hour' : `${Math.floor(hoursLeft)} hours`;

  return (
    <div className="w-full bg-accent-yellow border-b-2 border-border-dark py-2 pl-4 pr-12 flex justify-center text-center shadow-hard-sm z-40 relative">
      <p className="text-sm font-bold text-primary tracking-wide">
        You have {displayHours} of full access. Share a trip before it ends to keep it permanently.
      </p>
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-primary hover:text-accent-coral transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="w-4.5 h-4.5" />
      </button>
    </div>
  );
}
