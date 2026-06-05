'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { User } from '@/types/supabase';
import { PrimaryButton } from '@/components/ui/Button';
import { Calendar, Users, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, ArrowRight, MessageCircle } from 'lucide-react';

type MyMeetupsProps = {
  hostedMeetups: any[];
  joinedMeetups: any[];
  userProfile: User;
};

export default function MyMeetups({ hostedMeetups, joinedMeetups, userProfile }: MyMeetupsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'hosted' | 'joined'>('hosted');
  const [cancelModalData, setCancelModalData] = useState<{ isOpen: boolean; hostingId: string; originalHostNote: string | null } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'hosting' | 'membership'>('hosting');
  const [cancellationReason, setCancellationReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  const handleOpenCancelModal = (hostingId: string, hostNote: string | null) => {
    setCancelModalData({ isOpen: true, hostingId, originalHostNote: hostNote });
    setCancellationReason('');
  };

  const handleCloseCancelModal = () => {
    setCancelModalData(null);
    setCancellationReason('');
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalData || !cancellationReason.trim()) return;
    setIsSubmittingCancel(true);

    try {
      const reason = cancellationReason.trim();
      
      // Update DB. We try updating cancellation_reason, with fallback to prepending to host_note if column isn't in remote schema yet
      const { error: cancelError } = await supabase
        .from('trip_hosting')
        .update({
          status: 'canceled',
          cancellation_reason: reason
        })
        .eq('id', cancelModalData.hostingId);

      if (cancelError) {
        // Fallback: prepend to host_note
        const fallbackNote = `[CANCELED] Reason: ${reason}${cancelModalData.originalHostNote ? `\n\nOriginal Note: ${cancelModalData.originalHostNote}` : ''}`;
        const { error: fallbackError } = await supabase
          .from('trip_hosting')
          .update({
            status: 'canceled',
            host_note: fallbackNote
          })
          .eq('id', cancelModalData.hostingId);
        
        if (fallbackError) throw fallbackError;
      }

      // Send cancellation notifications to approved members
      try {
        const { data: approvedMembers, error: membersErr } = await supabase
          .from('trip_hosting_members')
          .select('user_id')
          .eq('hosting_id', cancelModalData.hostingId)
          .eq('status', 'approved');

        const { data: hostingRow } = await supabase
          .from('trip_hosting')
          .select('trip_id, host_user_id, trips(destination)')
          .eq('id', cancelModalData.hostingId)
          .single();

        if (!membersErr && approvedMembers && hostingRow) {
          const trip = hostingRow.trips as any;
          const tripDestination = trip?.destination || 'your itinerary';
          const filteredMembers = approvedMembers.filter(m => m.user_id !== hostingRow.host_user_id);
          
          if (filteredMembers.length > 0) {
            const notificationsToInsert = filteredMembers.map(member => ({
              user_id: member.user_id,
              actor_id: hostingRow.host_user_id,
              type: 'meetup_canceled',
              title: `Meetup Canceled: ${tripDestination}`,
              message: `The host has canceled the meetup. Reason: ${reason}`,
              link: `/trip/${hostingRow.trip_id}/meetup/${cancelModalData.hostingId}`
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
        console.error('MyMeetups: Failed to send meetup cancellation notifications:', notifErr);
      }

      handleCloseCancelModal();
      router.refresh();
    } catch (err) {
      alert('Failed to cancel meetup. Please try again.');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleOpenDeleteModal = (id: string, type: 'hosting' | 'membership') => {
    setDeleteConfirmId(id);
    setDeleteType(type);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await fetch('/api/trip/delete-meetup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteConfirmId, type: deleteType })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete item.');
      }

      setDeleteConfirmId(null);
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete item. Please try again.');
    }
  };

  return (
    <div className="bg-soft-beige border-4 border-border-dark shadow-hard p-3 sm:p-6 flex flex-col gap-4 sm:gap-6">
      <div className="flex gap-1.5 sm:gap-2">
        <button
          onClick={() => setActiveSubTab('hosted')}
          className={`flex-1 py-1.5 sm:py-2 font-bold uppercase tracking-wide border-2 border-border-dark text-[10px] sm:text-xs md:text-sm transition-colors ${
            activeSubTab === 'hosted' ? 'bg-accent-blue text-white shadow-hard-sm' : 'bg-white text-secondary'
          }`}
        >
          Hosting Slots ({hostedMeetups.length})
        </button>
        <button
          onClick={() => setActiveSubTab('joined')}
          className={`flex-1 py-1.5 sm:py-2 font-bold uppercase tracking-wide border-2 border-border-dark text-[10px] sm:text-xs md:text-sm transition-colors ${
            activeSubTab === 'joined' ? 'bg-accent-blue text-white shadow-hard-sm' : 'bg-white text-secondary'
          }`}
        >
          Joined Meetups ({joinedMeetups.length})
        </button>
      </div>

      {/* Hosted Meetups Section */}
      {activeSubTab === 'hosted' && (
        <div className="flex flex-col gap-3 sm:gap-4">
          {hostedMeetups.length === 0 ? (
            <div className="p-8 text-center border-2 border-border-dark border-dashed bg-white flex flex-col items-center gap-3">
              <p className="text-secondary font-bold text-xs sm:text-sm italic">You aren't hosting any meetups yet.</p>
              <Link
                href="/meetups"
                className="inline-flex items-center gap-2 border-2 border-border-dark px-3 py-1.5 bg-accent-coral text-white font-black uppercase text-[10px] sm:text-xs shadow-hard-sm hover:translate-y-0.5 transition-transform"
              >
                Host a Meetup
              </Link>
            </div>
          ) : (
            hostedMeetups.map((meetup) => {
              const statusColors: Record<string, string> = {
                open: 'bg-accent-green text-white border-accent-green',
                full: 'bg-primary text-white border-primary',
                canceled: 'bg-accent-coral text-white border-accent-coral',
                archived: 'bg-muted text-white border-muted',
              };

              return (
                <div key={meetup.id} className="p-3 sm:p-4 border-2 border-border-dark bg-white shadow-hard-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.5 border-2 font-black text-[8px] sm:text-[9px] uppercase tracking-wide rounded-sm ${statusColors[meetup.status] || 'bg-white text-primary border-border-dark'}`}>
                        {meetup.status}
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm md:text-base text-primary truncate">
                        Meetup: {meetup.trips?.destination || 'Trip Details'}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs font-bold text-secondary flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        {new Date(meetup.target_date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                        Target: {meetup.slots_needed} pax
                      </span>
                    </div>

                    {(meetup.cancellation_reason || (meetup.status === 'canceled' && meetup.host_note)) && (
                      <p className="mt-1.5 text-[10px] sm:text-xs font-medium text-accent-coral bg-accent-coral/5 p-1.5 border border-accent-coral/20">
                        <span className="font-bold">Cancellation Reason:</span> {meetup.cancellation_reason || meetup.host_note?.replace('[CANCELED] Reason:', '').split('\n\n')[0]}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 sm:self-center shrink-0 flex-wrap sm:flex-nowrap">
                    <Link href={`/trip/${meetup.trip_id}/meetup/${meetup.id}`}>
                      <button className="px-2.5 py-1.5 sm:px-4 sm:py-2 border-2 border-border-dark bg-accent-yellow text-primary font-bold text-[10px] sm:text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform flex items-center gap-1">
                        Manage <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </Link>
                    {meetup.status !== 'canceled' && meetup.status !== 'archived' ? (
                      <button
                        onClick={() => handleOpenCancelModal(meetup.id, meetup.host_note)}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 border-2 border-border-dark bg-white hover:bg-accent-coral/10 text-accent-coral font-bold text-[10px] sm:text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
                      >
                        Cancel
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenDeleteModal(meetup.id, 'hosting')}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 border-2 border-border-dark bg-accent-coral text-white font-bold text-[10px] sm:text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Joined Meetups Section */}
      {activeSubTab === 'joined' && (
        <div className="flex flex-col gap-3 sm:gap-4">
          {joinedMeetups.length === 0 ? (
            <div className="p-8 text-center border-2 border-border-dark border-dashed bg-white flex flex-col items-center gap-3">
              <p className="text-secondary font-bold text-xs sm:text-sm italic">You haven't requested to join any meetups yet.</p>
              <Link
                href="/meetups"
                className="inline-flex items-center gap-2 border-2 border-border-dark px-3 py-1.5 bg-accent-coral text-white font-black uppercase text-[10px] sm:text-xs shadow-hard-sm hover:translate-y-0.5 transition-transform"
              >
                Explore Active Meetups
              </Link>
            </div>
          ) : (
            joinedMeetups.map((join) => {
              const meetup = join.trip_hosting;
              if (!meetup) return null;

              const isApproved = join.status === 'approved';
              const isPending = join.status === 'pending';
              const isCanceled = meetup.status === 'canceled';

              let statusBadge = (
                <span className="px-1.5 py-0.5 border-2 border-accent-yellow bg-accent-yellow/10 text-accent-yellow font-black text-[8px] sm:text-[9px] uppercase tracking-wide rounded-sm">
                  Pending
                </span>
              );

              if (isApproved) {
                statusBadge = (
                  <span className="px-1.5 py-0.5 border-2 border-accent-green bg-accent-green/10 text-accent-green font-black text-[8px] sm:text-[9px] uppercase tracking-wide rounded-sm">
                    Approved
                  </span>
                );
              } else if (join.status === 'rejected') {
                statusBadge = (
                  <span className="px-1.5 py-0.5 border-2 border-accent-coral bg-accent-coral/10 text-accent-coral font-black text-[8px] sm:text-[9px] uppercase tracking-wide rounded-sm">
                    Rejected
                  </span>
                );
              }

              return (
                <div key={join.id} className="p-3 sm:p-4 border-2 border-border-dark bg-white shadow-hard-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {statusBadge}
                      {isCanceled && (
                        <span className="px-1.5 py-0.5 border-2 border-accent-coral bg-accent-coral text-white font-black text-[8px] sm:text-[9px] uppercase tracking-wide rounded-sm flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> Canceled
                        </span>
                      )}
                      <h4 className="font-bold text-xs sm:text-sm md:text-base text-primary truncate">
                        Meetup: {meetup.trips?.destination || 'Trip Destination'}
                      </h4>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs font-bold text-secondary flex-wrap">
                      <span className="text-primary font-black">
                        Host: @{meetup.users?.display_name || 'Traveler'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(meetup.target_date).toLocaleDateString()}
                      </span>
                    </div>

                    {isCanceled && (
                      <p className="mt-1.5 text-[10px] sm:text-xs font-semibold text-accent-coral bg-accent-coral/5 p-1.5 border border-accent-coral/20">
                        <span className="font-black uppercase tracking-wider block text-[9px] mb-0.5">⚠️ Host Cancellation Note:</span>
                        {meetup.cancellation_reason || meetup.host_note?.replace('[CANCELED] Reason:', '').split('\n\n')[0] || 'No reason provided.'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 sm:self-center flex-wrap sm:flex-nowrap">
                    <Link href={`/trip/${meetup.trip_id}/meetup/${meetup.id}`}>
                      <button className="px-2.5 py-1.5 sm:px-4 sm:py-2 border-2 border-border-dark bg-accent-yellow text-primary font-bold text-[10px] sm:text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform flex items-center gap-1">
                        {isApproved && !isCanceled ? 'Enter Board' : 'View Details'} <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </Link>
                    {(isCanceled || join.status === 'rejected') && (
                      <button
                        onClick={() => handleOpenDeleteModal(join.id, 'membership')}
                        className="px-2 py-1.5 sm:px-3 sm:py-2 border-2 border-border-dark bg-accent-coral text-white font-bold text-[10px] sm:text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Cancellation Modal Dialog */}
      {cancelModalData?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-md w-full p-6 relative flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <button
              onClick={handleCloseCancelModal}
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
                className="bg-white border-2 border-border-dark rounded-sm px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue transition-shadow text-sm"
                disabled={isSubmittingCancel}
              />
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={handleConfirmCancel}
                disabled={isSubmittingCancel || !cancellationReason.trim()}
                className="flex-1 py-3 bg-accent-coral text-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all disabled:opacity-50"
              >
                {isSubmittingCancel ? 'Canceling...' : 'Confirm Cancellation'}
              </button>
              <button
                type="button"
                onClick={handleCloseCancelModal}
                disabled={isSubmittingCancel}
                className="flex-1 py-3 bg-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-sm w-full p-6 relative flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-border-dark bg-white flex items-center justify-center font-black hover:bg-accent-coral hover:text-white transition-colors shadow-hard-sm"
            >
              ✕
            </button>
            <h3 className="font-display font-black text-xl border-b-2 border-border-dark pb-2 uppercase">Delete Meetup?</h3>
            <p className="text-sm font-semibold text-secondary leading-normal">
              Are you sure you want to permanently delete this meetup? All chat logs, roster members, and details will be gone forever.
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-accent-coral text-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-2 bg-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
