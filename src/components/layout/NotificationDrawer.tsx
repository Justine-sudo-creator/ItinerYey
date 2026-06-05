'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import type { Notification } from '@/types/supabase';
import { Inbox } from 'lucide-react';

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface BatchedNotification {
  id: string;
  ids: string[];
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  actor: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  actorCount: number;
}

function getBatchedNotifications(rawNotifications: Notification[]): BatchedNotification[] {
  const batched: BatchedNotification[] = [];
  const groups: { [key: string]: { 
    primary: Notification; 
    ids: string[];
    actors: { display_name: string; avatar_url: string | null }[]; 
    isAnyUnread: boolean;
    count: number;
  } } = {};

  rawNotifications.forEach(notif => {
    let groupKey = '';
    
    // Batch rules
    if (notif.type === 'vouch_received') {
      groupKey = 'vouch_received';
    } else if (notif.type === 'trip_like' && notif.link) {
      groupKey = `trip_like:${notif.link}`;
    } else if (notif.type === 'meetup_join_request' && notif.link) {
      groupKey = `meetup_join_request:${notif.link}`;
    }

    if (groupKey) {
      const actorName = notif.actor?.display_name || 'Someone';
      const actorAvatar = notif.actor?.avatar_url || null;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          primary: notif,
          ids: [notif.id],
          actors: [{ display_name: actorName, avatar_url: actorAvatar }],
          isAnyUnread: !notif.is_read,
          count: 1
        };
      } else {
        groups[groupKey].ids.push(notif.id);
        if (!groups[groupKey].actors.some(a => a.display_name === actorName)) {
          groups[groupKey].actors.push({ display_name: actorName, avatar_url: actorAvatar });
        }
        groups[groupKey].count += 1;
        if (!notif.is_read) {
          groups[groupKey].isAnyUnread = true;
        }
      }
    } else {
      // Non-batchable notification
      batched.push({
        id: notif.id,
        ids: [notif.id],
        type: notif.type,
        title: notif.title,
        message: notif.message,
        link: notif.link,
        is_read: notif.is_read,
        created_at: notif.created_at,
        actor: notif.actor ? {
          display_name: notif.actor.display_name,
          avatar_url: notif.actor.avatar_url
        } : null,
        actorCount: 1
      });
    }
  });

  // Process grouped items
  Object.keys(groups).forEach(key => {
    const group = groups[key];
    const { primary, ids, actors, isAnyUnread, count } = group;
    
    let actorText = '';
    if (actors.length === 1) {
      actorText = actors[0].display_name;
    } else if (actors.length === 2) {
      actorText = `${actors[0].display_name} and ${actors[1].display_name}`;
    } else {
      actorText = `${actors[0].display_name}, ${actors[1].display_name} and ${count - 2} others`;
    }

    let title = primary.title;
    let message = primary.message;

    if (primary.type === 'vouch_received') {
      title = 'New Vouches!';
      message = `${actorText} vouched for you! Your trust index is growing.`;
    } else if (primary.type === 'trip_like') {
      title = 'Trip Vouched!';
      const destMatch = primary.message.match(/to\s+([^!]+)/i);
      const dest = destMatch ? destMatch[1].trim() : 'your itinerary';
      message = `${actorText} liked and saved your trip to ${dest}!`;
    } else if (primary.type === 'meetup_join_request') {
      title = 'New Join Requests';
      message = `${actorText} requested to join your meetup.`;
    }

    batched.push({
      id: primary.id,
      ids,
      type: primary.type,
      title,
      message,
      link: primary.link,
      is_read: !isAnyUnread,
      created_at: primary.created_at,
      actor: {
        display_name: actors[0].display_name,
        avatar_url: actors[0].avatar_url
      },
      actorCount: actors.length
    });
  });

  return batched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDrawer({ isOpen, onClose }: NotificationDrawerProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const fetchNotifications = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*, actor:users!actor_id(display_name, avatar_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('NotificationDrawer: Fetch error:', error);
      } else if (data && isMounted) {
        setNotifications(data as Notification[]);
      }
      if (isMounted) setLoading(false);
    };

    fetchNotifications();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('public:notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        async (payload) => {
          const { data: { user } } = await supabase.auth.getUser();
          const newRecord = payload.new as Record<string, unknown>;
          if (user && newRecord && newRecord.user_id === user.id) {
            const { data, error } = await supabase
              .from('notifications')
              .select('*, actor:users!actor_id(display_name, avatar_url)')
              .eq('id', newRecord.id as string)
              .single();
              
            if (error) {
              console.error('NotificationDrawer: Failed to fetch full actor details for new notification:', error);
            } else if (data) {
              setNotifications(prev => [data as Notification, ...prev]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [isOpen, supabase]);

  const markAsRead = async (ids: string[]) => {
    // Optimistic update
    setNotifications(prev => 
      prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n)
    );
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids);

    if (error) {
      console.error('NotificationDrawer: Failed to mark notifications as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      console.error('NotificationDrawer: Failed to mark all as read:', error);
    }
  };

  if (!isOpen) return null;

  const batchedNotifications = getBatchedNotifications(notifications);

  return (
    <>
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 animate-in fade-in duration-200"
      />
      
      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-96 bg-soft-beige border-l-4 border-border-dark z-[60] flex flex-col shadow-hard transform transition-transform duration-300 ease-out">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b-4 border-border-dark bg-accent-yellow">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-black text-xl uppercase tracking-tight text-primary">Notifications</h2>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 border-2 border-border-dark bg-surface shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center p-3 border-b-2 border-border-dark bg-surface">
          <span className="text-xs font-bold text-primary/70">
            {notifications.filter(n => !n.is_read).length} Unread
          </span>
          <button 
            onClick={markAllAsRead}
            className="text-[10px] font-black uppercase tracking-wider text-primary border border-border-dark px-2 py-1 shadow-[1px_1px_0px_#000] active:translate-y-[1px] active:translate-x-[1px] active:shadow-none transition-all"
          >
            Mark all read
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border-dark"></div>
            </div>
          ) : batchedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center gap-2 opacity-60 mt-12">
              <Inbox className="w-12 h-12 text-primary" strokeWidth={1.5} />
              <p className="font-bold text-sm">No notifications yet</p>
              <p className="text-xs">When people vouch for you or join your meetups, you&apos;ll see it here.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {batchedNotifications.map((notif) => {
                const isTransactional = ['meetup_join_request', 'new_message'].includes(notif.type);
                const isSocial = ['trip_like', 'vouch_received', 'badge_unlocked'].includes(notif.type);
                
                let highlightColor = 'bg-surface';
                if (!notif.is_read) {
                  if (isTransactional) highlightColor = 'bg-accent-blue/10';
                  else if (isSocial) highlightColor = 'bg-accent-coral/10';
                  else highlightColor = 'bg-white';
                }

                return (
                  <Link 
                    key={notif.id}
                    href={notif.link || '#'}
                    onClick={() => {
                      if (!notif.is_read) markAsRead(notif.ids);
                      if (notif.link) onClose();
                    }}
                    className={`block p-4 border-b-2 border-border-dark transition-colors hover:bg-neutral-100 ${highlightColor}`}
                  >
                    <div className="flex gap-3">
                      {/* Avatar or Icon */}
                      <div className="flex-shrink-0 pt-1">
                        {notif.actor?.avatar_url ? (
                          <img 
                            src={notif.actor.avatar_url} 
                            alt={notif.actor.display_name || ''} 
                            className="w-10 h-10 rounded-full border-2 border-border-dark object-cover shadow-[1px_1px_0px_#000]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full border-2 border-border-dark bg-accent-yellow flex items-center justify-center shadow-[1px_1px_0px_#000]">
                            <span className="font-bold">!</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-sm font-bold text-primary leading-tight">
                            {notif.title}
                          </p>
                          {!notif.is_read && (
                            <span className="w-2 h-2 rounded-full bg-accent-coral flex-shrink-0 mt-1 shadow-[1px_1px_0px_#000]"></span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-primary/80 leading-snug">
                          {notif.message}
                        </p>
                        <p className="text-[10px] font-black uppercase text-primary/50 tracking-wider mt-1">
                          {timeAgo(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
