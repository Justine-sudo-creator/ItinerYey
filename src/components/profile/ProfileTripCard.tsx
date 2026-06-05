import React from 'react';
import Link from 'next/link';
import { TripWithPhotos } from '@/app/profile/page';
import Image from 'next/image';

export default function ProfileTripCard({ 
  trip, 
  onDeleteClick 
}: { 
  trip: TripWithPhotos; 
  onDeleteClick: (trip: TripWithPhotos) => void;
}) {
  const heroPhoto = trip.trip_photos?.find(p => p.is_hero) || trip.trip_photos?.[0];
  const createdDate = new Date(trip.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // According to rules, if pending and trip owner access works, we can link it.
  // TripDetailView allows owner access if the user is logged in.
  return (
    <div className="flex flex-col h-full bg-soft-beige border border-border-dark/15 rounded-lg overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      <Link href={`/trip/${trip.id}`} className="block relative h-32 w-full border-b border-border-dark/15 bg-gray-100">
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
        
        {/* Status Badge */}
        <div className={`absolute top-2 left-2 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-widest border border-border-dark/15 rounded-sm shadow-sm ${
          trip.is_public === false 
            ? 'bg-gray-200 text-secondary' 
            : trip.review_status === 'pending_edit' 
              ? 'bg-accent-yellow text-primary' 
              : trip.is_approved 
                ? 'bg-accent-blue text-white' 
                : 'bg-accent-yellow text-primary'
        }`}>
          {trip.is_public === false ? 'Draft' : trip.review_status === 'pending_edit' ? 'Pending Edit' : trip.is_approved ? 'Approved' : 'Pending'}
        </div>

        {/* Privacy Badge */}
        <div className={`absolute top-2 right-2 px-1.5 py-0.5 sm:px-2 sm:py-1 text-[8px] sm:text-[10px] font-black uppercase tracking-widest border border-border-dark/15 rounded-sm shadow-sm bg-white text-primary hidden sm:flex items-center gap-1`}>
          {trip.is_public !== false ? 'Public' : 'Locker'}
        </div>
      </Link>

      <div className="p-3 flex flex-col flex-grow gap-2">
        <Link href={`/trip/${trip.id}`} className="block">
          <h4 className="font-black text-sm sm:text-base md:text-lg leading-tight line-clamp-1" title={trip.destination}>{trip.destination}</h4>
          <p className="text-[10px] sm:text-xs text-secondary truncate">{trip.destination_region}</p>
        </Link>

        <div className="flex justify-between items-end mt-auto pt-2 border-t border-border-dark/10 border-dashed">
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] font-bold text-secondary uppercase">Tier</span>
            <span className="text-[10px] sm:text-xs font-bold">{trip.submission_tier}</span>
          </div>
          <div className="flex flex-col text-right">
            <span className="text-[9px] sm:text-[10px] font-bold text-secondary uppercase">{trip.is_public === false ? 'Created' : 'Submitted'}</span>
            <span className="text-[10px] sm:text-xs font-bold">{createdDate}</span>
          </div>
        </div>

        {trip.is_approved && trip.trip_duration_label && (
          <div className="flex justify-between items-end pt-1">
            <div className="flex flex-col">
              <span className="text-[9px] sm:text-[10px] font-bold text-secondary uppercase">Duration</span>
              <span className="text-[10px] sm:text-xs font-bold">{trip.trip_duration_label}</span>
            </div>
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <Link 
            href={`/trip/${trip.id}/edit`}
            className="flex-1 text-center text-[9px] sm:text-[10px] uppercase tracking-wide font-bold py-1 px-2 border border-border-dark/15 rounded bg-white hover:bg-accent-yellow transition-colors shadow-sm"
          >
            Edit Trip
          </Link>
          <button 
            onClick={() => onDeleteClick(trip)}
            className="flex-1 text-center text-[9px] sm:text-[10px] uppercase tracking-wide font-bold py-1 px-2 border border-border-dark/15 rounded bg-white text-accent-coral hover:bg-accent-coral hover:text-white transition-colors shadow-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
