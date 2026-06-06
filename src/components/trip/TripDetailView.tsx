'use client';

import React, { useState } from 'react';
import { Trip, TripPhoto, TripDay, Business, TripStop, TripHosting } from '@/types/supabase';
import { RetroPanel, SectionHeader } from '@/components/ui/Cards';
import { Badge } from '@/components/ui/Chips';
import { SaveTripButton } from './SaveTripButton';
import { HelpfulVoteButton } from './HelpfulVoteButton';
import { TripComments } from './TripComments';
import { PrimaryButton } from '@/components/ui/Button';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useCurrentUserProfile } from '@/hooks/useCurrentUserProfile';
import { submitClaimRequest } from '@/app/admin/actions';
import Link from 'next/link';
import { BadgeCheck, MapPin, Map, Mail, Users, AlertCircle, MessageCircle } from 'lucide-react';
import PriceAuditModal from './PriceAuditModal';
import ManageTripAudits from './ManageTripAudits';
import dynamic from 'next/dynamic';

const ByaheMap = dynamic(() => import('./ByaheMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-soft-beige flex items-center justify-center">
      <span className="font-bold text-xs text-secondary uppercase tracking-wider">Loading Map Modules...</span>
    </div>
  )
});

const StopsPinsMap = dynamic(() => import('./StopsPinsMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[340px] bg-soft-beige/50 border-2 border-border-dark rounded-xl flex items-center justify-center">
      <span className="font-bold text-xs text-secondary uppercase tracking-wider">Loading Stops Map...</span>
    </div>
  )
});

type TripDetailViewProps = {
  trip: Trip;
  photos: TripPhoto[];
  days: TripDay[];
  business: Business | null;
  userId: string | null;
  initialHasContributed: boolean;
  initialAccessExpiresAt: string | null;
  initialSaved: boolean;
  isAdmin?: boolean;
  hostings?: (TripHosting & { users?: any; trip_hosting_members?: any[] })[];
  joinedHostingIds?: string[];
};



