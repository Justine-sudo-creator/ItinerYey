'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { TripWithPhotos } from '@/app/profile/page';
import { TextInput, SelectInput } from '@/components/ui/Inputs';
import { PrimaryButton } from '@/components/ui/Button';
import AdminReviewCard from './AdminReviewCard';
import { createClient } from '@/utils/supabase/client';
import { awardBadge, removeBadge, updateActiveChallenge } from '@/app/admin/actions';
import AdminPaymentsTab from './AdminPaymentsTab';

const DEFAULT_CHALLENGES_QUEUE = [
  {
    week_number: 1,
    hashtag: 'Challenge||CommuterDream',
    title: '100% Commuter Challenge',
    description: 'Share a day-trip using only public transport (jeeps, trikes, buses, trains). No private cars allowed!',
    reward_badge: 'Transit Master||₱500 GCash'
  },
  {
    week_number: 2,
    hashtag: 'Weather||RainySeasonAlert',
    title: 'Habagat Travel Advisory',
    description: 'Heavy rains and wind warnings are up for Northern Luzon. If you have Elyu or Baguio trips planned, keep safe and double-check road advisories!',
    reward_badge: '||||https://pagasa.dost.gov.ph||https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=500'
  },
  {
    week_number: 3,
    hashtag: 'Shoutout||LeaderboardSpotlight',
    title: 'Top Contributor Spotlight!',
    description: 'Shoutout to our top contributor @JustineMationg for sharing 3 amazing budget itineraries and leading the leaderboard! Salute!',
    reward_badge: '||||/profile?id=justine-id||'
  },
  {
    week_number: 4,
    hashtag: 'News||RemixFeature',
    title: 'New Feature: Remix Itineraries',
    description: 'You can now copy any public trip itinerary as a custom template in your own locker. Plan faster, customize budget categories, and go!',
    reward_badge: '||||/submit||https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=500'
  },
  {
    week_number: 5,
    hashtag: 'Challenge||ElyuBeachVibe',
    title: 'La Union Beach Trip',
    description: 'Share a weekend beach budget for San Juan, La Union under ₱4,000 per head.',
    reward_badge: 'Wave Chaser||₱500 GCash'
  }
];

type Tab = 'pending' | 'claims' | 'published' | 'challenges' | 'badges' | 'payments' | 'all';

interface AdminUser {
  id: string;
  display_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
}

interface UserBadge {
  id: string;
  user_id: string;
  badge_name: string;
}

interface ChallengeQueueItem {
  week_number: number;
  hashtag: string;
  title: string;
  description: string;
  reward_badge: string;
}

