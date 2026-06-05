import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { SavedTripWithDetails } from '@/app/saved/page';
import { createClient } from '@/utils/supabase/client';

type SavedTripCardProps = {
  savedTrip: SavedTripWithDetails;
  currentUserId: string;
  onUnsave: () => void;
};

export default function SavedTripCard({ savedTrip, currentUserId, onUnsave }: SavedTripCardProps) {
  const trip = savedTrip.trips;
  const heroPhoto = trip.trip_photos?.find(p => p.is_hero) || trip.trip_photos?.[0];
  const savedDate = new Date(savedTrip.saved_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const handleRemove = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent link click
    e.stopPropagation();
    
    const supabase = createClient();
    try {
      await supabase.from('saved_trips').delete().match({ user_id: currentUserId, trip_id: trip.id });
      onUnsave();
    } catch (err) {
      console.error('Failed to unsave', err);
    }
  };

  return (
    <Link href={`/trip/${trip.id}`} className="block h-full">
      <div className="flex flex-col h-full bg-soft-beige border border-border-dark/15 rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
        <div className="relative h-40 w-full border-b border-border-dark/15 bg-gray-100">
          {heroPhoto ? (
            <Image
              src={heroPhoto.photo_url}
              alt={trip.destination}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-secondary text-sm font-bold bg-[url('/noise.png')]">
              No Photo
            </div>
          )}
          
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 px-3 py-1 bg-accent-coral text-white font-bold text-xs uppercase tracking-wide border border-border-dark/15 rounded shadow-sm hover:-translate-y-0.5 transition-all z-10"
          >
            Remove
          </button>
        </div>

        <div className="p-4 flex flex-col flex-grow gap-2">
          <div>
            <h4 className="font-black text-xl leading-tight line-clamp-1">{trip.destination}</h4>
            <p className="text-sm text-secondary font-medium">{trip.destination_region}</p>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <span className="bg-white border border-border-dark/15 px-2 py-1 text-xs font-bold uppercase rounded shadow-sm">
              ₱{trip.cost_per_person.toLocaleString()}
            </span>
            <span className="bg-white border border-border-dark/15 px-2 py-1 text-xs font-bold uppercase rounded shadow-sm">
              {trip.duration_days} Day{trip.duration_days > 1 ? 's' : ''}
            </span>
            <span className="bg-white border border-border-dark/15 px-2 py-1 text-xs font-bold uppercase rounded shadow-sm">
              {trip.trip_type}
            </span>
          </div>

          <div className="mt-auto pt-3 border-t border-border-dark/10 border-dashed text-right text-xs text-secondary font-bold uppercase">
            Saved on {savedDate}
          </div>
        </div>
      </div>
    </Link>
  );
}
