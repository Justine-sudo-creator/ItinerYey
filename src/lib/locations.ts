import { Trip } from '@/types/supabase';
import { NominatimResult } from '@/lib/nominatim';

const NEAR_MANILA_KEYWORDS = [
  'ncr', 'metro manila', 'manila', 'rizal', 'cavite', 'laguna', 'batangas', 
  'bulacan', 'pampanga', 'zambales', 'bataan', 'national capital region',
  'quezon city', 'makati', 'taguig', 'pasig', 'province of rizal',
  'calabarzon', 'region iv-a', 'central luzon'
];

const COMMUTE_FRIENDLY_KEYWORDS = [
  'ncr', 'metro manila', 'manila', 'rizal', 'cavite', 'laguna', 'bulacan', 'pampanga',
  'national capital region', 'quezon city', 'makati', 'taguig', 'pasig'
];

export function extractLocationRegion(addr: NominatimResult['address']): {
  city: string | null;
  province: string | null;
  country: string | null;
} {
  if (!addr) return { city: null, province: null, country: null };

  const city = addr.city || addr.town || addr.municipality || addr.village || addr.suburb || null;
  const province = addr.province || addr.state || addr.county || addr.region || null;
  const country = addr.country || null;

  return { city, province, country };
}

export function generatePlaceId(res: NominatimResult): string {
  if (res.osm_type && res.osm_id) {
    return `${res.osm_type}:${res.osm_id}`;
  }
  return res.place_id.toString();
}

export function isNearManilaTrip(trip: Trip): boolean {
  // Prefer structured fields
  if (trip.destination_province) {
    const p = trip.destination_province.toLowerCase();
    if (NEAR_MANILA_KEYWORDS.some(kw => p.includes(kw))) return true;
  }
  if (trip.destination_city) {
    const c = trip.destination_city.toLowerCase();
    if (NEAR_MANILA_KEYWORDS.some(kw => c.includes(kw))) return true;
  }

  // Fallback to text matching
  const dest = (trip.destination || '').toLowerCase();
  const destRegion = (trip.destination_region || '').toLowerCase();
  return NEAR_MANILA_KEYWORDS.some(kw => dest.includes(kw) || destRegion.includes(kw));
}

export function isCommuteFriendlyTrip(trip: Trip): boolean {
  if (trip.duration_days === 1) return true;

  if (trip.destination_province) {
    const p = trip.destination_province.toLowerCase();
    if (COMMUTE_FRIENDLY_KEYWORDS.some(kw => p.includes(kw))) return true;
  }
  if (trip.destination_city) {
    const c = trip.destination_city.toLowerCase();
    if (COMMUTE_FRIENDLY_KEYWORDS.some(kw => c.includes(kw))) return true;
  }

  const dest = (trip.destination || '').toLowerCase();
  const destRegion = (trip.destination_region || '').toLowerCase();
  return COMMUTE_FRIENDLY_KEYWORDS.some(kw => dest.includes(kw) || destRegion.includes(kw));
}

export function getRelatedTripScore(baseTrip: Trip, candidateTrip: Trip): number {
  if (baseTrip.id === candidateTrip.id) return -1; // Exclude self
  
  let score = 0;

  // 1. Exact place_id match
  if (baseTrip.destination_place_id && candidateTrip.destination_place_id && 
      baseTrip.destination_place_id === candidateTrip.destination_place_id) {
    score += 100;
  }

  // 2. Exact city match
  if (baseTrip.destination_city && candidateTrip.destination_city &&
      baseTrip.destination_city === candidateTrip.destination_city) {
    score += 50;
  }

  // 3. Exact province match
  if (baseTrip.destination_province && candidateTrip.destination_province &&
      baseTrip.destination_province === candidateTrip.destination_province) {
    score += 30;
  }

  // 4. Fallback matching
  if (baseTrip.destination.toLowerCase() === candidateTrip.destination.toLowerCase()) {
    score += 80;
  }
  
  if (baseTrip.destination_region.toLowerCase() === candidateTrip.destination_region.toLowerCase()) {
    score += 20;
  }

  // 5. Similar traits
  if (baseTrip.trip_type === candidateTrip.trip_type) score += 10;
  if (Math.abs(baseTrip.cost_per_person - candidateTrip.cost_per_person) < 2000) score += 5;
  if (baseTrip.duration_days === candidateTrip.duration_days) score += 5;

  return score;
}