export default function AdminBoard({ trips }: { trips: TripWithPhotos[] }) {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const supabase = createClient();

  // Users & Badges State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [customBadgeName, setCustomBadgeName] = useState('');
  const [badgeActionLoading, setBadgeActionLoading] = useState(false);
  const [badgeError, setBadgeError] = useState('');

  // Queue of challenges state
  const [challengeQueue, setChallengeQueue] = useState<ChallengeQueueItem[]>([]);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [actionLoadingIdx, setActionLoadingIdx] = useState<number | null>(null);

  useEffect(() => {
    fetchUsersAndBadges();
    loadChallengeQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsersAndBadges = async () => {
    try {
      // Fetch users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('display_name');
      setUsers(usersData || []);

      // Fetch badges
      const typedSupabase = supabase as unknown as {
        from: (table: string) => {
          select: (fields: string) => Promise<{ data: UserBadge[] | null }>;
        };
      };
      const { data: badgesData } = await typedSupabase
        .from('user_badges')
        .select('*');
      setUserBadges(badgesData || []);
    } catch (err) {
      console.error("Failed to load users or badges:", err);
    }
  };

  const loadChallengeQueue = () => {
    const local = localStorage.getItem('itineryey_challenges_queue');
    if (local) {
      setChallengeQueue(JSON.parse(local));
    } else {
      setChallengeQueue(DEFAULT_CHALLENGES_QUEUE);
    }
  };

  const handleSaveQueue = () => {
    localStorage.setItem('itineryey_challenges_queue', JSON.stringify(challengeQueue));
    setSaveSuccessMessage('Upcoming challenge queue saved successfully!');
    setTimeout(() => setSaveSuccessMessage(''), 3000);
  };

  const handlePublishActiveChallenge = async (idx: number, item: ChallengeQueueItem) => {
    setActionLoadingIdx(idx);
    try {
      await updateActiveChallenge(item.title, item.description, item.hashtag, item.reward_badge);
      setSaveSuccessMessage(`🎉 "${item.title}" is now the GLOBAL active challenge on the feed!`);
      setTimeout(() => setSaveSuccessMessage(''), 5000);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoadingIdx(null);
    }
  };

  const handleUpdateQueueItem = (idx: number, field: string, value: string) => {
    const updated = challengeQueue.map((item, i) => {
      if (i === idx) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setChallengeQueue(updated);
  };

  const handleUpdateAnnouncementType = (idx: number, newType: string) => {
    const item = challengeQueue[idx];
    const hashtagRaw = item.hashtag || '';
    let currentHashtag = '';
    if (hashtagRaw.includes('||')) {
      currentHashtag = hashtagRaw.split('||')[1] || '';
    } else {
      currentHashtag = hashtagRaw;
    }
    const newHashtagValue = `${newType}||${currentHashtag}`;
    handleUpdateQueueItem(idx, 'hashtag', newHashtagValue);
  };

  const handleUpdateAnnouncementLabel = (idx: number, newLabel: string) => {
    const item = challengeQueue[idx];
    const hashtagRaw = item.hashtag || '';
    let currentType = 'Challenge';
    if (hashtagRaw.includes('||')) {
      currentType = hashtagRaw.split('||')[0] || 'Challenge';
    }
    const newHashtagValue = `${currentType}||${newLabel}`;
    handleUpdateQueueItem(idx, 'hashtag', newHashtagValue);
  };

  const handleUpdateAnnouncementRewardField = (idx: number, fieldIndex: number, val: string) => {
    const item = challengeQueue[idx];
    const rewardRaw = item.reward_badge || '';
    const parts = rewardRaw.includes('||') ? rewardRaw.split('||') : [rewardRaw, '', '', ''];
    while (parts.length < 4) {
      parts.push('');
    }
    parts[fieldIndex] = val;
    handleUpdateQueueItem(idx, 'reward_badge', parts.join('||'));
  };

  const handleAwardBadgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !customBadgeName.trim()) return;
    
    setBadgeActionLoading(true);
    setBadgeError('');

    try {
      await awardBadge(selectedUserId, customBadgeName.trim());
      setCustomBadgeName('');
      await fetchUsersAndBadges();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setBadgeError(errMsg || 'Failed to award badge');
    } finally {
      setBadgeActionLoading(false);
    }
  };

  const handleRemoveBadgeClick = async (badgeId: string, userId: string) => {
    if (!confirm('Are you sure you want to remove this badge?')) return;
    
    setBadgeActionLoading(true);
    setBadgeError('');

    try {
      await removeBadge(badgeId, userId);
      await fetchUsersAndBadges();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setBadgeError(errMsg || 'Failed to remove badge');
    } finally {
      setBadgeActionLoading(false);
    }
  };

  const filteredTrips = useMemo(() => {
    let result = trips;

    // Filter by Tab
    if (activeTab === 'pending') {
      result = result.filter(t => !t.is_approved && !t.claim_request_by);
    } else if (activeTab === 'claims') {
      result = result.filter(t => !!t.claim_request_by);
    } else if (activeTab === 'published') {
      result = result.filter(t => t.is_approved && !t.claim_request_by);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        (t.trip_name?.toLowerCase() || '').includes(q) ||
        (t.destination?.toLowerCase() || '').includes(q) ||
        (t.destination_region?.toLowerCase() || '').includes(q) ||
        (t.origin_region?.toLowerCase() || '').includes(q) ||
        (t.trip_type?.toLowerCase() || '').includes(q) ||
        (t.travel_style?.toLowerCase() || '').includes(q) ||
        (t.trip_summary?.toLowerCase() || '').includes(q) ||
        (t.tip?.toLowerCase() || '').includes(q) ||
        (t.user_id?.toLowerCase() || '').includes(q)
      );
    }

    return result;
  }, [trips, activeTab, searchQuery]);

  const pendingCount = trips.filter(t => !t.is_approved && !t.claim_request_by).length;
  const claimsCount = trips.filter(t => !!t.claim_request_by).length;
  const publishedCount = trips.filter(t => t.is_approved && !t.claim_request_by).length;
  const totalCount = trips.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface border-4 border-border-dark shadow-hard p-6">
        <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Review Board</h1>
        <p className="text-secondary font-medium mb-6">Approve useful trips, hide bad entries, manage weekly challenges, and award badges.</p>
        
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          {/* Tabs */}
          <div className="flex gap-2 border-2 border-border-dark bg-white p-1 overflow-x-auto w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 font-bold text-sm uppercase whitespace-nowrap transition-colors ${activeTab === 'pending' ? 'bg-accent-yellow text-primary border-2 border-border-dark' : 'text-secondary hover:text-primary'}`}
            >
              Pending ({pendingCount})
            </button>
            <button 
              onClick={() => setActiveTab('claims')}
              className={`px-4 py-2 font-bold text-sm uppercase whitespace-nowrap transition-colors ${activeTab === 'claims' ? 'bg-accent-coral text-white border-2 border-border-dark' : 'text-secondary hover:text-primary'}`}
            >
              Claims ({claimsCount})
            </button>
            <button 
              onClick={() => setActiveTab('published')}
              className={`px-4 py-2 font-bold text-sm uppercase whitespace-nowrap transition-colors ${activeTab === 'published' ? 'bg-accent-blue text-white border-2 border-border-dark' : 'text-secondary hover:text-primary'}`}
            >
              Published ({publishedCount})
            </button>
            <button 
              onClick={() => setActiveTab('challenges')}
              className={`px-4 py-2 font-bold text-sm uppercase whitespace-nowrap transition-colors ${activeTab === 'challenges' ? 'bg-accent-yellow border-2 border-border-dark' : 'text-secondary hover:text-primary'}`}
            >
              Bulletin Board
            </button>
            <button 
              onClick={() => setActiveTab('badges')}
              className={`px-4 py-2 font-bold text-sm uppercase whitespace-nowrap transition-colors ${activeTab === 'badges' ? 'bg-accent-coral text-white border-2 border-border-dark' : 'text-secondary hover:text-primary'}`}
            >
              Award Badges
            </button>
            <button 
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 font-bold text-sm uppercase whitespace-nowrap transition-colors ${activeTab === 'payments' ? 'bg-accent-coral text-white border-2 border-border-dark' : 'text-secondary hover:text-primary'}`}
            >
              Payments Queue
            </button>
            <button 
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 font-bold text-sm uppercase whitespace-nowrap transition-colors ${activeTab === 'all' ? 'bg-border-dark text-white border-2 border-border-dark' : 'text-secondary hover:text-primary'}`}
            >
              All ({totalCount})
            </button>
          </div>

          {/* Search (only for trip-related tabs) */}
          {['pending', 'claims', 'published', 'all'].includes(activeTab) && (
            <div className="w-full md:w-72">
              <TextInput 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search destination, user..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'challenges' ? (
        <div className="bg-surface border-4 border-border-dark shadow-hard p-6 flex flex-col gap-6">
          <div className="flex justify-between items-center border-b-4 border-border-dark pb-3">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Bulletin Board Queue</h2>
              <p className="text-secondary text-sm font-medium">Design and cycle the pre-scheduled announcements, shoutouts, weather alerts, and challenges.</p>
            </div>
            <PrimaryButton onClick={handleSaveQueue} className="px-6 py-2 shadow-hard text-xs sm:text-sm">
              Save Queue
            </PrimaryButton>
          </div>

          {saveSuccessMessage && (
            <div className="bg-accent-blue border-2 border-border-dark p-3 text-white font-bold text-sm shadow-hard-sm">
              {saveSuccessMessage}
            </div>
          )}

          <div className="flex flex-col gap-6">
            {challengeQueue.map((item, idx) => {
              const hashtagRaw = item.hashtag || '';
              let currentType = 'Challenge';
              let currentHashtag = '';
              if (hashtagRaw.includes('||')) {
                const parts = hashtagRaw.split('||');
                currentType = parts[0] || 'Challenge';
                currentHashtag = parts[1] || '';
              } else {
                currentHashtag = hashtagRaw;
              }

              const rewardRaw = item.reward_badge || '';
              const parts = rewardRaw.includes('||') ? rewardRaw.split('||') : [rewardRaw, '', '', ''];
              while (parts.length < 4) {
                parts.push('');
              }
              const currentBadge = parts[0] || '';
              const currentReward = parts[1] || '';
              const currentLink = parts[2] || '';
              const currentPolaroid = parts[3] || '';

              return (
                <div key={idx} className="bg-soft-beige border-4 border-border-dark p-4 flex flex-col gap-4 relative">
                  <span className="absolute top-2 right-2 text-xs font-black uppercase bg-accent-yellow border border-border-dark px-2 py-0.5">
                    Slot {idx + 1} Announcement
                  </span>
                  <h3 className="font-bold text-sm uppercase tracking-wide border-b-2 border-border-dark pb-1 w-fit">
                    Item #{idx + 1}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SelectInput
                      label="Announcement Type"
                      value={currentType}
                      onChange={(e) => handleUpdateAnnouncementType(idx, e.target.value)}
                      options={[
                        { value: 'Challenge', label: '🏆 Challenge' },
                        { value: 'Weather', label: '🌦️ Weather Advisory' },
                        { value: 'Shoutout', label: '📣 Community Shoutout' },
                        { value: 'News', label: '⚡ System News' },
                        { value: 'General', label: '📌 General Notice' }
                      ]}
                    />
                    <TextInput 
                      label={
                        currentType === 'Challenge' ? 'Hashtag (e.g. ElyuTrip)' :
                        currentType === 'Shoutout' ? 'Username / Handle (e.g. @Justine)' :
                        currentType === 'Weather' ? 'Advisory Label (e.g. Signal #1)' :
                        'Sub-label / Tag (e.g. Update)'
                      }
                      value={currentHashtag}
                      onChange={(e) => handleUpdateAnnouncementLabel(idx, e.target.value)}
                      placeholder="e.g. BarkadaOnBudget"
                    />
                    <div className="col-span-1 md:col-span-2">
                      <TextInput 
                        label="Headline Title"
                        value={item.title}
                        onChange={(e) => handleUpdateQueueItem(idx, 'title', e.target.value)}
                        placeholder="Enter catchy title..."
                      />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                      <label className="font-bold text-xs uppercase tracking-wide block mb-1">Description / Content</label>
                      <textarea
                        value={item.description}
                        onChange={(e) => handleUpdateQueueItem(idx, 'description', e.target.value)}
                        className="w-full p-2 border-2 border-border-dark bg-white font-bold h-20 resize-none text-sm"
                        placeholder="Write the announcement content here..."
                      />
                    </div>

                    {currentType === 'Challenge' ? (
                      <>
                        <TextInput 
                          label="Reward Badge Name"
                          value={currentBadge}
                          onChange={(e) => handleUpdateAnnouncementRewardField(idx, 0, e.target.value)}
                          placeholder="e.g. Budget Wizard"
                        />
                        <TextInput 
                          label="Custom Reward (e.g. Cash, Voucher)"
                          value={currentReward}
                          onChange={(e) => handleUpdateAnnouncementRewardField(idx, 1, e.target.value)}
                          placeholder="e.g. ₱500 GCash"
                        />
                      </>
                    ) : (
                      <>
                        <TextInput 
                          label="Action Link URL (Optional)"
                          value={currentLink}
                          onChange={(e) => handleUpdateAnnouncementRewardField(idx, 2, e.target.value)}
                          placeholder="e.g. /trip/123 or https://pagasa.dost.gov.ph"
                        />
                        <TextInput 
                          label="Polaroid Image URL (Optional)"
                          value={currentPolaroid}
                          onChange={(e) => handleUpdateAnnouncementRewardField(idx, 3, e.target.value)}
                          placeholder="Paste direct link to image..."
                        />
                      </>
                    )}

                    <div className="col-span-1 md:col-span-2 flex justify-end mt-2 pt-4 border-t border-border-dark border-dashed">
                      <button
                        type="button"
                        onClick={() => handlePublishActiveChallenge(idx, item)}
                        disabled={actionLoadingIdx !== null}
                        className="px-4 py-2 text-xs font-black uppercase tracking-wide border-2 border-border-dark bg-accent-yellow shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50"
                      >
                        {actionLoadingIdx === idx ? 'Publishing...' : '📢 Publish to Bulletin Board'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'badges' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Award New Badge Form */}
          <div className="lg:col-span-1 bg-surface border-4 border-border-dark shadow-hard p-6 flex flex-col gap-4 h-fit">
            <h2 className="text-xl font-black uppercase tracking-tight border-b-4 border-border-dark pb-2">Award Achievement</h2>
            
            <form onSubmit={handleAwardBadgeSubmit} className="flex flex-col gap-4">
              <SelectInput 
                label="Select Traveler"
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
                options={[
                  { value: '', label: 'Choose user...' },
                  ...users.map(u => ({ value: u.id, label: `${u.display_name || 'Traveler'} (${u.email || 'Anonymous'})` }))
                ]}
                required
              />

              <TextInput 
                label="Badge Name"
                placeholder="e.g. Transit Master, Budget Guru"
                value={customBadgeName}
                onChange={e => setCustomBadgeName(e.target.value)}
                required
              />

              {badgeError && (
                <div className="bg-accent-coral border-2 border-border-dark p-2 text-white font-bold text-xs">
                  {badgeError}
                </div>
              )}

              <PrimaryButton type="submit" disabled={badgeActionLoading} className="py-2.5 text-xs">
                {badgeActionLoading ? 'Awarding...' : 'Award Badge'}
              </PrimaryButton>
            </form>
          </div>

          {/* Right: Current Badges Board */}
          <div className="lg:col-span-2 bg-surface border-4 border-border-dark shadow-hard p-6 flex flex-col gap-4">
            <h2 className="text-xl font-black uppercase tracking-tight border-b-4 border-border-dark pb-2">Active Achievements Board</h2>
            
            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2">
              {users.filter(u => userBadges.some(b => b.user_id === u.id)).length === 0 ? (
                <div className="text-secondary italic font-bold text-sm p-4 text-center border-2 border-dashed border-border-dark bg-white">
                  No custom achievement badges awarded yet.
                </div>
              ) : (
                users.filter(u => userBadges.some(b => b.user_id === u.id)).map(user => (
                  <div key={user.id} className="bg-soft-beige border-4 border-border-dark p-3 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-accent-yellow border-2 border-border-dark rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shrink-0 uppercase">
                        {user.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          (user.display_name || 'T').charAt(0)
                        )}
                      </div>
                      <div>
                        <h4 className="font-black uppercase text-sm leading-none">{user.display_name || 'Traveler'}</h4>
                        <p className="text-[10px] text-secondary font-mono truncate max-w-xs">{user.email || 'No email'}</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {userBadges.filter(b => b.user_id === user.id).map(badge => (
                        <div key={badge.id} className="flex items-center gap-1.5 px-2 py-0.5 bg-white border-2 border-border-dark text-[10px] font-black uppercase tracking-wide shadow-hard-sm">
                          <span>🏆 {badge.badge_name}</span>
                          <button 
                            onClick={() => handleRemoveBadgeClick(badge.id, user.id)}
                            className="text-accent-coral font-bold hover:text-red-700 transition-colors ml-1 cursor-pointer"
                            title="Remove Badge"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'payments' ? (
        <AdminPaymentsTab />
      ) : (
        <div className="flex flex-col gap-6">
          {filteredTrips.length === 0 ? (
            <div className="bg-surface border-4 border-border-dark shadow-hard p-12 text-center">
              <h2 className="text-xl font-black uppercase tracking-tight mb-2">
                {activeTab === 'pending' ? 'No pending submissions.' : activeTab === 'published' ? 'No published trips yet.' : 'No trips found.'}
              </h2>
              <p className="text-secondary font-medium">
                {activeTab === 'pending' ? 'New trips, tips, and updates will appear here for review.' : 'Try clearing your search query.'}
              </p>
            </div>
          ) : (
            filteredTrips.map(trip => (
              <AdminReviewCard key={trip.id} trip={trip} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
