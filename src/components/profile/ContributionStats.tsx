import React from 'react';
import { TripWithPhotos } from '@/app/profile/page';
import { Bookmark, ThumbsUp } from 'lucide-react';

export default function ContributionStats({ 
  trips, 
  isOwnProfile = true 
}: { 
  trips: TripWithPhotos[]; 
  isOwnProfile?: boolean; 
}) {
  const publicTrips = trips.filter(t => t.is_public !== false);
  const totalSubmitted = publicTrips.length;
  const approved = publicTrips.filter(t => t.is_approved).length;
  const pending = publicTrips.filter(t => !t.is_approved).length;
  
  // Aggregate Saves and Helpful votes across approved public trips
  const totalSaves = publicTrips
    .filter(t => t.is_approved)
    .reduce((sum, trip) => sum + (trip.save_count || 0), 0);

  const totalHelpful = publicTrips
    .filter(t => t.is_approved)
    .reduce((sum, trip) => sum + (trip.helpful_count || 0), 0);

  return (
    <div className="bg-soft-beige/30 border border-border-dark/15 rounded-lg shadow-sm p-4 sm:p-6 flex flex-col gap-6">
      <div>
        <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight mb-4 border-b border-border-dark/10 pb-2">Impact Stats</h3>
        
        {isOwnProfile ? (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
            <div className="flex flex-col border border-border-dark/15 rounded-md p-2 bg-white shadow-sm">
              <span className="text-xl sm:text-2xl md:text-3xl font-black">{totalSubmitted}</span>
              <span className="text-[9px] sm:text-xs font-bold uppercase text-secondary">Submitted</span>
            </div>
            <div className="flex flex-col border border-border-dark/15 rounded-md p-2 bg-accent-yellow/10 shadow-sm">
              <span className="text-xl sm:text-2xl md:text-3xl font-black">{approved}</span>
              <span className="text-[9px] sm:text-xs font-bold uppercase text-secondary">Approved</span>
            </div>
            <div className="flex flex-col border border-border-dark/15 rounded-md p-2 bg-gray-50 shadow-sm">
              <span className="text-xl sm:text-2xl md:text-3xl font-black text-secondary">{pending}</span>
              <span className="text-[9px] sm:text-xs font-bold uppercase text-secondary">Pending</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 text-center">
            <div className="flex flex-col border border-border-dark/15 rounded-md p-2 bg-accent-yellow/10 shadow-sm">
              <span className="text-xl sm:text-2xl md:text-3xl font-black">{approved}</span>
              <span className="text-[9px] sm:text-xs font-bold uppercase text-secondary">Approved Trips</span>
            </div>
          </div>
        )}
      </div>

      {/* Community Value Breakdown */}
      {approved > 0 && (
        <div className="border-t border-border-dark/10 pt-4 flex flex-col gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-secondary">Community Value</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 bg-white border border-border-dark/15 rounded-md shadow-sm">
              <div className="p-2 bg-accent-blue/15 border border-border-dark/10 shrink-0 rounded">
                <Bookmark className="w-5 h-5 text-accent-blue" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-lg font-black leading-none">{totalSaves}</p>
                <p className="text-[9px] sm:text-xs font-bold text-secondary uppercase mt-1">Times Saved</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-white border border-border-dark/15 rounded-md shadow-sm">
              <div className="p-2 bg-accent-coral/15 border border-border-dark/10 shrink-0 rounded">
                <ThumbsUp className="w-5 h-5 text-accent-coral" />
              </div>
              <div className="text-left min-w-0">
                <p className="text-lg font-black leading-none">{totalHelpful}</p>
                <p className="text-[9px] sm:text-xs font-bold text-secondary uppercase mt-1">Helpful Votes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-accent-blue/10 border-l-4 border-accent-blue p-3 sm:p-4">
        <p className="font-bold text-xs sm:text-sm text-primary">
          {approved > 0 
            ? `${isOwnProfile ? 'Your' : 'These'} approved trips are helping travelers plan their byahe.` 
            : `${isOwnProfile ? 'Your contributions are' : 'No trips have been shared yet that are'} waiting to help future travelers.`}
        </p>
      </div>
    </div>
  );
}
