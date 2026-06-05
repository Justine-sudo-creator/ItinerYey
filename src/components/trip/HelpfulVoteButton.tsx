'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { ThumbsUp } from 'lucide-react';

interface HelpfulVoteButtonProps {
  tripId: string;
  initialHelpfulCount: number;
  userId: string | null;
  tripOwnerId?: string;
}

export function HelpfulVoteButton({ tripId, initialHelpfulCount, userId, tripOwnerId }: HelpfulVoteButtonProps) {
  const [hasVoted, setHasVoted] = useState(false);
  const [helpfulCount, setHelpfulCount] = useState(initialHelpfulCount);
  const [loading, setLoading] = useState(!!userId);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (userId) {
      supabase.from('trip_helpful_votes').select('trip_id').eq('user_id', userId).eq('trip_id', tripId).single()
        .then(({ data }) => {
          if (data) setHasVoted(true);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [userId, tripId, supabase]);

  const handleToggleVote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!userId) {
      router.push(`/login?returnTo=/trip/${tripId}`);
      return;
    }

    setLoading(true);
    try {
      if (hasVoted) {
        // Optimistic update
        setHasVoted(false);
        setHelpfulCount(prev => Math.max(0, prev - 1));
        
        const { error } = await supabase.from('trip_helpful_votes').delete().match({ user_id: userId, trip_id: tripId });
        if (error) throw error;
      } else {
        // Optimistic update
        setHasVoted(true);
        setHelpfulCount(prev => prev + 1);
        
        const { error } = await supabase.from('trip_helpful_votes').insert({ user_id: userId, trip_id: tripId });
        if (error) throw error;

        // Insert notification for the owner of the trip
        if (tripOwnerId && tripOwnerId !== userId) {
          const { data: profile } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', userId)
            .single();

          const actorName = profile?.display_name || 'Someone';

          const { data: trip } = await supabase
            .from('trips')
            .select('destination')
            .eq('id', tripId)
            .single();

          const destinationName = trip?.destination || 'your itinerary';

          const { error: notifErr } = await supabase
            .from('notifications')
            .insert({
              user_id: tripOwnerId,
              actor_id: userId,
              type: 'trip_like',
              title: 'Trip Vouched!',
              message: `${actorName} vouched for your trip to ${destinationName} as helpful!`,
              link: `/trip/${tripId}`
            });

          if (notifErr) {
            console.error('Failed to insert trip vouch notification:', notifErr);
          }
        }
      }
    } catch (err) {
      console.error('Failed to toggle helpful vote', err);
      // Revert optimistic update
      setHasVoted(!hasVoted);
      setHelpfulCount(hasVoted ? helpfulCount + 1 : Math.max(0, helpfulCount - 1));
      alert('Failed to update vote. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggleVote}
      disabled={loading}
      className={`flex items-center gap-1.5 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border-2 transition-all ${
        hasVoted 
          ? 'bg-accent-yellow border-border-dark text-primary shadow-none translate-y-[2px]' 
          : 'bg-white border-border-dark text-secondary hover:bg-soft-beige shadow-hard-sm'
      }`}
    >
      <ThumbsUp size={14} className={hasVoted ? 'fill-primary' : ''} strokeWidth={2.5} />
      <span className="text-xs md:text-sm font-bold">
        {hasVoted ? 'Vouched' : 'Helpful?'}
      </span>
      {helpfulCount > 0 && (
        <span className={`text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded-full ${hasVoted ? 'bg-white/50' : 'bg-soft-beige'}`}>
          {helpfulCount}
        </span>
      )}
    </button>
  );
}
