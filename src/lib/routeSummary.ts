import { Route, RouteSegment } from '@/types/supabase';

export type TripSummary = {
  duration: string | null;
  totalFare: number;
  rideCount: number;
  walkCount: number;
  transfers: number;
  modeBreakdown: Record<string, number>;
};

export function sortSegments(segments: RouteSegment[]): RouteSegment[] {
  return [...segments].sort((a, b) => a.display_order - b.display_order);
}

export function buildTripSummary(route: Route, segments: RouteSegment[]): TripSummary {
  const sorted = sortSegments(segments);
  const modeBreakdown: Record<string, number> = {};
  let walkCount = 0;
  let rideCount = 0;

  for (const seg of sorted) {
    if (seg.transport_type.toLowerCase() === 'walk') {
      walkCount++;
    } else {
      rideCount++;
      modeBreakdown[seg.transport_type] = (modeBreakdown[seg.transport_type] || 0) + 1;
    }
  }

  return {
    duration: route.estimated_duration,
    totalFare: route.total_fare,
    rideCount,
    walkCount,
    transfers: Math.max(0, sorted.length - 1),
    modeBreakdown,
  };
}

export const TRANSPORT_EMOJI: Record<string, string> = {
  Jeep: '🚌',
  Bus: '🚌',
  LRT: '🚆',
  MRT: '🚇',
  'UV Express': '🚐',
  Tricycle: '🛺',
  Walk: '🚶',
};

export function modeLabel(type: string, count: number): string {
  const lower = type.toLowerCase();
  if (lower === 'walk') return count === 1 ? '1 walk' : `${count} walks`;
  if (lower === 'jeep') return count === 1 ? '1 jeep' : `${count} jeeps`;
  if (lower === 'tricycle') return count === 1 ? '1 trike' : `${count} trikes`;
  if (lower === 'bus') return count === 1 ? '1 bus' : `${count} buses`;
  if (lower === 'lrt') return count === 1 ? '1 train' : `${count} trains`;
  if (lower === 'mrt') return count === 1 ? '1 train' : `${count} trains`;
  if (lower === 'uv express') return count === 1 ? '1 UV' : `${count} UVs`;
  return count === 1 ? `1 ${type.toLowerCase()}` : `${count} ${type.toLowerCase()}s`;
}
