import { BadgeCheck, Trophy, Map } from 'lucide-react';
import { User, Trip } from '@/types/supabase';
import { getTravelerLevel, resolveProvinceName } from './PhProvincesMap';

export default function ProfileHeader({ 
  profile, 
  badges = [], 
  isOwnProfile = true,
  userTrips = []
}: { 
  profile: User; 
  badges?: { id: string; badge_name: string; }[]; 
  isOwnProfile?: boolean; 
  userTrips?: Trip[];
}) {
  const displayName = profile.display_name || "Traveler";
  
  // Calculate level based on unique provinces
  const uniqueProvinceCount = new Set(
    userTrips
      .map(t => resolveProvinceName(t.destination_province || t.destination_region || t.destination))
      .filter(Boolean)
  ).size;
  const levelInfo = getTravelerLevel(uniqueProvinceCount);
  
  // Calculate Access Status
  const now = new Date();
  const expiresAt = profile.access_expires_at ? new Date(profile.access_expires_at) : null;
  const isTemporary = !profile.has_contributed && expiresAt && expiresAt > now;
  
  let badgeText = "Limited Access";
  let badgeColor = "bg-accent-coral text-white";
  let accessMessage = "Share one useful contribution to unlock the full board.";
  
  if (profile.has_contributed) {
    badgeText = "Full Access";
    badgeColor = "bg-primary text-white";
    accessMessage = "You unlocked the full board by contributing.";
  } else if (isTemporary) {
    const diffMs = expiresAt.getTime() - now.getTime();
    const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
    badgeText = "Temporary Access";
    badgeColor = "bg-accent-yellow text-primary";
    accessMessage = `You have ${diffHours} hours left. Share a trip, tip, or update to keep full access.`;
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3 sm:gap-4 border-b-4 border-border-dark pb-3 sm:pb-4 min-w-0">
        <div className="w-14 h-14 sm:w-20 sm:h-20 shrink-0 bg-accent-yellow border-4 border-border-dark rounded-full flex items-center justify-center overflow-hidden">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="font-black text-xl sm:text-3xl text-primary">{displayName.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 w-full flex flex-col items-center sm:items-start">
          <h2 className="text-sm sm:text-lg xl:text-xl font-black tracking-tight break-words whitespace-normal leading-tight" title={displayName}>{displayName}</h2>
          {isOwnProfile && (
            <p className="text-secondary text-[11px] sm:text-sm font-medium break-all whitespace-normal" title={profile.email}>{profile.email}</p>
          )}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-1.5 w-full">
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-accent-green text-white border border-border-dark/15 font-black text-[9px] sm:text-xs tracking-wide rounded shadow-sm">
              <Map className="w-3 h-3 sm:w-4 sm:h-4 text-white fill-white/20 shrink-0" />
              {levelInfo.title.toUpperCase()}
            </div>
            {profile.total_vouches > 0 && (
              <div className="inline-block px-1.5 py-0.5 bg-accent-coral text-white border border-border-dark/15 font-bold text-[9px] sm:text-xs tracking-wide rounded shadow-sm">
                ★ {profile.total_vouches} {profile.total_vouches === 1 ? 'Vouch' : 'Vouches'}
              </div>
            )}
            {profile.is_verified_organizer && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-accent-blue text-white border border-border-dark/15 font-black text-[9px] sm:text-xs tracking-wide rounded shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <BadgeCheck className="w-3 h-3 sm:w-4 sm:h-4 text-white fill-white/20 shrink-0" />
                VERIFIED ORGANIZER
              </div>
            )}
            {badges.map((badge) => (
              <div key={badge.id} className="flex items-center gap-1 px-1.5 py-0.5 bg-accent-blue text-white border border-border-dark/15 font-black text-[9px] sm:text-xs tracking-wide rounded shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <Trophy className="w-3 h-3 sm:w-4 sm:h-4 text-white fill-white/20 shrink-0" />
                {badge.badge_name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs sm:text-sm border-l-4 border-border-dark pl-3 py-0.5">
        <p><span className="font-bold">Region:</span> {profile.region || 'Not set'}</p>
        <p><span className="font-bold">Travel Style:</span> {profile.travel_style || 'Not set'}</p>
        <p><span className="font-bold">Typical Budget:</span> {profile.typical_budget || 'Not set'}</p>
      </div>

      {isOwnProfile && (
        <div className="mt-1 bg-surface border-2 border-border-dark p-2.5 sm:p-3">
          <div className={`inline-block px-1.5 py-0.5 font-bold text-[10px] sm:text-xs uppercase tracking-wide border-2 border-border-dark mb-1 ${badgeColor}`}>
            {badgeText}
          </div>
          <p className="text-xs sm:text-sm font-medium">{accessMessage}</p>
        </div>
      )}
    </div>
  );
}
