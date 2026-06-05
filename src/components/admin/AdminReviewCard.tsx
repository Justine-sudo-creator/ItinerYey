'use client';

import React, { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { TripWithPhotos } from '@/app/profile/page';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { approveTrip, unpublishTrip, deleteTrip, approveClaim } from '@/app/admin/actions';

export default function AdminReviewCard({ trip }: { trip: TripWithPhotos }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const heroPhoto = trip.trip_photos?.find(p => p.is_hero) || trip.trip_photos?.[0];
  const photoCount = trip.trip_photos?.length || 0;
  
  const createdDate = new Date(trip.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const handleApproveClaim = () => {
    setError('');
    startTransition(async () => {
      try {
        await approveClaim(trip.id);
      } catch (err: unknown) {
        setError((err as Error).message);
      }
    });
  };

  const handleApprove = () => {
    setError('');
    startTransition(async () => {
      try {
        await approveTrip(trip.id);
      } catch (err: unknown) {
        setError((err as Error).message);
      }
    });
  };

  const handleUnpublish = () => {
    setError('');
    startTransition(async () => {
      try {
        await unpublishTrip(trip.id);
      } catch (err: unknown) {
        setError((err as Error).message);
      }
    });
  };

  const handleDelete = () => {
    setError('');
    startTransition(async () => {
      try {
        await deleteTrip(trip.id);
        setIsDeleting(false);
      } catch (err: unknown) {
        setError((err as Error).message);
      }
    });
  };

  return (
    <div className="bg-white border-4 border-border-dark shadow-hard flex flex-col">
      <div className="flex flex-col md:flex-row">
        {/* Left: Image */}
        <div className="relative w-full md:w-64 h-48 md:h-auto border-b-4 md:border-b-0 md:border-r-4 border-border-dark bg-gray-100 flex-shrink-0">
          {heroPhoto ? (
            <Image src={heroPhoto.photo_url} alt={trip.destination} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-secondary font-bold text-sm bg-[url('/noise.png')]">
              No Photo
            </div>
          )}
          <div className={`absolute top-2 left-2 px-2 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-border-dark shadow-hard ${
            trip.review_status === 'pending_edit' ? 'bg-accent-yellow text-primary' : trip.is_approved ? 'bg-accent-blue text-white' : 'bg-accent-yellow text-primary'
          }`}>
            {trip.review_status === 'pending_edit' ? 'Pending Edit' : trip.is_approved ? 'Published' : 'Pending'}
          </div>
          <div className="absolute bottom-2 right-2 px-2 py-1 bg-surface text-primary border-2 border-border-dark text-[10px] font-bold uppercase shadow-hard">
            {photoCount} Photo{photoCount !== 1 && 's'}
          </div>
        </div>

        {/* Right: Info & Primary Actions */}
        <div className="p-4 flex flex-col flex-grow gap-2 justify-between">
          <div>
            {trip.claim_request_by && (
              <div className="bg-accent-coral/10 border-2 border-accent-coral p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                <div>
                  <span className="text-[10px] font-black uppercase bg-accent-coral text-white px-2 py-0.5 border border-border-dark inline-block mb-1">Pending Claim Request</span>
                  <p className="text-xs font-bold">Proof Link: <a href={trip.claim_proof || '#'} target="_blank" rel="noopener noreferrer" className="text-accent-blue underline font-mono break-all">{trip.claim_proof}</a></p>
                  <p className="text-[10px] font-mono text-secondary">User UUID: {trip.claim_request_by}</p>
                </div>
                <PrimaryButton onClick={handleApproveClaim} disabled={isPending} className="w-full sm:w-auto text-xs py-2 px-4 bg-accent-coral shrink-0">
                  {isPending ? 'Processing...' : 'Approve Claim'}
                </PrimaryButton>
              </div>
            )}
            <div className="flex justify-between items-start gap-4">
              <div>
                <h3 className="font-black text-2xl uppercase tracking-tight leading-none mb-1">{trip.destination}</h3>
                {trip.trip_name && (
                  <p className="text-primary font-bold text-lg mb-1">{trip.trip_name}</p>
                )}
                <p className="text-secondary font-medium text-sm">
                  {trip.destination_region} {trip.origin_region && `• From ${trip.origin_region}`}
                </p>
                {trip.trip_stops && trip.trip_stops.length > 0 && (
                  <p className="text-xs text-muted font-medium italic mt-1">
                    Stops: {trip.trip_stops.map(s => s.stop_name).join(', ')}
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest">Tier</p>
                <p className="font-bold border-2 border-border-dark px-2 py-1 bg-surface">{trip.submission_tier}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <span className="bg-surface border-2 border-border-dark px-2 py-1 text-xs font-bold uppercase tracking-wide">
                ₱{trip.cost_per_person.toLocaleString()}
              </span>
              <span className="bg-surface border-2 border-border-dark px-2 py-1 text-xs font-bold uppercase tracking-wide">
                {trip.trip_duration_label ? `${trip.trip_duration_label} (${trip.duration_days} Day${trip.duration_days > 1 ? 's' : ''})` : `${trip.duration_days} Day${trip.duration_days > 1 ? 's' : ''}`}
              </span>
              <span className="bg-surface border-2 border-border-dark px-2 py-1 text-xs font-bold uppercase tracking-wide">
                Group: {trip.group_size} ({trip.group_type})
              </span>
              <span className="bg-surface border-2 border-border-dark px-2 py-1 text-xs font-bold uppercase tracking-wide">
                {trip.trip_type} • {trip.travel_style}
              </span>
              {trip.trip_duration_label && (
                ((['1–2 hours', '2–3 hours', 'Half-day', 'Whole day', 'Night trip'].includes(trip.trip_duration_label) && trip.duration_days > 1) || 
                (trip.trip_duration_label === 'Overnight' && trip.duration_days === 1) || 
                (trip.trip_duration_label === '2 days' && trip.duration_days !== 2) ||
                (trip.trip_duration_label === '3 days+' && trip.duration_days < 3))
              ) && (
                <span className="bg-accent-coral border-2 border-border-dark px-2 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  Check duration
                </span>
              )}
              {(trip.transport_cost ?? 0) > 0 && !trip.origin_area && !trip.end_area && !trip.route_context && !(trip.detailed_costs?.some((c) => c.category === 'Transport')) && (
                <span className="bg-accent-coral border-2 border-border-dark px-2 py-1 text-xs font-bold uppercase tracking-wide text-primary">
                  Missing route basis
                </span>
              )}

              {trip.trip_days && trip.trip_days.length > 0 && (
                <span className="bg-surface border-2 border-border-dark px-2 py-1 text-xs font-bold uppercase tracking-wide text-secondary">
                  Itinerary: {
                    Object.entries(
                      trip.trip_days.reduce((acc: Record<number, number>, d) => {
                        acc[d.day_number] = (acc[d.day_number] || 0) + 1;
                        return acc;
                      }, {})
                    ).map(([day, count]) => `Day ${day} (${count})`).join(', ')
                  }
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t-2 border-border-dark border-dashed flex flex-col sm:flex-row gap-2 justify-between items-center">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm font-bold uppercase tracking-wide underline hover:text-accent-blue"
            >
              {isExpanded ? 'Hide Details' : 'View Details'}
            </button>
            
            <div className="flex gap-2 w-full sm:w-auto">
              {trip.is_approved ? (
                <>
                  <Link href={`/trip/${trip.id}`} className="flex-1 sm:flex-none">
                    <SecondaryButton className="w-full text-xs py-2 px-3">View Public</SecondaryButton>
                  </Link>
                  <Link href={`/trip/${trip.id}/card`} className="flex-1 sm:flex-none">
                    <SecondaryButton className="w-full text-xs py-2 px-3">Generate Card</SecondaryButton>
                  </Link>
                  <SecondaryButton onClick={handleUnpublish} disabled={isPending} className="flex-1 sm:flex-none text-xs py-2 px-3 border-accent-coral text-accent-coral hover:bg-accent-coral hover:text-white">
                    {isPending ? 'Working...' : 'Unpublish'}
                  </SecondaryButton>
                </>
              ) : (
                <>
                  <PrimaryButton onClick={handleApprove} disabled={isPending} className="flex-1 sm:flex-none text-xs py-2 px-3">
                    {isPending ? 'Working...' : 'Approve'}
                  </PrimaryButton>
                  <Link href={`/trip/${trip.id}/card`} className="flex-1 sm:flex-none">
                    <SecondaryButton className="w-full text-xs py-2 px-3">Preview Card</SecondaryButton>
                  </Link>
                  <SecondaryButton disabled className="flex-1 sm:flex-none text-xs py-2 px-3 opacity-50">
                    Keep Hidden
                  </SecondaryButton>
                </>
              )}
              
              <button 
                onClick={() => setIsDeleting(true)}
                className="px-3 py-2 bg-border-dark text-white font-bold text-xs uppercase tracking-wide border-2 border-border-dark hover:bg-black transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mt-2 bg-accent-coral text-white p-2 text-xs font-bold border-2 border-border-dark">
              Admin action failed: {error}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="p-4 bg-soft-beige border-t-4 border-border-dark flex flex-col gap-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-bold uppercase tracking-widest text-secondary text-xs mb-1">User ID</p>
              <p className="font-mono bg-white border-2 border-border-dark p-1 text-xs break-all">{trip.user_id}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-widest text-secondary text-xs mb-1">Submitted At</p>
              <p className="font-mono bg-white border-2 border-border-dark p-1 text-xs">{createdDate}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-bold uppercase tracking-widest text-secondary text-xs mb-1">Location Details</p>
              <div className="bg-white border-2 border-border-dark p-3 flex flex-col gap-1 text-xs">
                <p><strong>Dest Text:</strong> {trip.destination}</p>
                <p><strong>Dest Region:</strong> {trip.destination_region}</p>
                <p><strong>Origin Region:</strong> {trip.origin_region}</p>
              </div>
            </div>
            <div>
              <p className="font-bold uppercase tracking-widest text-secondary text-xs mb-1">Structured Location Data</p>
              <div className="bg-white border-2 border-border-dark p-3 flex flex-col gap-1 text-xs break-all">
                {trip.destination_place_id ? (
                  <>
                    <p><strong>Place ID:</strong> {trip.destination_place_id}</p>
                    <p><strong>City/Prov:</strong> {trip.destination_city || 'N/A'}, {trip.destination_province || 'N/A'}</p>
                    <p><strong>Lat/Lng:</strong> {trip.destination_lat}, {trip.destination_lng}</p>
                  </>
                ) : (
                  <p className="text-secondary italic">No structured destination data</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="font-bold uppercase tracking-widest text-secondary text-xs mb-1">Trip Summary</p>
            <p className="bg-white border-2 border-border-dark p-3 whitespace-pre-wrap">{trip.trip_summary || 'No summary provided.'}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-bold uppercase tracking-widest text-secondary text-xs mb-1">Local Tip</p>
              <p className="bg-white border-2 border-border-dark p-3 whitespace-pre-wrap">{trip.tip || 'No tip provided.'}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-widest text-secondary text-xs mb-1">Honest Warning</p>
              <p className="bg-white border-2 border-border-dark p-3 whitespace-pre-wrap">{trip.honest_warning || 'No warning provided.'}</p>
            </div>
          </div>

          <div>
            <p className="font-bold uppercase tracking-widest text-secondary text-xs mb-1">Cost Breakdown</p>
            <div className="bg-white border-2 border-border-dark p-3 flex flex-wrap gap-4">
              <span><strong>Transport:</strong> ₱{trip.transport_cost?.toLocaleString() || 0}</span>
              <span><strong>Food:</strong> ₱{trip.food_cost?.toLocaleString() || 0}</span>
              <span><strong>Activities:</strong> ₱{trip.activities_cost?.toLocaleString() || 0}</span>
              <span><strong>Accommodation:</strong> ₱{trip.accommodation_cost?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div className="fixed inset-0 z-[100] bg-primary/80 flex items-center justify-center p-4">
          <div className="bg-surface border-4 border-border-dark shadow-hard max-w-sm w-full p-6">
            <h3 className="text-xl font-black uppercase tracking-tight mb-2">Delete this trip?</h3>
            <p className="text-sm font-medium mb-6">
              This permanently removes the trip record and related saved/itinerary/photo rows. Use Unpublish instead if you only want to remove it from the public feed.
            </p>
            <div className="flex gap-2">
              <button 
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 bg-accent-coral text-white font-bold uppercase tracking-wide border-2 border-border-dark py-2 hover:bg-red-600 disabled:opacity-50"
              >
                {isPending ? 'Deleting...' : 'Delete Permanently'}
              </button>
              <SecondaryButton onClick={() => setIsDeleting(false)} disabled={isPending} className="flex-1 py-2">
                Cancel
              </SecondaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
