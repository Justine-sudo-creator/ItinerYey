'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trip, TripHosting, TripHostingMember, TripHostingMessage, User } from '@/types/supabase';
import { createClient } from '@/utils/supabase/client';
import { RetroPanel, SectionHeader } from '@/components/ui/Cards';
import { PrimaryButton } from '@/components/ui/Button';
import { Users, Mail, Send, CheckCircle, XCircle, Pin, PinOff, Edit2, Trash2, CornerUpLeft, X, MoreHorizontal, AlertTriangle, BadgeCheck } from 'lucide-react';

type MeetupProps = {
  trip: Trip;
  hosting: TripHosting & { users: User };
  members: (TripHostingMember & { users: User })[];
  messages: (TripHostingMessage & { users: User })[];
  currentUserId: string | null;
  isHost: boolean;
};

export default function MeetupPageView({
  trip,
  hosting,
  members: initialMembers,
  messages: initialMessages,
  currentUserId,
  isHost
}: MeetupProps) {
  const [members, setMembers] = useState(initialMembers);
  const [messages, setMessages] = useState(initialMessages);
  const [hostingState, setHostingState] = useState(hosting);
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyTo, setReplyTo] = useState<TripHostingMessage | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editTargetDate, setEditTargetDate] = useState(hosting.target_date);
  const [editSlotsNeeded, setEditSlotsNeeded] = useState(hosting.slots_needed);

  const [isBoostModalOpen, setIsBoostModalOpen] = useState(false);
  const [boostPaymentReference, setBoostPaymentReference] = useState('');
  const [isSubmittingBoost, setIsSubmittingBoost] = useState(false);
  const [previousBoostsCount, setPreviousBoostsCount] = useState<number | null>(null);
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (isHost && currentUserId) {
      supabase
        .from('trip_hosting')
        .select('*', { count: 'exact', head: true })
        .eq('host_user_id', currentUserId)
        .eq('is_boosted', true)
        .then(({ count }) => {
          setPreviousBoostsCount(count || 0);
        });
    }
  }, [isHost, currentUserId, supabase]);

  const isBoostActive = (h: any) => {
    if (!h.is_boosted || h.boost_status !== 'approved' || !h.boosted_at) {
      return false;
    }
    const boostedDate = new Date(h.boosted_at).getTime();
    const eventDate = new Date(h.target_date).getTime();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    return (now - boostedDate) < sevenDaysMs && now < eventDate;
  };

  const getBoostTimeLeft = (h: any) => {
    if (!h.is_boosted || h.boost_status !== 'approved' || !h.boosted_at) {
      return null;
    }
    const boostedDate = new Date(h.boosted_at).getTime();
    const eventDate = new Date(h.target_date).getTime();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    
    const boostExpiry = boostedDate + sevenDaysMs;
    const expiry = Math.min(boostExpiry, eventDate);
    const diffMs = expiry - now;
    if (diffMs <= 0) return null;

    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays > 1) {
      return `${diffDays} days left`;
    }
    const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
    if (diffHours > 1) {
      return `${diffHours} hours left`;
    }
    const diffMins = Math.ceil(diffMs / (60 * 1000));
    return `${diffMins} mins left`;
  };

  const handleBoostSubmit = async () => {
    setIsSubmittingBoost(true);
    const isFreeBoost = hostingState.users?.is_verified_organizer && previousBoostsCount === 0;
    
    if (!isFreeBoost && (!boostPaymentReference || boostPaymentReference.length !== 12)) {
      alert('Please enter a valid 12-digit GCash Reference Number.');
      setIsSubmittingBoost(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('trip_hosting')
        .update({
          is_boosted: true,
          boost_reference: isFreeBoost ? null : boostPaymentReference,
          boost_status: isFreeBoost ? 'approved' : 'pending'
        })
        .eq('id', hostingState.id);

      if (error) throw error;

      setHostingState(prev => ({
        ...prev,
        is_boosted: true,
        boost_status: isFreeBoost ? 'approved' : 'pending',
        boost_reference: isFreeBoost ? null : boostPaymentReference
      }));
      
      setIsBoostModalOpen(false);
      alert(isFreeBoost ? 'Meetup boosted successfully!' : 'Boost payment submitted! Awaiting admin verification.');
    } catch (err: any) {
      alert('Error boosting meetup: ' + err.message);
    } finally {
      setIsSubmittingBoost(false);
    }
  };

  const handleDeleteMeetup = async () => {
    setIsSubmitting(true);
    setDeleteError('');
    try {
      const { error } = await supabase
        .from('trip_hosting')
        .delete()
        .eq('id', hostingState.id);

      if (error) throw error;

      setIsDeleteModalOpen(false);
      router.push('/meetups');
      router.refresh();
    } catch (err: any) {
      setDeleteError(err.message || 'Error deleting meetup.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: 'open' | 'full' | 'canceled') => {
    if (newStatus === 'canceled') {
      setIsCancelModalOpen(true);
      setCancellationReason('');
    } else {
      const { error } = await supabase
        .from('trip_hosting')
        .update({ status: newStatus })
        .eq('id', hosting.id);

      if (!error) {
        setHostingState(prev => ({ ...prev, status: newStatus }));
      } else {
        alert(`Failed to update status to ${newStatus}.`);
      }
    }
  };

  const handleSaveHeaderEdits = async () => {
    try {
      const { error } = await supabase
        .from('trip_hosting')
        .update({
          target_date: editTargetDate,
          slots_needed: editSlotsNeeded
        })
        .eq('id', hosting.id);

      if (!error) {
        setHostingState(prev => ({
          ...prev,
          target_date: editTargetDate,
          slots_needed: editSlotsNeeded
        }));
        setIsEditingHeader(false);
      } else {
        alert('Failed to update meetup details.');
      }
    } catch (err) {
      alert('Error updating meetup details.');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isChatOpen]);

  useEffect(() => {
    const channel = supabase
      .channel(`meetup_${hosting.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_hosting_messages', filter: `hosting_id=eq.${hosting.id}` },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const { data } = await supabase.from('users').select('*').eq('id', payload.new.user_id).single();
            let parentData = null;
            if (payload.new.reply_to_id) {
              const { data: pData } = await supabase.from('trip_hosting_messages').select('content, user_id, users!user_id(display_name)').eq('id', payload.new.reply_to_id).single();
              parentData = pData;
            }
            setMessages(prev => {
              if (prev.find(m => m.id === payload.new.id)) return prev;
              return [...prev, { ...payload.new, users: data, parent: parentData } as any];
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, is_pinned: payload.new.is_pinned, content: payload.new.content } : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trip_hosting', filter: `id=eq.${hosting.id}` },
        (payload) => {
          setHostingState(prev => ({
            ...prev,
            status: payload.new.status,
            cancellation_reason: payload.new.cancellation_reason,
            target_date: payload.new.target_date,
            slots_needed: payload.new.slots_needed
          }));
          setEditTargetDate(payload.new.target_date);
          setEditSlotsNeeded(payload.new.slots_needed);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hosting.id, supabase]);

  const handleTogglePin = async (msgId: string, currentStatus: boolean) => {
    // Optimistic update
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, is_pinned: !currentStatus } : m));
    await supabase.from('trip_hosting_messages').update({ is_pinned: !currentStatus }).eq('id', msgId);
  };

  const handleEditMessage = (msg: TripHostingMessage) => {
    setEditingMessageId(msg.id);
    setEditContent(msg.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId) return;
    if (editContent.trim() !== '') {
      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, content: editContent.trim() } : m));
      await supabase.from('trip_hosting_messages').update({ content: editContent.trim() }).eq('id', editingMessageId);
    }
    setEditingMessageId(null);
    setEditContent('');
  };

  const handleDeleteMessage = async (msgId: string) => {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    await supabase.from('trip_hosting_messages').delete().eq('id', msgId);
  };

  const pinnedMessages = messages.filter(m => m.is_pinned);

  const isApprovedMember = members.some(m => m.user_id === currentUserId && m.status === 'approved');
  const isPendingMember = members.some(m => m.user_id === currentUserId && m.status === 'pending');
  const hasAccess = isHost || isApprovedMember;

  const handleRequestJoin = async () => {
    if (!currentUserId) return;
    setIsSubmitting(true);
    const { data, error } = await supabase
      .from('trip_hosting_members')
      .insert({ hosting_id: hosting.id, user_id: currentUserId, status: 'pending' })
      .select('*, users!inner(*)')
      .single();
    
    if (!error && data) {
      setMembers([...members, data as any]);
      // Notify the host
      await supabase
        .from('notifications')
        .insert({
          user_id: hosting.host_user_id,
          actor_id: currentUserId,
          type: 'meetup_join_request',
          title: `New Join Request: ${trip.destination}`,
          message: `${data.users.display_name} requested to join your meetup.`,
          link: `/trip/${trip.id}/meetup/${hosting.id}`
        });
    }
    setIsSubmitting(false);
  };

  const handleUpdateMember = async (memberId: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('trip_hosting_members')
      .update({ status })
      .eq('id', memberId);
    
    if (!error) {
      setMembers(members.map(m => m.id === memberId ? { ...m, status } : m));
      
      const member = members.find(m => m.id === memberId);
      if (member) {
        await supabase
          .from('notifications')
          .insert({
            user_id: member.user_id,
            actor_id: currentUserId,
            type: status === 'approved' ? 'meetup_join_approved' : 'meetup_join_rejected',
            title: status === 'approved' ? `Approved: ${trip.destination}` : `Declined: ${trip.destination}`,
            message: status === 'approved' 
              ? `You have been approved to join the meetup for ${trip.destination}!` 
              : `Your request to join the meetup for ${trip.destination} was declined.`,
            link: `/trip/${trip.id}/meetup/${hosting.id}`
          });
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId) return;
    setIsSubmitting(true);
    const { data, error } = await supabase
      .from('trip_hosting_messages')
      .insert({ 
        hosting_id: hosting.id, 
        user_id: currentUserId, 
        content: newMessage.trim(),
        reply_to_id: replyTo?.id || null
      })
      .select('*, users!user_id(*), parent:reply_to_id(content, user_id, users!user_id(display_name))')
      .single();
    
    if (!error && data) {
      setMessages([...messages, data as any]);
      setNewMessage('');
      setReplyTo(null);
    }
    setIsSubmitting(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const formatTime = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      {/* Cancellation Warning Banner */}
      {(hostingState.status === 'canceled' || hostingState.status === 'archived') && (
        <div className="p-4 border-4 border-border-dark bg-accent-coral/10 text-accent-coral shadow-hard flex flex-col gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center gap-2 font-black text-lg uppercase tracking-tight">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            {hostingState.status === 'canceled' ? 'Meetup Canceled' : 'Meetup Archived'}
          </div>
          <p className="font-bold text-sm text-secondary">
            {hostingState.status === 'canceled' 
              ? 'This meetup has been canceled by the host.' 
              : 'This meetup has been archived.'}
          </p>
          {(hostingState.cancellation_reason || (hostingState.status === 'canceled' && hostingState.host_note)) && (
            <p className="bg-white border-2 border-border-dark p-3 text-sm font-semibold text-primary mt-1 shadow-hard-sm">
              <span className="font-black uppercase tracking-wider text-xs block text-accent-coral mb-1">Cancellation Reason:</span>
              {hostingState.cancellation_reason || hostingState.host_note?.replace('[CANCELED] Reason:', '').split('\n\n')[0]}
            </p>
          )}
        </div>
      )}

      {/* Header Info */}
      <RetroPanel className="p-6 bg-accent-blue/5 border-accent-blue">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-6 h-6 text-accent-blue" />
          <h1 className="text-2xl font-black uppercase tracking-tight">Meetup: {trip.destination}</h1>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-4 text-sm font-bold border-t-2 border-border-dark/20 pt-4 mt-2">
          <div className="flex flex-col">
            <span className="text-[10px] text-secondary uppercase tracking-wider">Host</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link href={`/profile?id=${hostingState.host_user_id}`} className="break-words hover:underline font-bold text-accent-blue">
                @{hostingState.users.display_name}
              </Link>
              {hostingState.users?.is_verified_organizer && (
                <span title="Verified Organizer" className="flex items-center">
                  <BadgeCheck className="w-4 h-4 text-accent-blue fill-accent-blue/10 shrink-0" />
                </span>
              )}
              {((hostingState.users as any)?.vouch_count || (hostingState.users as any)?.total_vouches || 0) > 0 && (
                <span className="inline-flex items-center text-[9px] bg-accent-coral text-white border border-border-dark px-1 py-0.5 font-bold rounded-sm uppercase tracking-wide">
                  ★ {(hostingState.users as any).vouch_count || (hostingState.users as any).total_vouches} Vouches
                </span>
              )}
            </div>
          </div>
          {isEditingHeader ? (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-secondary uppercase tracking-wider">Target Date</span>
                <input
                  type="date"
                  value={editTargetDate}
                  onChange={(e) => setEditTargetDate(e.target.value)}
                  className="border-2 border-border-dark bg-white px-2 py-0.5 text-xs font-bold focus:outline-none"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-secondary uppercase tracking-wider">Slots Needed</span>
                <input
                  type="number"
                  min={1}
                  value={editSlotsNeeded}
                  onChange={(e) => setEditSlotsNeeded(parseInt(e.target.value) || 1)}
                  className="border-2 border-border-dark bg-white px-2 py-0.5 text-xs font-bold focus:outline-none w-20"
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col">
                <span className="text-[10px] text-secondary uppercase tracking-wider">Target Date</span>
                <span>{new Date(hostingState.target_date).toLocaleDateString()}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-secondary uppercase tracking-wider">Slots</span>
                <span>{members.filter(m => m.status === 'approved').length} / {hostingState.slots_needed}</span>
              </div>
            </>
          )}
          <div className="flex flex-col">
            <span className="text-[10px] text-secondary uppercase tracking-wider">Status</span>
            <span className="uppercase text-accent-coral font-black">{hostingState.status}</span>
          </div>
          {isBoostActive(hostingState) && (
            <div className="flex flex-col">
              <span className="text-[10px] text-secondary uppercase tracking-wider">Boost Status</span>
              <span className="text-[#10B981] font-black uppercase">
                Active ({getBoostTimeLeft(hostingState)})
              </span>
            </div>
          )}
          {hostingState.is_boosted && hostingState.boost_status === 'pending' && (
            <div className="flex flex-col">
              <span className="text-[10px] text-secondary uppercase tracking-wider">Boost Status</span>
              <span className="text-accent-yellow font-black uppercase">Pending Approval</span>
            </div>
          )}
        </div>
        {hostingState.host_note && (
          <p className="mt-4 p-4 bg-white border-2 border-border-dark font-medium text-primary shadow-hard-sm">
            {hostingState.host_note}
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2 flex-wrap border-t-2 border-border-dark/20 pt-4">
          <Link
            href={`/trip/${trip.id}`}
            className="px-4 py-2 border-2 border-border-dark bg-white text-primary font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
          >
            View Trip
          </Link>

          {isHost && !hostingState.is_boosted && hostingState.status !== 'canceled' && hostingState.status !== 'archived' && (
            <button
              onClick={() => setIsBoostModalOpen(true)}
              className="px-4 py-2 border-2 border-border-dark bg-accent-yellow text-primary font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
            >
              Boost Meetup
            </button>
          )}

          {isHost && (
            <>
              {isEditingHeader ? (
                <>
                  <button
                    onClick={handleSaveHeaderEdits}
                    className="px-4 py-2 border-2 border-border-dark bg-accent-green text-white font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setEditTargetDate(hostingState.target_date);
                      setEditSlotsNeeded(hostingState.slots_needed);
                      setIsEditingHeader(false);
                    }}
                    className="px-4 py-2 border-2 border-border-dark bg-white text-primary font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {hostingState.status !== 'canceled' && hostingState.status !== 'archived' && (
                    <button
                      onClick={() => setIsEditingHeader(true)}
                      className="px-4 py-2 border-2 border-border-dark bg-white text-primary font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
                    >
                      Edit Details
                    </button>
                  )}
                  {hostingState.status === 'open' ? (
                    <button
                      onClick={() => handleUpdateStatus('full')}
                      className="px-4 py-2 border-2 border-border-dark bg-accent-yellow text-primary font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
                    >
                      Mark Full
                    </button>
                  ) : (
                    hostingState.status === 'full' && (
                      <button
                        onClick={() => handleUpdateStatus('open')}
                        className="px-4 py-2 border-2 border-border-dark bg-accent-green text-white font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
                      >
                        Open Meetup
                      </button>
                    )
                  )}
                  {hostingState.status !== 'canceled' && hostingState.status !== 'archived' ? (
                    <button
                      onClick={() => handleUpdateStatus('canceled')}
                      className="px-4 py-2 border-2 border-border-dark bg-accent-coral text-white font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
                    >
                      Cancel Meetup
                    </button>
                  ) : (
                    hostingState.status === 'canceled' && (
                      <button
                        onClick={() => {
                          setDeleteError('');
                          setIsDeleteModalOpen(true);
                        }}
                        className="px-4 py-2 border-2 border-border-dark bg-accent-coral text-white font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-transform"
                      >
                        Delete Meetup
                      </button>
                    )
                  )}
                </>
              )}
            </>
          )}
        </div>
      </RetroPanel>

      {/* Action Area for Non-Hosts */}
      {!isHost && !hasAccess && (
        <RetroPanel className="p-6 text-center flex flex-col items-center gap-4">
          <h3 className="font-black text-lg uppercase tracking-wide">Join this Meetup</h3>
          <p className="text-secondary text-sm">Request to join this meetup to get access to the coordination board.</p>
          {isPendingMember ? (
            <div className="px-6 py-3 border-2 border-border-dark bg-accent-yellow font-bold uppercase shadow-hard-sm">
              Request Pending Approval
            </div>
          ) : (
            <PrimaryButton onClick={handleRequestJoin} disabled={isSubmitting || hosting.status !== 'open'} className="px-8 py-3">
              Request to Join
            </PrimaryButton>
          )}
        </RetroPanel>
      )}

      {/* Roster Area for Host */}
      {isHost && (
        <RetroPanel className="p-6">
          <SectionHeader title="Meetup Roster" />
          <div className="flex flex-col gap-3 mt-4">
            {members.length === 0 ? (
              <p className="text-secondary italic font-bold">No requests yet.</p>
            ) : (
              members.map(member => (
                <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border-2 border-border-dark bg-white shadow-hard-sm">
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                    <div className="w-8 h-8 bg-accent-blue text-white rounded-full flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-border-dark/20">
                      {member.users.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.users.avatar_url} alt={member.users.display_name || 'Avatar'} className="w-full h-full object-cover" />
                      ) : (
                        (member.users.display_name || '?').charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/profile?id=${member.user_id}`} className="font-bold text-sm truncate hover:underline block">
                        @{member.users.display_name}
                      </Link>
                      <p className="text-xs text-secondary font-bold uppercase">{member.status}</p>
                    </div>
                  </div>
                  {member.status === 'pending' && (
                    <div className="flex gap-2 justify-end sm:justify-start shrink-0">
                      <button onClick={() => handleUpdateMember(member.id, 'approved')} className="p-2 border-2 border-border-dark bg-accent-green text-white hover:translate-y-0.5 transition-transform shadow-hard-sm">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleUpdateMember(member.id, 'rejected')} className="p-2 border-2 border-border-dark bg-accent-coral text-white hover:translate-y-0.5 transition-transform shadow-hard-sm">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </RetroPanel>
      )}

      {/* Coordination Board */}
      {hasAccess && (
        <RetroPanel className="p-6">
          <SectionHeader title="Coordination Board" />
          
          {/* Pinned Announcements */}
          {pinnedMessages.length > 0 && (
            <div className="mb-4 mt-4 p-4 border-2 border-border-dark bg-accent-yellow/20 shadow-hard-sm">
              <div className="flex items-center gap-2 mb-2 text-accent-coral font-black uppercase text-xs tracking-wider">
                <Pin className="w-4 h-4" /> Pinned Announcements
              </div>
              <div className="flex flex-col gap-2">
                {pinnedMessages.map(msg => (
                  <div key={`pin-${msg.id}`} className="bg-white p-2 border-2 border-border-dark text-sm whitespace-pre-wrap flex justify-between items-start group">
                    <div>
                      <Link href={`/profile?id=${msg.user_id}`} className="font-bold text-[10px] text-secondary uppercase block mb-1 hover:underline">
                        @{msg.users?.display_name}
                      </Link>
                      {msg.content}
                    </div>
                    {isHost && (
                      <button onClick={() => handleTogglePin(msg.id, msg.is_pinned)} className="p-1 text-secondary hover:text-accent-coral opacity-0 group-hover:opacity-100 transition-opacity" title="Unpin message">
                        <PinOff className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 mt-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-2 border-border-dark bg-white shadow-hard-sm">
              <div className="text-left">
                <p className="text-sm font-bold text-primary">Chat Room</p>
                <p className="text-xs text-secondary font-medium">Discuss trip coordination, logistics, and planning in real-time with other members.</p>
              </div>
              <PrimaryButton onClick={() => setIsChatOpen(true)} className="px-6 py-2.5 text-xs uppercase tracking-wider shrink-0 flex items-center gap-2">
                <Send className="w-3.5 h-3.5" /> Open Chat Room {messages.length > 0 && `(${messages.length})`}
              </PrimaryButton>
            </div>
          </div>

          {/* Coordination Chat Modal */}
          {isChatOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
              <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-2xl w-full max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="p-4 border-b-2 border-border-dark flex items-center justify-between bg-accent-blue/10">
                  <div className="flex items-center gap-2 font-display font-black text-lg uppercase tracking-tight">
                    <Users className="w-5 h-5 text-accent-blue" />
                    Coordination Chat
                  </div>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="w-8 h-8 border-2 border-border-dark bg-white flex items-center justify-center font-black hover:bg-accent-coral hover:text-white transition-colors shadow-hard-sm"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Body (Chat container) */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col min-h-0 bg-soft-beige">
                  <div className="flex flex-col flex-1 min-h-[300px] max-h-[50vh] overflow-y-auto mb-4 p-4 bg-white border-2 border-border-dark border-dashed scroll-smooth custom-scrollbar">
                    {messages.length === 0 ? (
                      <p className="text-center text-secondary italic font-bold my-auto">No messages yet. Say hi!</p>
                    ) : (
                      messages.map((msg, index) => {
                        const isMe = msg.user_id === currentUserId;
                        const prevMsg = index > 0 ? messages[index - 1] : null;
                        const isConsecutive = prevMsg && 
                          msg.user_id === prevMsg.user_id && 
                          (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000);
                        const showActions = activeMessageId === msg.id;

                        return (
                          <div 
                            key={msg.id} 
                            className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group ${isConsecutive ? 'mt-1' : 'mt-4'}`}
                            onClick={() => setActiveMessageId(activeMessageId === msg.id ? null : msg.id)}
                          >
                            {!isConsecutive && (
                              <div className={`flex items-center gap-2 mb-0.5 ${isMe ? 'flex-row-reverse' : 'flex-row pl-9'}`}>
                                {isMe ? (
                                  <span className="text-[10px] font-bold text-secondary">
                                    You
                                  </span>
                                ) : (
                                  <Link href={`/profile?id=${msg.user_id}`} className="text-[10px] font-bold text-secondary hover:underline">
                                    @{msg.users?.display_name}
                                  </Link>
                                )}
                                <span className="text-[9px] text-secondary/50 font-semibold uppercase">
                                  {formatTime(msg.created_at)}
                                </span>
                              </div>
                            )}
                            
                            <div className={`flex items-start gap-2 max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                              {!isMe && (
                                !isConsecutive ? (
                                  <Link href={`/profile?id=${msg.user_id}`} className="w-7 h-7 bg-accent-blue text-white rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 overflow-hidden border border-border-dark/10 hover:opacity-85 transition-opacity">
                                    {msg.users?.avatar_url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={msg.users.avatar_url} alt={msg.users.display_name || 'Avatar'} className="w-full h-full object-cover" />
                                    ) : (
                                      (msg.users?.display_name || '?').charAt(0).toUpperCase()
                                    )}
                                  </Link>
                                ) : (
                                  <div className="w-7 shrink-0" />
                                )
                              )}
                              
                              <div className={`p-2.5 rounded-2xl cursor-pointer ${isMe ? 'bg-accent-blue text-white rounded-tr-sm' : 'bg-white border border-border-dark/20 text-primary shadow-sm rounded-tl-sm'}`}>
                                {msg.parent && (
                                  <div className={`mb-1.5 pl-2 border-l-2 text-[10px] leading-tight ${isMe ? 'border-white/50 text-white/80' : 'border-border-dark/50 text-secondary'}`}>
                                    {msg.parent.user_id ? (
                                      <Link href={`/profile?id=${msg.parent.user_id}`} className="font-bold hover:underline block">
                                        @{msg.parent.users?.display_name || 'Traveler'}
                                      </Link>
                                    ) : (
                                      <span className="font-bold">@{msg.parent.users?.display_name || 'Traveler'}</span>
                                    )}
                                    <p className="truncate opacity-80">{msg.parent.content}</p>
                                  </div>
                                )}
                                {editingMessageId === msg.id ? (
                                  <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                                    <textarea
                                      value={editContent}
                                      onChange={(e) => setEditContent(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                          e.preventDefault();
                                          handleSaveEdit();
                                        }
                                      }}
                                      className={`w-full text-sm bg-transparent border-b-2 focus:outline-none resize-none ${isMe ? 'border-white/50 focus:border-white text-white' : 'border-border-dark/30 focus:border-primary text-primary'}`}
                                      autoFocus
                                      rows={2}
                                    />
                                    <div className="flex justify-end gap-2">
                                      <button onClick={() => setEditingMessageId(null)} className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-white/80 hover:text-white' : 'text-secondary hover:text-primary'}`}>Cancel</button>
                                      <button onClick={handleSaveEdit} className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-white hover:text-accent-yellow' : 'text-primary hover:text-accent-blue'}`}>Save</button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                )}
                              </div>

                              <div className={`flex items-center gap-1 transition-opacity duration-150 ${showActions ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100 pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto'}`} onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} className="p-1 text-secondary hover:text-accent-blue transition-colors" title="Reply">
                                  <CornerUpLeft className="w-3.5 h-3.5" />
                                </button>
                                
                                {(isMe || isHost) && (
                                  <div className="relative">
                                    <button 
                                      onClick={() => setOpenMenuId(openMenuId === msg.id ? null : msg.id)}
                                      className="p-1 text-secondary hover:text-primary transition-colors"
                                    >
                                      <MoreHorizontal className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    {openMenuId === msg.id && (
                                      <div className={`absolute bottom-full mb-1 w-32 bg-white border border-border-dark/20 shadow-md z-20 flex flex-col rounded-md overflow-hidden ${isMe ? 'right-0' : 'left-0'}`}>
                                        {isHost && (
                                          <button onClick={() => { handleTogglePin(msg.id, msg.is_pinned); setOpenMenuId(null); }} className="px-3 py-2 text-xs font-bold text-left hover:bg-soft-beige flex items-center gap-2 text-secondary">
                                            {msg.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                                            {msg.is_pinned ? 'Unpin' : 'Pin'}
                                          </button>
                                        )}
                                        {isMe && (
                                          <button onClick={() => { handleEditMessage(msg); setOpenMenuId(null); }} className="px-3 py-2 text-xs font-bold text-left hover:bg-soft-beige flex items-center gap-2 text-accent-blue">
                                            <Edit2 className="w-3 h-3" />
                                            Edit
                                          </button>
                                        )}
                                        {(isMe || isHost) && (
                                          <button onClick={() => { handleDeleteMessage(msg.id); setOpenMenuId(null); }} className="px-3 py-2 text-xs font-bold text-left hover:bg-soft-beige flex items-center gap-2 text-accent-coral">
                                            <Trash2 className="w-3 h-3" />
                                            Delete
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
                    {replyTo && (
                      <div className="flex items-center justify-between p-2 bg-accent-blue/10 border-2 border-border-dark border-dashed">
                        <div className="flex items-center gap-2 text-xs truncate">
                          <CornerUpLeft className="w-3 h-3 text-secondary shrink-0" />
                          <span className="font-bold text-primary">Replying to @{replyTo.users?.display_name}:</span>
                          <span className="text-secondary truncate">{replyTo.content}</span>
                        </div>
                        <button type="button" onClick={() => setReplyTo(null)} className="p-1 text-secondary hover:text-accent-coral shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 min-w-0 border-2 border-border-dark px-4 py-2 text-sm bg-white focus:outline-none focus:border-primary"
                        disabled={isSubmitting}
                      />
                      <PrimaryButton type="submit" disabled={isSubmitting || !newMessage.trim()} className="px-6 shrink-0 flex items-center justify-center">
                        <Send className="w-4 h-4" />
                      </PrimaryButton>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {!isHost && hosting.contact_link && (
             <div className="mt-4 flex flex-col items-center gap-2">
                <p className="text-xs font-bold text-secondary uppercase">Or connect via social:</p>
                <a href={hosting.contact_link.startsWith('http') ? hosting.contact_link : `https://${hosting.contact_link}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 border-2 border-border-dark bg-white font-bold text-xs uppercase shadow-hard-sm">
                  <Mail className="w-4 h-4" /> Direct Host Link
                </a>
             </div>
          )}
        </RetroPanel>
      )}

      {/* Custom Neobrutalist Cancellation Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-md w-full p-6 relative flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => setIsCancelModalOpen(false)}
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
                  if (!cleanReason) return;
                  
                  const { error } = await supabase
                    .from('trip_hosting')
                    .update({ status: 'canceled', cancellation_reason: cleanReason })
                    .eq('id', hosting.id);

                  if (!error) {
                    setHostingState(prev => ({ ...prev, status: 'canceled', cancellation_reason: cleanReason }));
                    setIsCancelModalOpen(false);

                    // Send cancellation notification to all approved members
                    const approvedMembers = members.filter(m => m.status === 'approved' && m.user_id !== currentUserId);
                    
                    if (approvedMembers.length > 0) {
                      const notificationsToInsert = approvedMembers.map(member => ({
                        user_id: member.user_id,
                        actor_id: currentUserId,
                        type: 'meetup_canceled',
                        title: `Meetup Canceled: ${trip.destination}`,
                        message: `The host has canceled the meetup. Reason: ${cleanReason}`,
                        link: `/trip/${trip.id}/meetup/${hosting.id}`
                      }));

                      const { error: notifErr } = await supabase
                        .from('notifications')
                        .insert(notificationsToInsert);
                      
                      if (notifErr) {
                        console.error('Failed to send meetup cancellation notifications:', notifErr);
                      }
                    }
                  } else {
                    alert('Failed to cancel meetup: ' + error.message);
                  }
                }}
                disabled={!cancellationReason.trim()}
                className="flex-1 py-3 bg-accent-coral text-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="flex-1 py-3 bg-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all text-primary"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Neobrutalist Boost Modal */}
      {isBoostModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-md w-full max-h-[90vh] overflow-y-auto p-6 relative flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => setIsBoostModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-border-dark bg-white flex items-center justify-center font-black hover:bg-accent-coral hover:text-white transition-colors shadow-hard-sm"
            >
              ✕
            </button>

            <div className="border-b-4 border-border-dark pb-3">
              <span className="text-xs font-bold uppercase tracking-wider bg-accent-yellow text-primary px-2 py-0.5 border border-border-dark inline-block mb-2">Boost Meetup</span>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-display">Boost Your Meetup</h2>
            </div>

            {hostingState.users?.is_verified_organizer && previousBoostsCount === 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-secondary">
                  As a Verified Organizer, your first boost is 100% free! This pins your meetup to the top of the feed to help you find travel buddies faster. Boost lasts for up to 7 days (or until the meetup date).
                </p>
                <button
                  onClick={handleBoostSubmit}
                  disabled={isSubmittingBoost}
                  className="w-full py-3 bg-accent-green text-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all disabled:opacity-50"
                >
                  {isSubmittingBoost ? 'Boosting...' : 'Activate Free Boost Now'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm font-semibold text-secondary leading-normal">
                  Highlight and pin your meetup to the top of the feed to find buddies faster for just ₱30. Boost lasts for up to 7 days (or until the meetup date).
                </p>
                <div className="flex flex-col gap-2 p-4 border-2 border-accent-yellow bg-accent-yellow/10">
                  <span className="font-black uppercase text-xs text-primary tracking-wide">Payment Instructions (₱30)</span>
                  <p className="text-xs font-medium text-secondary">
                    Pay the ₱30 fee to GCash 0967-463-8941:
                  </p>
                  <div className="mt-2 flex flex-col items-center gap-2">
                    <div 
                      style={{ width: '120px', height: '160px' }}
                      className="border-2 border-border-dark bg-white shrink-0 flex items-center justify-center p-1"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/gcash_qr_code.png" alt="GCash QR Code" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-[10px] font-bold text-primary mt-1">
                      Scan QR to pay ₱30 to JU****E M.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-xs text-primary uppercase">GCash Reference Number (12 digits)</label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    placeholder="e.g. 501234567890"
                    value={boostPaymentReference}
                    onChange={(e) => setBoostPaymentReference(e.target.value.replace(/\D/g, ''))}
                    className="bg-white border-2 border-border-dark rounded-sm px-3 py-2 text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue transition-shadow text-sm font-semibold"
                  />
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={handleBoostSubmit}
                    disabled={isSubmittingBoost || boostPaymentReference.length !== 12}
                    className="flex-1 py-3 bg-accent-green text-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    {isSubmittingBoost ? 'Submitting...' : 'Submit Payment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBoostModalOpen(false)}
                    className="flex-1 py-3 bg-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all text-primary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Neobrutalist Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-soft-beige border-4 border-border-dark shadow-hard max-w-md w-full p-6 relative flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 border-2 border-border-dark bg-white flex items-center justify-center font-black hover:bg-accent-coral hover:text-white transition-colors shadow-hard-sm"
            >
              ✕
            </button>

            <div className="border-b-4 border-border-dark pb-3">
              <span className="text-xs font-bold uppercase tracking-wider bg-accent-coral text-white px-2 py-0.5 border border-border-dark inline-block mb-2">Delete Meetup</span>
              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight font-display">Are you sure?</h2>
            </div>

            <p className="text-sm font-semibold text-secondary leading-normal">
              Are you sure you want to permanently delete this meetup listing? This action cannot be undone and will delete all coordination history.
            </p>

            {deleteError && (
              <div className="p-3 bg-accent-coral text-white font-bold text-xs border-2 border-border-dark">
                {deleteError}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button
                onClick={handleDeleteMeetup}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-accent-coral text-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 py-3 bg-white font-bold uppercase text-xs tracking-wide border-2 border-border-dark shadow-hard-sm hover:translate-y-0.5 transition-all text-primary"
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
