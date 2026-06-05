import React, { useState } from 'react';
import { TripWithPhotos } from '@/app/profile/page';
import ProfileTripCard from './ProfileTripCard';
import { createClient } from '@/utils/supabase/client';

import { User } from '@/types/supabase';

const ITEMS_PER_PAGE = 6;

export default function MyContributions({ 
  trips, 
  isOwnProfile = true, 
  userProfile 
}: { 
  trips: TripWithPhotos[]; 
  isOwnProfile?: boolean; 
  userProfile: User;
}) {
  const [activeTab, setActiveTab] = useState<'public' | 'private'>('public');
  const [currentPage, setCurrentPage] = useState(1);
  
  const supabase = createClient();
  const [tripToDelete, setTripToDelete] = useState<TripWithPhotos | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!tripToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('trips').delete().eq('id', tripToDelete.id);
      if (error) throw error;
      window.location.reload();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      alert('Failed to delete: ' + errMsg);
      setIsDeleting(false);
    }
  };

  const publicTrips = trips.filter(t => t.is_public !== false);
  const privateTrips = trips.filter(t => t.is_public === false);

  const displayedTrips = isOwnProfile ? (activeTab === 'public' ? publicTrips : privateTrips) : publicTrips;
  
  const totalPages = Math.ceil(displayedTrips.length / ITEMS_PER_PAGE);
  const paginatedTrips = displayedTrips.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleTabChange = (tab: 'public' | 'private') => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  return (
    <div className="bg-soft-beige/30 border border-border-dark/10 rounded-xl shadow-sm p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight mb-4 border-b border-border-dark/10 pb-3">
        {isOwnProfile ? 'My Contributions' : `${userProfile.display_name || 'Traveler'}'s Contributions`}
      </h3>
      
      {isOwnProfile && (
        <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6">
          <button 
            onClick={() => handleTabChange('public')}
            className={`flex-1 py-2 font-bold uppercase tracking-wide border border-border-dark/15 rounded-md transition-all text-[10px] sm:text-xs md:text-sm ${
              activeTab === 'public' ? 'bg-accent-yellow text-primary shadow-sm' : 'bg-white hover:bg-soft-beige'
            }`}
          >
            My Public Board ({publicTrips.length})
          </button>
          <button 
            onClick={() => handleTabChange('private')}
            className={`flex-1 py-2 font-bold uppercase tracking-wide border border-border-dark/15 rounded-md transition-all text-[10px] sm:text-xs md:text-sm ${
              activeTab === 'private' ? 'bg-accent-yellow text-primary shadow-sm' : 'bg-white hover:bg-soft-beige'
            }`}
          >
            My Private Locker ({privateTrips.length})
          </button>
        </div>
      )}
      
      {displayedTrips.length === 0 ? (
        <div className="p-8 text-center border border-border-dark/10 border-dashed rounded-lg bg-white flex flex-col items-center gap-3">
          <p className="text-secondary font-bold text-sm">
            {isOwnProfile ? (
              activeTab === 'public' 
                ? "You haven't shared any public trips yet." 
                : "You have no private drafts in your locker."
            ) : (
              `${userProfile.display_name || 'Traveler'} hasn't shared any public trips yet.`
            )}
          </p>
          {isOwnProfile && activeTab === 'public' && (
            <a 
              href="/submit"
              className="inline-flex items-center gap-2 border border-border-dark/15 rounded-md px-4 py-2 bg-accent-coral text-white font-black uppercase text-xs shadow-sm hover:translate-y-0.5 transition-transform"
            >
              Share Your First Trip
            </a>
          )}
        </div>
      ) : (
        <>
          <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-4 pb-4 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:pb-0">
            {paginatedTrips.map(trip => (
              <div key={trip.id} className="w-[85vw] xs:w-[75vw] sm:w-[320px] shrink-0 snap-center md:w-full md:shrink md:snap-align-none">
                <ProfileTripCard 
                  trip={trip} 
                  onDeleteClick={setTripToDelete}
                />
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-6 pt-4 border-t border-border-dark/10 border-dashed">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1 font-black border border-border-dark/15 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-yellow transition-colors shadow-sm"
              >
                &lt;
              </button>
              <span className="font-bold text-sm uppercase">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1 font-black border border-border-dark/15 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-yellow transition-colors shadow-sm"
              >
                &gt;
              </button>
            </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {tripToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="relative w-full max-w-sm bg-[#F5EBE1] border border-border-dark/15 rounded-xl shadow-lg p-6 flex flex-col gap-6 transform translate-y-0 transition-transform">
            <div className="flex flex-col gap-2">
              <h3 className="text-2xl font-black uppercase tracking-tight text-primary">
                DELETE DRAFT?
              </h3>
              <div className="h-[1px] bg-border-dark/10 w-full" />
            </div>

            <p className="text-sm font-bold text-secondary leading-relaxed">
              Are you sure you want to delete this trip/draft? This action is permanent and cannot be undone!
            </p>

            <div className="flex gap-4 mt-2">
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 text-xs font-black uppercase tracking-wide border border-border-dark/15 rounded-md bg-accent-coral text-white shadow-sm hover:translate-y-[-1px] active:translate-y-0 transition-all"
              >
                {isDeleting ? 'DELETING...' : 'YES, DELETE'}
              </button>
              <button
                onClick={() => setTripToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 text-xs font-black uppercase tracking-wide border border-border-dark/15 rounded-md bg-white text-primary shadow-sm hover:translate-y-[-1px] active:translate-y-0 transition-all"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
