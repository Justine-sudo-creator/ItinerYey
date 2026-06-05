'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';

export function SaveTripButton({ 
  tripId, 
  initialSaved, 
  userId, 
  initialSaveCount = 0,
  tripOwnerId 
}: { 
  tripId: string; 
  initialSaved?: boolean; 
  userId: string | null; 
  initialSaveCount?: number;
  tripOwnerId?: string;
}) {
  const [isSaved, setIsSaved] = useState(initialSaved || false);
  const [saveCount, setSaveCount] = useState(initialSaveCount);
  const [loading, setLoading] = useState(initialSaved === undefined && !!userId);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (initialSaved === undefined && userId) {
      supabase.from('saved_trips').select('trip_id').eq('user_id', userId).eq('trip_id', tripId).single()
        .then(({ data }) => {
          if (data) setIsSaved(true);
          setLoading(false);
        });
    }
  }, [initialSaved, userId, tripId, supabase]);

  useEffect(() => {
    setSaveCount(initialSaveCount);
  }, [initialSaveCount]);

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Stop navigation if inside a Link
    e.stopPropagation();

    if (!userId) {
      router.push(`/login?returnTo=/trip/${tripId}`);
      return;
    }

    setLoading(true);
    try {
      if (isSaved) {
        setIsSaved(false);
        setSaveCount(prev => Math.max(0, prev - 1));
        const { error } = await supabase.from('saved_trips').delete().match({ user_id: userId, trip_id: tripId });
        if (error) throw error;
      } else {
        setIsSaved(true);
        setSaveCount(prev => prev + 1);
        const { error } = await supabase.from('saved_trips').insert({ user_id: userId, trip_id: tripId });
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
              title: 'Trip Liked!',
              message: `${actorName} liked and saved your trip to ${destinationName}!`,
              link: `/trip/${tripId}`
            });

          if (notifErr) {
            console.error('Failed to insert trip save notification:', notifErr);
          }
        }
      }
    } catch (err) {
      console.error('Failed to toggle save', err);
      setIsSaved(!isSaved);
      setSaveCount(isSaved ? saveCount + 1 : Math.max(0, saveCount - 1));
      alert('Failed to save trip. The database is blocking it due to missing permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative group inline-block">
      <button
        onClick={handleToggleSave}
        disabled={loading}
        title={!userId ? 'Log in to save' : isSaved ? 'Unsave Trip' : 'Save Trip'}
        className="p-1.5 transition-transform active:scale-90 flex items-center justify-center rounded-full hover:bg-black/10 gap-1.5"
      >
        <Heart 
          size={20} 
          className={`transition-colors ${isSaved ? "fill-accent-coral text-accent-coral stroke-accent-coral" : "stroke-primary hover:stroke-accent-coral"}`} 
          strokeWidth={isSaved ? 0 : 2} 
        />
        {saveCount > 0 && (
          <span className={`text-[10px] font-bold ${isSaved ? 'text-accent-coral' : 'text-primary'}`}>
            {saveCount}
          </span>
        )}
      </button>

      {/* Hover Tooltip (desktop) */}
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-primary px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 hidden md:block z-10">
        {!userId ? 'Log in to save' : isSaved ? 'Unsave Trip' : 'Save Trip'}
      </span>
    </div>
  );
}
