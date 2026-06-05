'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { BadgeCheck } from 'lucide-react';

export default function VouchButton({ targetUserId }: { targetUserId: string }) {
  const [hasVouched, setHasVouched] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    // Check if user has already vouched (using local storage for MVP, 
    // real app would track vouching history in a DB table to prevent spam)
    const vouchedState = localStorage.getItem(`vouched_${targetUserId}`);
    if (vouchedState === 'true') {
      setHasVouched(true);
    }
    setIsLoading(false);
  }, [targetUserId]);

  const handleVouch = async () => {
    if (hasVouched || isLoading) return;
    setIsLoading(true);

    try {
      // For MVP: We call an RPC function or just update the user record if RLS allows.
      // But typically, users table requires service role to update vouch_count.
      // Let's assume we have an edge function or we can just call the server action.
      // For now we'll fetch current vouch count and increment it.
      // Wait, RLS on users prevents updating other users. We need a server action.
      
      const res = await fetch('/api/vouch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId })
      });
      
      if (res.ok) {
        setHasVouched(true);
        localStorage.setItem(`vouched_${targetUserId}`, 'true');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return null;

  return (
    <button
      onClick={handleVouch}
      disabled={hasVouched}
      className={`w-full py-2 flex items-center justify-center gap-2 border-2 border-border-dark font-bold text-xs uppercase tracking-wide shadow-hard-sm transition-all ${
        hasVouched
          ? 'bg-soft-beige text-secondary shadow-none translate-y-0.5'
          : 'bg-accent-yellow text-primary hover:translate-y-0.5 hover:shadow-none'
      }`}
    >
      <BadgeCheck className="w-4 h-4" />
      {hasVouched ? 'Vouched!' : 'Vouch for this Buddy'}
    </button>
  );
}