export function TripDetailView({
  trip,
  photos,
  days,
  business,
  userId,
  initialHasContributed,
  initialAccessExpiresAt,
  initialSaved,
  isAdmin = false,
  hostings = [],
  joinedHostingIds = [],
}: TripDetailViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const { refreshProfile } = useCurrentUserProfile();
  
  const stops = trip.trip_stops || [];

  const [localHostings, setLocalHostings] = useState<(TripHosting & { users?: any; trip_hosting_members?: any[] })[]>(hostings);
  const [updatingHostingId, setUpdatingHostingId] = useState<string | null>(null);
  const [isDiscussionOpen, setIsDiscussionOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // Cancellation Modal States
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelHostingId, setCancelHostingId] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // In-app modal notification state
  const [inAppConfirm, setInAppConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [inAppAlert, setInAppAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  } | null>(null);

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setInAppConfirm({ isOpen: true, title, message, onConfirm });
  };

  const showAlert = (title: string, message: string) => {
    setInAppAlert({ isOpen: true, title, message });
  };

  React.useEffect(() => {
    setLocalHostings(hostings);

    const channel = supabase
      .channel(`trip_hostings_${trip.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_hosting', filter: `trip_id=eq.${trip.id}` },
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            setLocalHostings(prev => prev.map(h => {
              if (h.id === payload.new.id) {
                return { 
                  ...h, 
                  status: payload.new.status,
                  target_date: payload.new.target_date,
                  slots_needed: payload.new.slots_needed,
                  cancellation_reason: payload.new.cancellation_reason
                };
              }
              return h;
            }));
          } else if (payload.eventType === 'INSERT') {
            const { data: userData } = await supabase.from('users').select('*').eq('id', payload.new.host_user_id).single();
            const newHosting = { ...payload.new, users: userData, trip_hosting_members: [] } as any;
            setLocalHostings(prev => [newHosting, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setLocalHostings(prev => prev.filter(h => h.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_hosting_members' },
        async (payload) => {
          const targetHostingId = payload.eventType === 'DELETE' ? payload.old.hosting_id : payload.new.hosting_id;
          
          // Re-fetch approved status list for this hosting_id to update the slots count
          const { data } = await supabase
            .from('trip_hosting_members')
            .select('status')
            .eq('hosting_id', targetHostingId);
            
          setLocalHostings(prev => prev.map(h => {
            if (h.id === targetHostingId) {
              return {
                ...h,
                trip_hosting_members: data || []
              };
            }
            return h;
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trip.id, hostings, supabase]);

  const executeStatusUpdate = async (hostingId: string, newStatus: 'archived' | 'full' | 'canceled', cancellationReason?: string) => {
    setUpdatingHostingId(hostingId);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'canceled' && cancellationReason) {
        updateData.cancellation_reason = cancellationReason;
      }
      
      const { error } = await supabase
        .from('trip_hosting')
        .update(updateData)
        .eq('id', hostingId);

      if (error) throw error;

      if (newStatus === 'canceled') {
        try {
          const { data: approvedMembers, error: membersErr } = await supabase
            .from('trip_hosting_members')
            .select('user_id')
            .eq('hosting_id', hostingId)
            .eq('status', 'approved');

          if (!membersErr && approvedMembers) {
            const filteredMembers = approvedMembers.filter(m => m.user_id !== userId);
            
            if (filteredMembers.length > 0) {
              const notificationsToInsert = filteredMembers.map(member => ({
                user_id: member.user_id,
                actor_id: userId,
                type: 'meetup_canceled',
                title: `Meetup Canceled: ${trip.destination}`,
                message: `The host has canceled the meetup. Reason: ${cancellationReason || 'No reason provided.'}`,
                link: `/trip/${trip.id}/meetup/${hostingId}`
              }));

              const { error: notifErr } = await supabase
                .from('notifications')
                .insert(notificationsToInsert);
              
              if (notifErr) {
                console.error('Failed to send meetup cancellation notifications:', notifErr);
              }
            }
          }
        } catch (notifErr) {
          console.error('TripDetailView: Failed to send meetup cancellation notifications from TripDetailView:', notifErr);
        }
      }
      
      if (newStatus === 'archived' || newStatus === 'canceled') {
        setLocalHostings(prev => prev.filter(h => h.id !== hostingId));
      } else {
        setLocalHostings(prev => prev.map(h => h.id === hostingId ? { ...h, status: newStatus } : h));
      }
      router.refresh();
    } catch (err: any) {
      showAlert('Status Update Failed', err.message || 'Failed to update meetup status.');
    } finally {
      setUpdatingHostingId(null);
    }
  };

  const handleUpdateHostingStatus = (hostingId: string, newStatus: 'archived' | 'full' | 'canceled') => {
    if (newStatus === 'canceled') {
      setCancelHostingId(hostingId);
      setCancellationReason('');
      setIsCancelModalOpen(true);
    } else {
      showConfirm(
        'Confirm Action',
        `Are you sure you want to mark this meetup as full? It will be removed from public listings.`,
        () => executeStatusUpdate(hostingId, newStatus)
      );
    }
  };

  const [hasAccess, setHasAccess] = useState(() => {
    if (!userId) return false;
    if (initialHasContributed) return true;
    if (initialAccessExpiresAt && new Date(initialAccessExpiresAt) > new Date()) return true;
    return false;
  });

  const [unlocking, setUnlocking] = useState(false);
  const [isRemixing, setIsRemixing] = useState(false);
  const [showSuccessRemixToast, setShowSuccessRemixToast] = useState(false);
  const [showPriceAuditModal, setShowPriceAuditModal] = useState(false);

  const handleRemix = async () => {
    if (!userId) {
      router.push(`/signup?returnTo=/trip/${trip.id}`);
      return;
    }

    setIsRemixing(true);
    try {
      const res = await fetch(`/api/trip/${trip.id}/remix`, {
        method: 'POST',
      });

      if (!res.ok) {
        let errMsg = 'Failed to remix trip.';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch {
          // Fallback if the server returned HTML (like a 404 or 500 error page)
          console.error("Server returned non-JSON response:", res.status);
          errMsg = `Server Error (${res.status}): Next.js dev server might need a restart to register the new /api/trip/[id]/remix route.`;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      setShowSuccessRemixToast(true);
      setTimeout(() => {
        router.push(`/trip/${data.newTripId}/edit`);
      }, 1500);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showAlert('Remix Failed', errMsg || 'Something went wrong while remixing.');
      setIsRemixing(false);
    }
  };

  // View count increment skipped for MVP phase as RPC does not exist yet

  const handleIllDoItLater = async () => {
    if (!userId) {
      router.push(`/signup?returnTo=/trip/${trip.id}`);
      return;
    }

    setUnlocking(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);
      
      const { error } = await supabase
        .from('users')
        .update({ access_expires_at: expiresAt.toISOString() })
        .eq('id', userId);

      if (error) throw error;
      
      setHasAccess(true);
      refreshProfile(); // sync the global banner
    } catch (err) {
      console.error('Failed to unlock temporary access', err);
    } finally {
      setUnlocking(false);
    }
  };

  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimProof, setClaimProof] = useState('');
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState('');

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError('');
    if (!userId) {
      router.push(`/signup?returnTo=/trip/${trip.id}`);
      return;
    }
    if (!claimProof.trim()) return;

    setClaimSubmitting(true);
    try {
      await submitClaimRequest(trip.id, claimProof);
      setClaimSuccess(true);
    } catch (err: unknown) {
      console.error('Failed to submit claim request:', err);
      setClaimError((err as Error).message || 'Failed to submit claim request. Please check if server is running and try again.');
    } finally {
      setClaimSubmitting(false);
    }
  };


  const sortedPhotos = [...photos].sort((a, b) => a.display_order - b.display_order);
  const previewPhotos = sortedPhotos.slice(0, 2);
  const displayPhotos = hasAccess ? sortedPhotos : previewPhotos;

  const heroIndex = displayPhotos.findIndex(p => p.is_hero);
  const initialPhotoIndex = heroIndex >= 0 ? heroIndex : 0;
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(initialPhotoIndex);
  
  const groupedDays = days.reduce((acc, day) => {
    if (!acc[day.day_number]) acc[day.day_number] = [];
    acc[day.day_number].push(day);
    return acc;
  }, {} as Record<number, TripDay[]>);

  const isOwner = trip.user_id === userId;
  
  const scoreDetails = {
    hasPhotos: photos.length > 0,
    hasWarning: !!trip.honest_warning,
    hasTip: !!trip.tip,
    hasCostBreakdown: !!(trip.detailed_costs && (trip.detailed_costs as any[]).length > 0) || !!(trip.transport_cost || trip.food_cost || trip.activities_cost || trip.accommodation_cost),
    hasItinerary: Object.keys(groupedDays).length > 0
  };

  const calculatedScore = (
    (scoreDetails.hasPhotos ? 20 : 0) +
    (scoreDetails.hasWarning ? 20 : 0) +
    (scoreDetails.hasTip ? 20 : 0) +
    (scoreDetails.hasCostBreakdown ? 20 : 0) +
    (scoreDetails.hasItinerary ? 20 : 0)
  );

  const formatCost = (val: number | null) => val ? `₱${val.toLocaleString()}` : '₱0';

  const generateGoogleMapsUrl = () => {
    if (!trip.destination) return '#';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.destination)}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-6">
      <button 
        onClick={() => router.push('/')}
        className="self-start text-sm font-bold uppercase tracking-wide hover:text-accent-coral transition-colors"
      >
        ← Back to Feed
      </button>

      {/* Owner Helpfulness Score / Completion Prompts */}
      {isOwner && calculatedScore < 100 && (
        <RetroPanel className="p-4 border-accent-blue bg-accent-blue/5 flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-dark/20 pb-2">
            <div>
              <span className="text-[10px] font-black uppercase bg-accent-blue text-white px-2 py-0.5 border border-border-dark inline-block mb-1">
                Owner Dashboard
              </span>
              <h3 className="font-black text-sm sm:text-base uppercase tracking-tight">Your trip board is {calculatedScore}% complete</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-24 bg-white border border-border-dark h-2.5 rounded-full overflow-hidden">
                <div className="bg-accent-blue h-full" style={{ width: `${calculatedScore}%` }} />
              </div>
              <span className="text-xs font-black">{calculatedScore}%</span>
            </div>
          </div>
          
          <p className="text-xs font-medium text-secondary">
            Travelers find detailed itineraries <strong>3x more useful</strong>! Add missing details to unlock the <strong>Detailed Guide</strong> badge.
          </p>
          
          <div className="flex flex-wrap gap-2 mt-1">
            {!scoreDetails.hasPhotos && (
              <button onClick={() => router.push(`/trip/${trip.id}/edit`)} className="px-2.5 py-1 text-[10px] font-bold uppercase border-2 border-border-dark bg-white shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all">
                + Add Photos
              </button>
            )}
            {!scoreDetails.hasWarning && (
              <button onClick={() => router.push(`/trip/${trip.id}/edit`)} className="px-2.5 py-1 text-[10px] font-bold uppercase border-2 border-border-dark bg-white shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all">
                + Add Honest Warning
              </button>
            )}
            {!scoreDetails.hasTip && (
              <button onClick={() => router.push(`/trip/${trip.id}/edit`)} className="px-2.5 py-1 text-[10px] font-bold uppercase border-2 border-border-dark bg-white shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all">
                + Add Traveler Tip
              </button>
            )}
            {!scoreDetails.hasCostBreakdown && (
              <button onClick={() => router.push(`/trip/${trip.id}/edit`)} className="px-2.5 py-1 text-[10px] font-bold uppercase border-2 border-border-dark bg-white shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all">
                + Add Cost Breakdown
              </button>
            )}
            {!scoreDetails.hasItinerary && (
              <button onClick={() => router.push(`/trip/${trip.id}/edit`)} className="px-2.5 py-1 text-[10px] font-bold uppercase border-2 border-border-dark bg-white shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all">
                + Add Itinerary / Timeline
              </button>
            )}
          </div>
        </RetroPanel>
      )}

      {/* Photo Carousel (IG Story Style) */}
      <div className="w-full relative group bg-soft-beige border-2 border-border-dark shadow-hard overflow-hidden">
        {displayPhotos.length > 0 ? (
          <>
            <div className="w-full relative flex items-center justify-center bg-soft-beige">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={displayPhotos[currentPhotoIndex]?.photo_url} 
                alt={displayPhotos[currentPhotoIndex]?.caption || 'Trip Photo'} 
                className="w-full h-auto max-h-[75vh] object-contain md:object-cover object-center transition-all duration-300" 
              />
              
              {/* Caption Overlay */}
              {displayPhotos[currentPhotoIndex]?.caption && (
                <div className="absolute bottom-0 left-0 right-0 p-4 pt-12 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-white font-medium text-sm md:text-base">{displayPhotos[currentPhotoIndex].caption}</p>
                </div>
              )}

              {/* Tap Zones for Next/Prev */}
              <div 
                className="absolute top-0 left-0 w-1/3 h-full cursor-pointer z-10" 
                onClick={() => setCurrentPhotoIndex((prev) => (prev === 0 ? displayPhotos.length - 1 : prev - 1))}
              />
              <div 
                className="absolute top-0 right-0 w-2/3 h-full cursor-pointer z-10" 
                onClick={() => setCurrentPhotoIndex((prev) => (prev === displayPhotos.length - 1 ? 0 : prev + 1))}
              />
            </div>

            {/* Navigation Arrows (Visible on Desktop/Hover) */}
            {displayPhotos.length > 1 && (
              <>
                <button 
                  onClick={() => setCurrentPhotoIndex((prev) => (prev === 0 ? displayPhotos.length - 1 : prev - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 border-2 border-border-dark flex items-center justify-center font-black hover:bg-accent-yellow transition-colors z-20 md:opacity-0 md:group-hover:opacity-100 pointer-events-none md:pointer-events-auto"
                >
                  ←
                </button>
                <button 
                  onClick={() => setCurrentPhotoIndex((prev) => (prev === displayPhotos.length - 1 ? 0 : prev + 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 border-2 border-border-dark flex items-center justify-center font-black hover:bg-accent-yellow transition-colors z-20 md:opacity-0 md:group-hover:opacity-100 pointer-events-none md:pointer-events-auto"
                >
                  →
                </button>
              </>
            )}

            {/* Progress Bars (IG Story style) */}
            <div className="absolute top-2 left-2 right-2 flex gap-1 z-20">
              {displayPhotos.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1.5 flex-1 rounded-full shadow-sm ${idx === currentPhotoIndex ? 'bg-white' : 'bg-white/40'}`}
                />
              ))}
            </div>

            {/* Photo Counter */}
            <div className="absolute top-5 right-2 bg-black/60 px-2 py-1 text-[10px] font-bold text-white rounded-sm z-20">
              {currentPhotoIndex + 1} / {displayPhotos.length}
            </div>

            {/* Hint for locked photos */}
            {!hasAccess && sortedPhotos.length > 2 && currentPhotoIndex === displayPhotos.length - 1 && (
              <div className="absolute bottom-4 right-4 bg-accent-yellow border-2 border-border-dark px-2 py-1 text-[10px] font-bold z-20">
                +{sortedPhotos.length - 2} more locked
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-soft-beige flex items-center justify-center">
            <p className="text-secondary font-bold font-display">No photo yet.</p>
          </div>
        )}
      </div>

      {/* Destination Title Block */}
      <RetroPanel className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <Link 
              href={`/profile?id=${trip.user_id}`}
              className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity w-fit"
            >
              <div className="w-6 h-6 shrink-0 bg-accent-yellow border border-border-dark rounded-full flex items-center justify-center font-bold text-primary uppercase text-[10px] overflow-hidden">
                {trip.users?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={trip.users.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  (trip.users?.display_name || 'Traveler').charAt(0)
                )}
              </div>
              <p className="text-xs font-bold text-secondary">
                Shared by {trip.users?.display_name ? `@${trip.users.display_name}` : 'Traveler'}
              </p>
            </Link>
            {trip.trip_name && trip.trip_name.trim() !== '' && trip.trip_name.trim().toLowerCase() !== trip.destination.trim().toLowerCase() ? (
              <>
                <h1 className="text-3xl md:text-4xl font-display font-bold text-primary mb-1 leading-tight">
                  {trip.trip_name}
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 text-secondary font-bold text-lg mb-3">
                  <MapPin className="w-5 h-5 text-secondary shrink-0" />
                  <span>{trip.destination}</span>
                  <span className="text-secondary font-bold">· {trip.destination_region}</span>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-3xl md:text-4xl font-display font-bold text-primary mb-2 leading-tight">
                  {trip.destination}
                </h1>
                <p className="text-secondary font-bold text-lg mb-3">{trip.destination_region}</p>
              </>
            )}

            {/* Tags / Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {trip.is_public === false && <Badge label="Locker Draft" variant="warning" />}
              <Badge label={trip.trip_type} variant="info" />
              {trip.travel_style && <Badge label={trip.travel_style} variant="warning" />}
              {trip.submission_tier === 'Detailed Trip' && <Badge label="Detailed Trip" variant="success" />}
            </div>
          </div>
          
          {/* Action Buttons Row - Wrapped and Compact on Mobile */}
          <div className="flex flex-wrap gap-2 items-center w-full md:w-auto mt-3 md:mt-0">
            {hasAccess && trip.is_public !== false && <HelpfulVoteButton tripId={trip.id} initialHelpfulCount={trip.helpful_count || 0} userId={userId} tripOwnerId={trip.user_id} />}
            {hasAccess && trip.is_public !== false && <SaveTripButton tripId={trip.id} initialSaved={initialSaved} userId={userId} initialSaveCount={trip.save_count || 0} tripOwnerId={trip.user_id} />}
            
            {(trip.user_id === userId || isAdmin) && (
              <button 
                onClick={() => router.push(`/trip/${trip.id}/edit`)}
                className={`px-2 py-1.5 text-[10px] md:px-3 md:py-2 md:text-xs font-bold uppercase tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-1 hover:shadow-none transition-all ${trip.is_public === false ? 'bg-primary text-white' : 'bg-accent-yellow'}`}
              >
                {trip.is_public === false ? 'Publish to Feed' : 'Edit Trip'}
              </button>
            )}
            
            {trip.is_public !== false && (
              <button 
                onClick={handleRemix}
                disabled={isRemixing}
                className="px-2 py-1.5 text-[10px] md:px-3 md:py-2 md:text-xs font-bold uppercase tracking-wide border-2 border-border-dark bg-accent-blue text-white shadow-hard-sm hover:translate-y-1 hover:shadow-none disabled:opacity-50 transition-all"
              >
                {isRemixing ? 'Remixing...' : 'Remix Trip'}
              </button>
            )}
            {trip.is_public !== false && trip.is_approved && (
              <button 
                onClick={() => router.push(`/trip/${trip.id}/host`)}
                className={`px-2 py-1.5 text-[10px] md:px-3 md:py-2 md:text-xs font-bold uppercase tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-1 hover:shadow-none transition-all ${
                  localHostings.length > 0
                    ? 'bg-white text-primary hover:bg-soft-beige'
                    : 'bg-accent-coral text-white'
                }`}
              >
                Host a Meetup
              </button>
            )}
            <a 
              href={generateGoogleMapsUrl()} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[10px] md:px-3 md:py-2 md:text-xs font-bold uppercase tracking-wide border-2 border-border-dark bg-accent-blue text-white shadow-hard-sm hover:translate-y-1 hover:shadow-none transition-all"
            >
              <MapPin className="w-4 h-4 shrink-0" /> Open in Google Maps
            </a>
          </div>
        </div>

        {/* Info Strip */}
        <div className="flex flex-wrap gap-x-8 gap-y-4 pt-4 border-t-2 border-border-dark justify-center text-center">
          <div>
            <p className="text-xs font-bold uppercase text-secondary">
              {trip.group_size === 1 && trip.cost_scope !== 'group_total'
                ? 'Solo Spend'
                : trip.cost_scope === 'group_total'
                ? 'Group Total'
                : 'My Share'}
            </p>
            <p className="font-black text-xl sm:text-2xl text-accent-coral">₱{trip.cost_per_person.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-secondary">Duration</p>
            <p className="font-bold text-lg">
              {trip.trip_duration_label ? (
                <>{trip.trip_duration_label} <span className="text-sm font-normal text-secondary ml-1">· {trip.duration_days} day{trip.duration_days !== 1 ? 's' : ''}</span></>
              ) : (
                `${trip.duration_days} Day${trip.duration_days !== 1 ? 's' : ''}`
              )}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-secondary">Group Size</p>
            <p className="font-bold text-lg">{trip.group_size === 1 ? 'Solo' : `${trip.group_size} pax`}</p>
            {trip.group_size > 1 && (
              <span className="text-[10px] font-bold text-secondary block mt-0.5 leading-none">
                {trip.cost_scope === 'group_total' ? 'group total spend' : 'my share of costs'}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-secondary">Origin</p>
            <p className="font-bold text-lg">{trip.origin_city || trip.origin_province || (trip.origin_region ? trip.origin_region.split(',')[0] : 'Unknown')}</p>
          </div>
          {trip.travel_date && (
            <div>
              <p className="text-xs font-bold uppercase text-secondary">Month/Year</p>
              <p className="font-bold text-lg">{trip.travel_date}</p>
            </div>
          )}
        </div>
      </RetroPanel>

      {/* 3. Honest Warning & Tip (Budget traveler's decision support) */}
      {(hasAccess && (trip.honest_warning || trip.tip)) && (
        <div className="flex flex-col md:flex-row gap-6 w-full animate-in fade-in slide-in-from-top-4 duration-200">
          {trip.honest_warning && (
            <RetroPanel className="p-6 border-accent-coral bg-accent-coral/5 flex-1">
              <h3 className="inline-block px-2 py-1 bg-accent-coral text-white border-2 border-border-dark font-bold text-xs uppercase mb-3">Honest Warning</h3>
              <p className="font-semibold text-sm text-primary leading-relaxed">
                {trip.honest_warning}
              </p>
            </RetroPanel>
          )}
          {trip.tip && (
            <RetroPanel className="p-6 border-accent-yellow bg-accent-yellow/5 flex-1">
              <h3 className="inline-block px-2 py-1 bg-accent-yellow border-2 border-border-dark font-bold text-xs uppercase mb-3">Traveler Tip</h3>
              <p className="font-semibold text-sm text-primary italic leading-relaxed">
                &quot;{trip.tip}&quot;
              </p>
            </RetroPanel>
          )}
        </div>
      )}

      {/* Curation & Claim Banner */}
      {trip.is_curated && !trip.claimed_by && (
        <RetroPanel className="p-4 border-accent-coral bg-accent-coral/10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="inline-block px-2 py-1 bg-accent-coral text-primary border-2 border-border-dark font-bold text-sm uppercase mb-2">Curated Trip</h3>
              <p className="text-primary font-medium text-sm">
                This beautiful itinerary was originally shared {trip.attribution_source ? `via ${trip.attribution_source}` : 'online'}.
              </p>
              <p className="text-primary font-bold text-sm mt-1">
                Are you the original author? Claim this trip to get full credit and manage updates!
              </p>
            </div>
            <button
              onClick={() => {
                if (!userId) {
                  router.push(`/signup?returnTo=/trip/${trip.id}`);
                  return;
                }
                setClaimSuccess(false);
                setClaimProof('');
                setShowClaimModal(true);
              }}
              className="px-4 py-2 text-sm font-bold uppercase tracking-wide border-2 border-border-dark bg-white shadow-hard-sm hover:translate-y-1 hover:shadow-none transition-all shrink-0"
            >
              Claim This Trip
            </button>
          </div>
        </RetroPanel>
      )}

      {/* 4. Cost Breakdown & Route Basis */}
      <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
        {/* Cost Breakdown */}
        <div className="flex-grow w-full">
          <RetroPanel className="p-6">
            <h3 className="font-display font-bold text-xl border-b-2 border-border-dark pb-3 mb-4">Cost Breakdown</h3>
            {hasAccess && (
              <div className="mb-4 bg-surface p-3 border-2 border-border-dark flex flex-col gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Route Basis</span>
                
                {trip.origin_area ? (
                  <div className="mt-1">
                    <div className="flex flex-col gap-4 relative border-l-2 border-dashed border-border-dark ml-2 pl-4 py-1">
                      <div className="relative">
                        <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-accent-yellow border-2 border-border-dark z-10"></div>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-wider leading-none mb-1">Start</p>
                        <p className="font-bold text-sm text-primary leading-tight">{trip.origin_area}</p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-accent-blue border-2 border-border-dark z-10"></div>
                        <p className="text-[10px] font-bold text-secondary uppercase tracking-wider leading-none mb-1">Destination</p>
                        <p className="font-bold text-sm text-primary leading-tight">{trip.destination}</p>
                      </div>
                      {trip.end_area && (
                        <div className="relative">
                          <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-accent-coral border-2 border-border-dark z-10"></div>
                          <p className="text-[10px] font-bold text-secondary uppercase tracking-wider leading-none mb-1">End / Return Point</p>
                          <p className="font-bold text-sm text-primary leading-tight">{trip.end_area}</p>
                        </div>
                      )}
                    </div>
                    {trip.route_context && (
                      <p className="text-xs font-medium text-primary mt-3 bg-white/50 p-2 border border-border-dark">
                        <span className="font-bold text-secondary mr-1">Context:</span>
                        {trip.route_context}
                      </p>
                    )}
                    {trip.end_area && (
                      <div className="text-[10px] mt-3 text-secondary italic">Note: End point represents the return destination, which may differ from the starting point.</div>
                    )}
                    {!trip.end_area && (
                      <div className="text-[10px] mt-3 text-secondary italic">Note: Return location not provided. Fare may vary.</div>
                    )}
                  </div>
                ) : trip.route_context ? (
                  <span className="text-sm font-medium leading-tight">{trip.route_context}</span>
                ) : (
                  <span className="text-sm font-medium leading-tight">
                    {trip.detailed_costs?.some((c) => c.category === 'Transport')
                        ? 'Based on submitted transport steps.'
                        : 'Not provided. Fare may vary depending on exact starting point.'}
                  </span>
                )}


              </div>
            )}
            <div className="flex flex-col gap-3">
              {['Transport', 'Accommodation', 'Food', 'Activities'].map((cat, idx) => {
                const specificCosts = trip.detailed_costs?.filter((c) => c.category === cat) || [];
                const totalKey = cat.toLowerCase() === 'activities' ? 'activities_cost' : `${cat.toLowerCase()}_cost`;
                const total = trip[totalKey as keyof Trip] as number | null;
                return (
                  <div key={cat} className={`flex flex-col gap-1 ${idx === 3 ? 'border-b-2 border-border-dark pb-3' : ''}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-secondary">{cat}</span>
                      <span className={`font-bold ${!hasAccess && 'blur-sm select-none opacity-50'}`}>{hasAccess ? formatCost(total) : '₱0,000'}</span>
                    </div>
                    {hasAccess && specificCosts.length > 0 && (
                      <div className="flex flex-col pl-3 border-l-2 border-accent-yellow mt-1 gap-1">
                        {specificCosts.map((c, i: number) => (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="text-secondary truncate pr-2" title={c.label}>{c.label}</span>
                            <span className="font-medium text-secondary shrink-0">₱{(parseInt(c.amount) || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-between items-center pt-1 border-b-2 border-border-dark pb-3">
                <span className="font-bold uppercase tracking-wide">
                  {trip.group_size === 1 && trip.cost_scope !== 'group_total'
                    ? 'Solo Spend'
                    : trip.cost_scope === 'group_total'
                    ? 'Group Total Spend'
                    : 'My Share of Spend'}
                </span>
                <span className="font-bold text-xl text-accent-coral">₱{trip.cost_per_person.toLocaleString()}</span>
              </div>
              <div className="flex justify-end pt-1">
                <button 
                  onClick={() => setShowPriceAuditModal(true)}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-secondary hover:text-accent-coral transition-colors"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Suggest Price Update
                </button>
              </div>
            </div>

            {!hasAccess && (
              <p className="text-xs font-bold text-secondary text-center mt-6 bg-soft-beige p-2 border-2 border-border-dark">
                Full breakdown unlocks after contributing.
              </p>
            )}
          </RetroPanel>
        </div>

        {/* Featured Business */}
        {hasAccess && business && (
          <div className="w-full lg:w-[320px] shrink-0">
            <RetroPanel className="p-0 overflow-hidden border-accent-yellow">
              <div className="bg-accent-yellow px-4 py-2 border-b-2 border-border-dark flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">★ Featured Local Spot</span>
              </div>
              {business.photo_url && (
                <div className="w-full h-32 border-b-2 border-border-dark bg-soft-beige">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={business.photo_url} alt={business.business_name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4 flex flex-col gap-2">
                <h4 className="font-display font-bold text-lg leading-tight">{business.business_name}</h4>
                <div className="flex items-center gap-2 flex-wrap text-xs font-bold text-secondary uppercase">
                  <span>{business.business_type}</span>
                  <span>•</span>
                  <span>{business.price_range}</span>
                </div>
                {business.description && <p className="text-sm font-medium mt-1">{business.description}</p>}
                {business.contact && <p className="text-xs font-bold text-primary mt-2">Contact: {business.contact}</p>}
              </div>
            </RetroPanel>
          </div>
        )}
      </div>

      {/* 5. The Trip narrative + Places Visited & Timeline */}
      <div className="flex flex-col gap-6 w-full">
        {trip.trip_summary && (
          <RetroPanel className="p-6">
            <SectionHeader title="The Trip" />
            <p className="text-primary leading-relaxed whitespace-pre-wrap mt-4">
              {trip.trip_summary}
            </p>
          </RetroPanel>
        )}

        {stops && stops.length > 0 && (
          <div className="bg-soft-beige/30 border border-border-dark/15 rounded-xl shadow-sm p-6 md:p-8 flex flex-col gap-5">
            <SectionHeader title="Places Visited" />

            {/* Map view — only shown when stops have coordinates */}
            <StopsPinsMap stops={stops} />

            {/* Numbered list of stops */}
            <div className="flex flex-col gap-2 mt-1">
              {stops.map((stop, idx) => (
                <div
                  key={stop.id}
                  className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-white/70 border border-border-dark/10 hover:border-border-dark/30 transition-colors"
                >
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-white font-black text-xs flex items-center justify-center border border-white shadow-sm mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-primary leading-tight">{stop.stop_name}</p>
                    {stop.stop_note && (
                      <p className="text-xs text-secondary mt-0.5 leading-snug">{stop.stop_note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Note: StopsPinsMap now auto-geocodes legacy stops natively */}
          </div>
        )}

        {/* Rough Timeline */}
        {hasAccess ? (
          <>
            {Object.keys(groupedDays).length > 0 && (
              <RetroPanel className="p-6">
                <SectionHeader title="Rough Timeline" />
                <div className="mt-6 flex flex-col gap-8">
                  {Object.keys(groupedDays).sort((a,b) => Number(a)-Number(b)).map(dayNum => {
                    const dayInt = Number(dayNum);
                    const dayActivities = groupedDays[dayInt].sort((a, b) => {
                      if (a.display_order !== b.display_order) {
                        return (a.display_order || 0) - (b.display_order || 0);
                      }
                      const order = { 'morning': 1, 'afternoon': 2, 'evening': 3 };
                      return (order[a.time_of_day.toLowerCase() as keyof typeof order] || 4) - (order[b.time_of_day.toLowerCase() as keyof typeof order] || 4);
                    });

                    return (
                      <div key={dayNum} className="flex flex-col gap-4">
                        <h4 className="font-display font-bold text-xl border-b-2 border-border-dark pb-2">Day {dayNum}</h4>
                        <div className="flex flex-col gap-3">
                          {dayActivities.map(act => (
                            <div key={act.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 border-2 border-border-dark bg-soft-beige">
                              <span className="text-xs font-bold uppercase tracking-wider w-24 text-secondary">{act.time_of_day}</span>
                              <span className="flex-1 font-medium">{act.activity}</span>
                              {act.cost !== null && act.cost > 0 && <span className="font-bold text-accent-coral shrink-0">₱{act.cost.toLocaleString()}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </RetroPanel>
            )}
          </>
        ) : (
          <div className="w-full border-2 border-border-dark bg-soft-beige/50 p-8 flex flex-col items-center justify-center text-center gap-4">
            <h3 className="font-display font-bold text-2xl">Unlock the full trip board</h3>
            <p className="text-secondary font-medium max-w-md">
              This trip has the full cost breakdown, complete itinerary, honest warning, and all photos. Share one trip or local tip to unlock full access.
            </p>
            
            <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
              <PrimaryButton onClick={() => router.push(`/submit?type=trip&returnTo=/trip/${trip.id}`)}>Share a Trip</PrimaryButton>
              <button 
                onClick={() => router.push(`/submit?type=tip&returnTo=/trip/${trip.id}`)}
                className="w-full py-3 border-2 border-border-dark bg-surface font-bold uppercase tracking-wide shadow-hard-sm hover:bg-soft-beige transition-all"
              >
                Share a Local Tip
              </button>
              <button 
                onClick={handleIllDoItLater}
                disabled={unlocking}
                className="w-full py-3 mt-2 text-sm font-bold uppercase text-secondary hover:text-primary transition-colors underline underline-offset-4 decoration-2"
              >
                {unlocking ? 'Unlocking...' : 'I\'ll do it later'}
              </button>
            </div>
          </div>
        )}
      </div>



      {/* 7. Active Meetups Section */}
      {localHostings && localHostings.length > 0 && (
        <div className="bg-accent-coral/5 border border-accent-coral/25 rounded-xl shadow-sm p-6 relative">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-accent-coral shrink-0" />
            <h2 className="text-xl font-black uppercase tracking-tight">Active Meetups (Find Buddies)</h2>
          </div>
          <p className="text-xs font-bold text-secondary uppercase tracking-wider mt-2 mb-4">
            Connect with travelers hosting slots for this trip
          </p>
          
          <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg p-3 mb-6">
            <p className="text-xs font-bold text-primary flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-accent-yellow shrink-0" />
              Important: ItinerYey does not process payments. All logistics and fees are handled offline directly with the host.
            </p>
          </div>
          
          {(() => {
            const visibleMeetups = localHostings.filter((host) => {
              if (host.status === 'open') return true;
              return host.host_user_id === userId || isAdmin || joinedHostingIds.includes(host.id);
            });
            const shouldScroll = visibleMeetups.length > 2;

            return (
              <div className={`flex flex-col gap-4 ${shouldScroll ? 'max-h-[380px] overflow-y-auto pr-2' : ''}`}>
                {visibleMeetups.map((host) => {
                  const isApprovedBoost = (() => {
                    if (!host.is_boosted || host.boost_status !== 'approved' || !host.boosted_at) {
                      return false;
                    }
                    const boostedDate = new Date(host.boosted_at).getTime();
                    const eventDate = new Date(host.target_date).getTime();
                    const now = Date.now();
                    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
                    return (now - boostedDate) < sevenDaysMs && now < eventDate;
                  })();
                  const isOwner = host.host_user_id === userId;
                  const isFull = host.status === 'full';
                  return (
                    <div 
                      key={host.id} 
                      className={`p-4 border border-border-dark/15 bg-soft-beige/30 rounded-lg shadow-sm relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isApprovedBoost ? 'border-accent-yellow ring-2 ring-accent-yellow/50 bg-accent-yellow/5' : ''}`}
                    >
                      {isApprovedBoost && (
                        <span className="absolute -top-3 left-4 text-[9px] font-black uppercase bg-accent-yellow text-primary border border-border-dark/15 px-1.5 py-0.5 rounded shadow-sm">
                        FEATURED HOST
                        </span>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 shrink-0 bg-accent-yellow border border-border-dark/15 rounded-full flex items-center justify-center font-bold text-primary uppercase text-xs overflow-hidden">
                            {host.users?.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={host.users.avatar_url} alt="Host Avatar" className="w-full h-full object-cover" />
                            ) : (
                              (host.users?.display_name || 'Traveler').charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-bold text-sm text-primary">
                                Hosted by {host.users?.display_name ? `@${host.users.display_name}` : 'Anonymous Host'}
                              </p>
                              {host.users?.is_verified_organizer && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] bg-accent-blue text-white border border-accent-blue/30 px-1 font-bold rounded">
                                  <BadgeCheck className="w-3 h-3 text-white fill-white/20 shrink-0" />
                                  VERIFIED
                                </span>
                              )}
                              {(host.users?.vouch_count || 0) > 0 && (
                                <span className="inline-flex items-center text-[9px] bg-accent-coral text-white border border-accent-coral/30 px-1 font-bold rounded uppercase tracking-wide">
                                  ★ {host.users.vouch_count} Vouches
                                </span>
                              )}
                              {isFull && (
                                <span className="inline-flex items-center text-[9px] bg-accent-coral text-white border border-accent-coral/30 px-1.5 font-black rounded uppercase">
                                  FULL
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-bold text-secondary">
                              Target Date: {new Date(host.target_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        {host.host_note && (
                          <p className="text-xs font-semibold text-primary bg-white p-2 border border-border-dark/15 rounded mt-1 whitespace-pre-wrap">
                            {host.host_note}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex flex-col md:items-end justify-between gap-2 shrink-0 w-full md:w-auto">
                         <div className="text-xs font-bold text-secondary">
                          Slots Filled: <span className="text-primary font-black text-sm bg-accent-coral/10 border border-accent-coral/30 px-1.5 py-0.5 rounded">
                            {host.trip_hosting_members?.filter((m: any) => m.status === 'approved').length || 0} of {host.slots_needed} spots
                          </span>
                        </div>
                        
                        {isOwner ? (
                          <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2">
                            {!isFull && (
                              <button
                                onClick={() => handleUpdateHostingStatus(host.id, 'full')}
                                disabled={updatingHostingId === host.id}
                                className="flex-1 min-w-[80px] text-center px-2 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide border border-border-dark/15 bg-accent-yellow text-primary rounded shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
                              >
                                Mark Full
                              </button>
                            )}
                            <button
                              onClick={() => handleUpdateHostingStatus(host.id, 'canceled')}
                              disabled={updatingHostingId === host.id}
                              className="flex-1 min-w-[70px] text-center px-2 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide border border-border-dark/15 bg-accent-coral text-white rounded shadow-sm hover:opacity-90 transition-all disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <Link 
                              href={`/trip/${trip.id}/meetup/${host.id}`}
                              className="flex-1 min-w-[70px] text-center px-2 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide border border-border-dark/15 bg-accent-blue text-white rounded shadow-sm hover:opacity-90 transition-all flex items-center justify-center"
                            >
                              Manage
                            </Link>
                          </div>
                        ) : (
                          <Link 
                            href={`/trip/${trip.id}/meetup/${host.id}`}
                            className="w-full md:w-auto text-center px-2 py-1.5 text-[10px] sm:text-xs font-bold uppercase tracking-wide border border-border-dark/15 bg-accent-blue text-white rounded shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2"
                          >
                            <Users className="w-3.5 h-3.5 shrink-0" /> View Meetup
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Manage Trip Audits (Owner Only) */}
      {trip.user_id === userId && (
        <ManageTripAudits tripId={trip.id} />
      )}

      {/* Discussion Board trigger */}
      <RetroPanel className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
        <div className="flex items-center gap-3">
          <MessageCircle className="w-6 h-6 text-accent-blue" />
          <div className="text-left">
            <h3 className="font-bold text-lg uppercase tracking-tight">Discussion Board</h3>
            <p className="text-xs text-secondary font-medium">Join the conversation with other travelers about this trip.</p>
          </div>
        </div>
        <PrimaryButton onClick={() => setIsDiscussionOpen(true)} className="px-6 py-2.5 text-sm shrink-0">
          View Discussion {commentCount > 0 && `(${commentCount})`}
        </PrimaryButton>
      </RetroPanel>

      {/* Discussion Board Modal */}
      {isDiscussionOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-2xl w-full max-h-[85vh] flex flex-col relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsDiscussionOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-border-dark bg-white flex items-center justify-center font-black hover:bg-accent-coral hover:text-white transition-colors z-20 shadow-hard-sm"
            >
              ✕
            </button>
            <div className="overflow-y-auto p-6">
              <TripComments tripId={trip.id} userId={userId} onCountChange={setCommentCount} />
            </div>
          </div>
        </div>
      )}

      {/* Curation Claim Request Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-lg w-full p-6 relative flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowClaimModal(false)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-border-dark flex items-center justify-center font-black hover:bg-accent-coral transition-colors"
            >
              ✕
            </button>

            <div className="border-b-4 border-border-dark pb-3">
              <span className="text-xs font-bold uppercase tracking-wider bg-accent-coral text-primary px-2 py-0.5 border border-border-dark inline-block mb-2">Claim Ownership</span>
              <h2 className="text-2xl font-black uppercase tracking-tight font-display">Is this your itinerary?</h2>
            </div>

            {claimSuccess ? (
              <div className="bg-accent-yellow/10 border-2 border-accent-yellow p-4 text-center flex flex-col items-center gap-3">
                <span className="text-4xl animate-bounce">🎉</span>
                <h3 className="font-bold text-lg">Claim Request Submitted!</h3>
                <p className="text-sm text-secondary font-medium">
                  We have received your proof link. The admin team will verify your ownership and link this trip to your profile within 12-24 hours!
                </p>
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="py-2 px-4 border-2 border-border-dark bg-white font-bold uppercase text-xs tracking-wide shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitClaim} className="flex flex-col gap-4">
                {claimError && (
                  <div className="bg-accent-coral text-white p-3 text-xs font-bold border-2 border-border-dark shadow-hard">
                    Submission failed: {claimError}
                  </div>
                )}
                <p className="text-sm font-medium text-secondary leading-relaxed">
                  To protect content creators, we verify claims manually. Please provide proof of ownership (e.g., a link to your original Facebook post, TikTok profile, or Instagram account).
                </p>

                <div className="flex flex-col gap-1">
                  <label htmlFor="claimProofInput" className="font-bold text-sm text-primary">Link to Original Post or Profile</label>
                  <input
                    id="claimProofInput"
                    type="text"
                    required
                    placeholder="e.g. facebook.com/groups/... or tiktok.com/@username"
                    value={claimProof}
                    onChange={(e) => setClaimProof(e.target.value)}
                    className="bg-surface border-2 border-border-dark rounded-sm px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue transition-shadow text-sm"
                  />
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    type="submit"
                    disabled={claimSubmitting || !claimProof.trim()}
                    className="w-full py-3 border-2 border-border-dark bg-primary text-white font-bold uppercase tracking-wide shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 text-sm"
                  >
                    {claimSubmitting ? 'Submitting...' : 'Submit Claim Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      {showSuccessRemixToast && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-accent-yellow border-4 border-border-dark shadow-hard p-6 max-w-sm w-full text-center flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-black uppercase tracking-tight font-display">Remixed!</h2>
            <p className="text-xs font-bold text-primary leading-normal">
              Copy saved to your private Locker! Redirecting you to your edit board...
            </p>
          </div>
        </div>
      )}

      {/* Custom In-App Confirm Modal */}
      {inAppConfirm && inAppConfirm.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-sm w-full p-6 relative flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <h3 className="font-display font-black text-xl border-b-2 border-border-dark pb-2 uppercase">{inAppConfirm.title}</h3>
            <p className="text-sm font-semibold text-secondary leading-normal">{inAppConfirm.message}</p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => {
                  inAppConfirm.onConfirm();
                  setInAppConfirm(null);
                }}
                className="flex-1 py-2 bg-accent-coral text-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                Yes, Go
              </button>
              <button
                onClick={() => setInAppConfirm(null)}
                className="flex-1 py-2 bg-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom In-App Alert Modal */}
      {inAppAlert && inAppAlert.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-sm w-full p-6 relative flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <h3 className="font-display font-black text-xl border-b-2 border-border-dark pb-2 uppercase">{inAppAlert.title}</h3>
            <p className="text-sm font-semibold text-secondary leading-normal">{inAppAlert.message}</p>
            <button
              onClick={() => setInAppAlert(null)}
              className="py-2 bg-accent-yellow font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all mt-2"
            >
              OK
            </button>
          </div>
        </div>
      )}
      
      {showPriceAuditModal && (
        <PriceAuditModal 
          tripId={trip.id} 
          onClose={() => setShowPriceAuditModal(false)} 
          tripOwnerId={trip.user_id}
          tripDestination={trip.destination}
        />
      )}

      {/* Custom Neobrutalist Cancellation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-md w-full p-6 relative flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => {
                setIsCancelModalOpen(false);
                setCancelHostingId(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-border-dark bg-white flex items-center justify-center font-black hover:bg-accent-coral hover:text-white transition-colors shadow-hard-sm"
            >
              ✕
            </button>

            <div className="border-b-4 border-border-dark pb-3">
              <span className="text-xs font-bold uppercase tracking-wider bg-accent-coral text-white px-2 py-0.5 border border-border-dark inline-block mb-2">Cancel Meetup</span>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-display">Are you sure?</h2>
            </div>

            <p className="text-sm font-semibold text-secondary leading-normal">
              Canceling this meetup will notify all approved members and close the chat board. Please provide a brief explanation to your joiners:
            </p>

            <div className="flex flex-col gap-1">
              <textarea
                required
                rows={3}
                placeholder="e.g. Sudden work conflict, rescheduling to next month, etc."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="bg-white border-2 border-border-dark rounded-sm px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue transition-shadow text-sm font-semibold"
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={async () => {
                  const cleanReason = cancellationReason.trim();
                  if (!cleanReason || !cancelHostingId) return;
                  
                  await executeStatusUpdate(cancelHostingId, 'canceled', cleanReason);
                  setIsCancelModalOpen(false);
                  setCancelHostingId(null);
                }}
                disabled={!cancellationReason.trim()}
                className="flex-1 py-3 bg-accent-coral text-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCancelModalOpen(false);
                  setCancelHostingId(null);
                }}
                className="flex-1 py-3 bg-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all text-primary"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
