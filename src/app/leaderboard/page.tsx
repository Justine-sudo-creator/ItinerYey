import React from 'react';
import { createClient } from '@/utils/supabase/server';
import { RetroPanel } from '@/components/ui/Cards';
import { Award, Trophy, Medal } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every minute

export default async function LeaderboardPage() {
  const supabase = createClient();
  
  // Fetch top 50 users ranked by total_vouches
  const { data: users, error } = await supabase
    .from('users')
    .select('id, display_name, avatar_url, total_vouches')
    .gt('total_vouches', 0)
    .order('total_vouches', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to load leaderboard', error);
  }

  const getRankIcon = (index: number) => {
    switch(index) {
      case 0: return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 1: return <Medal className="w-6 h-6 text-gray-400" />;
      case 2: return <Medal className="w-6 h-6 text-amber-700" />;
      default: return <span className="font-bold text-secondary text-sm">#{index + 1}</span>;
    }
  };

  const topUsers = users || [];

  return (
    <div className="w-full max-w-3xl mx-auto py-12 px-3 sm:px-4 flex flex-col gap-8">
      <div className="text-center">
        <h1 className="font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tighter mb-3 inline-flex items-center justify-center gap-3">
          <Award className="w-8 h-8 sm:w-10 sm:h-10 text-accent-coral hidden sm:inline-block" />
          Top Contributors
          <Award className="w-8 h-8 sm:w-10 sm:h-10 text-accent-coral hidden sm:inline-block" />
        </h1>
        <p className="text-secondary font-medium text-sm sm:text-base md:text-lg">
          The most helpful travelers in the ItinerYey community.
        </p>
      </div>

      <RetroPanel className="p-0 overflow-hidden">
        <div className="bg-primary text-white p-3 sm:p-4 flex font-bold uppercase tracking-widest text-[10px] sm:text-xs border-b-4 border-border-dark">
          <div className="w-12 sm:w-16 text-center">Rank</div>
          <div className="flex-1">Traveler</div>
          <div className="w-20 sm:w-24 text-right">Vouches</div>
        </div>

        {topUsers.length === 0 ? (
          <div className="p-8 text-center text-secondary font-medium italic">
            No one is on the leaderboard yet. Be the first to share a helpful trip!
          </div>
        ) : (
          <div className="flex flex-col divide-y-2 divide-border-dark">
            {topUsers.map((user, idx) => {
              const displayName = user.display_name || 'Traveler';
              const isTop3 = idx < 3;
              
              return (
                <div 
                  key={user.id} 
                  className={`flex items-center p-3 sm:p-4 transition-colors hover:bg-soft-beige ${isTop3 ? 'bg-accent-yellow/10' : ''}`}
                >
                  <div className="w-12 sm:w-16 flex justify-center items-center">
                    {getRankIcon(idx)}
                  </div>
                  
                  <Link 
                    href={`/profile?id=${user.id}`}
                    className="flex-1 flex items-center gap-2 sm:gap-4 min-w-0 hover:opacity-85 transition-opacity"
                  >
                    <div className="w-9 h-9 sm:w-12 sm:h-12 shrink-0 bg-accent-yellow border-2 border-border-dark rounded-full flex items-center justify-center overflow-hidden font-bold text-primary uppercase text-sm sm:text-base">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                      ) : (
                        displayName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`font-black tracking-tight ${isTop3 ? 'text-base sm:text-lg' : 'text-sm sm:text-base'}`}>
                        {displayName}
                      </div>
                      {isTop3 && (
                        <div className="text-[9px] sm:text-[10px] font-bold text-accent-coral uppercase tracking-wider">
                          Community Leader
                        </div>
                      )}
                    </div>
                  </Link>
                  
                  <div className="w-20 sm:w-24 text-right shrink-0">
                    <span className="inline-block px-2 py-0.5 sm:px-3 sm:py-1 bg-accent-coral border-2 border-border-dark font-black text-white shadow-[2px_2px_0px_#000] text-xs sm:text-sm">
                      ★ {user.total_vouches}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </RetroPanel>
    </div>
  );
}
