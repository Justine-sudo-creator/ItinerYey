import { Trip } from '@/types/supabase';

const ROADTRIP_KEYWORDS = ['drive', 'car', 'parking', 'toll', 'expressway', 'slex', 'nlex', 'tplex', 'gas', 'roadtrip', 'road trip', 'vehicle', 'highway'];
const FLIGHT_KEYWORDS = ['flight', 'airport', 'plane', 'terminal 3', 'terminal 1', 'terminal 2', 'terminal 4', 'ceb pac', 'airasia', 'philippine airlines', 'pal ', 'boarding', 'layover'];
const FERRY_KEYWORDS = ['ferry', 'boat', 'roro', 'port', 'bangka', 'oceanjet', 'supercat', 'pier', 'sailing', 'dock'];

const FOODIE_KEYWORDS = ['food', 'eat', 'cafe', 'restaurant', 'culinary', 'crawl', 'delicacy', 'lunch', 'dinner', 'buffet', 'snack', 'breakfast', 'canteen', 'dining', 'baker', 'coffee', 'starbucks', 'bistro'];
const ADVENTURE_KEYWORDS = ['hike', 'trek', 'dive', 'surf', 'atv', 'climb', 'falls', 'zipline', 'island hopping', 'snorkeling', 'camping', 'summit', 'trail', 'cave', 'rafting', 'kayak'];
const HISTORICAL_KEYWORDS = ['church', 'museum', 'history', 'heritage', 'shrine', 'ruins', 'historical', 'cultural', 'cathedral', 'plaza', 'monument', 'fort '];
const RELAXATION_KEYWORDS = ['spa', 'resort', 'hot spring', 'massage', 'relax', 'chill', 'pool', 'beach', 'staycation', 'glamping', 'retreat', 'sauna', 'jacuzzi'];
const KID_PET_KEYWORDS = ['kid', 'child', 'playground', 'pet', 'dog', 'cat', 'friendly', 'family-friendly', 'family friendly', 'pet-friendly', 'pet friendly'];

function textContainsKeywords(text: string, keywords: string[]): boolean {
  const lowercaseText = text.toLowerCase();
  return keywords.some(kw => lowercaseText.includes(kw));
}

function getTripSearchableText(trip: Trip): string {
  let text = '';
  if (trip.trip_summary) text += ' ' + trip.trip_summary;
  if (trip.trip_name) text += ' ' + trip.trip_name;
  if (trip.destination) text += ' ' + trip.destination;
  if (trip.tip) text += ' ' + trip.tip;
  if (trip.honest_warning) text += ' ' + trip.honest_warning;

  if (trip.trip_stops) {
    trip.trip_stops.forEach(stop => {
      text += ' ' + stop.stop_name;
      if (stop.stop_note) text += ' ' + stop.stop_note;
    });
  }

  if (trip.trip_days) {
    trip.trip_days.forEach(day => {
      if (day.activity) text += ' ' + day.activity;
    });
  }

  return text;
}

export function matchesTransportMode(trip: Trip, mode: string): boolean {
  const text = getTripSearchableText(trip);
  switch (mode) {
    case 'Roadtrip-Friendly':
      return textContainsKeywords(text, ROADTRIP_KEYWORDS);
    case 'Flight Required':
      return textContainsKeywords(text, FLIGHT_KEYWORDS);
    case 'Requires Ferry':
      return textContainsKeywords(text, FERRY_KEYWORDS);
    default:
      return false;
  }
}

export function matchesVibe(trip: Trip, vibe: string): boolean {
  const text = getTripSearchableText(trip);
  switch (vibe) {
    case 'Foodie':
      return textContainsKeywords(text, FOODIE_KEYWORDS);
    case 'Adventure':
      return textContainsKeywords(text, ADVENTURE_KEYWORDS);
    case 'Historical & Cultural':
      return textContainsKeywords(text, HISTORICAL_KEYWORDS);
    case 'Relaxation & Wellness':
      return textContainsKeywords(text, RELAXATION_KEYWORDS);
    case 'Kid / Pet Friendly':
      return textContainsKeywords(text, KID_PET_KEYWORDS);
    default:
      return false;
  }
}
