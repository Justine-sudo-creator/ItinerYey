import { RouteSegment } from '@/types/supabase';

export function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimateWalkMinutes(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const meters = getDistanceMeters(lat1, lng1, lat2, lng2);
  return Math.max(1, Math.round(meters / 80));
}

export function getNextStepText(current: RouteSegment, next: RouteSegment): string {
  const isWalk = next.transport_type.toLowerCase() === 'walk';
  const userDuration = next.estimated_duration?.trim();

  if (isWalk) {
    const instruction = next.signboard || `Walk to ${next.drop_off_name || next.boarding_name || 'next stop'}`;
    if (userDuration) {
      return `${instruction} (${userDuration})`;
    }
    return instruction;
  }

  const mode = next.transport_type;
  const signboard = next.signboard ? ` (${next.signboard})` : '';
  const at = next.boarding_name ? ` at ${next.boarding_name}` : '';
  const base = `Board ${mode}${signboard}${at}`;
  return userDuration ? `${base} (${userDuration})` : base;
}

export function getFinalArrivalText(destination: string, lastSegment: RouteSegment): string {
  const landmark = lastSegment.drop_off_name;
  if (landmark && landmark !== destination) {
    return `You arrive at ${destination} (${landmark})`;
  }
  return `You arrive at ${destination}`;
}

export const MAX_TIP_WORDS = 15;

export function validateTip(tip: string): boolean {
  if (!tip.trim()) return true;
  return tip.trim().split(/\s+/).filter(Boolean).length <= MAX_TIP_WORDS;
}

export function countTipWords(tip: string): number {
  return tip.trim() ? tip.trim().split(/\s+/).filter(Boolean).length : 0;
}
