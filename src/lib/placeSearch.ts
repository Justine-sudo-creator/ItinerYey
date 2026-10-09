// Offline place-name resolver: matches free text ("SM North", "Cubao") against
// the stop names already in the route index, so no geocoding API is needed.

export interface Place {
  name: string;
  lat: number;
  lng: number;
  degree?: number;
}

export interface PlaceMatch<T extends Place = Place> {
  place: T;
  score: number;
}

// Common landmark names → the nearest station name used in the route index
const ALIASES: Record<string, string> = {
  'sm north': 'north avenue mrt',
  'sm north edsa': 'north avenue mrt',
  'trinoma': 'north avenue mrt',
  'quiapo': 'carriedo lrt',
  'quiapo church': 'carriedo lrt',
  'divisoria': 'tutuban pnr',
  'tutuban': 'tutuban pnr',
  'makati': 'ayala mrt',
  'ayala': 'ayala mrt',
  'ortigas': 'ortigas mrt',
  'megamall': 'ortigas mrt',
  'sm megamall': 'ortigas mrt',
  'shaw': 'shaw mrt',
  'ateneo': 'katipunan lrt',
  'katipunan': 'katipunan lrt',
  'ust': 'espana pnr',
  'la salle': 'vito cruz lrt',
  'dlsu': 'vito cruz lrt',
  'pup': 'pureza lrt',
  'recto': 'recto lrt',
  'cubao': 'cubao mrt',
  'baclaran': 'baclaran lrt',
  'monumento': 'monumento lrt',
  'taft': 'taft ave mrt',
  'edsa taft': 'taft ave mrt',
  'pasay': 'taft ave mrt',
};

const STOPWORDS = new Set([
  'sa', 'ng', 'ang', 'the', 'to', 'from', 'galing', 'papunta', 'station', 'stn', 'city', 'manila',
  'metro', 'intersection', 'st', 'ave', 'avenue', 'road', 'rd', 'street',
]);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(' ').filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/** 0–100 similarity between a query and a place/signboard name. */
export function nameScore(query: string, candidate: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const full = normalize(candidate);
  const head = normalize(candidate.split(',')[0]);

  if (head === q || full === q) return 100;
  const wordRe = new RegExp(`(^| )${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
  if (wordRe.test(head)) return 92 - Math.min(12, Math.max(0, head.length - q.length) / 3);
  if (wordRe.test(full)) return 80 - Math.min(15, Math.max(0, full.length - q.length) / 6);

  const qt = tokens(query);
  if (qt.length === 0) return 0;
  const ct = new Set(tokens(candidate));
  let hits = 0;
  for (const t of qt) {
    if (ct.has(t)) hits += 1;
    else if (t.length >= 4 && Array.from(ct).some(c => c.startsWith(t) || t.startsWith(c) && c.length >= 4)) hits += 0.6;
  }
  return Math.round((hits / qt.length) * 70);
}

export function searchPlaces<T extends Place>(query: string, places: T[], limit = 5): PlaceMatch<T>[] {
  const q = normalize(query);
  const variants = ALIASES[q] ? [ALIASES[q], q] : [q];

  const best = new Map<string, PlaceMatch<T>>();
  for (const place of places) {
    let score = 0;
    // The alias (first variant) wins ties over the raw query
    variants.forEach((v, i) => { score = Math.max(score, nameScore(v, place.name) + (i === 0 && variants.length > 1 ? 5 : 0)); });
    if (score < 40) continue;
    // Prefer well-connected hubs and shorter (more canonical) names on ties
    score += Math.min(6, (place.degree ?? 0) / 2) - Math.min(4, place.name.length / 40);
    const key = normalize(place.name.split(',')[0]);
    const prev = best.get(key);
    if (!prev || score > prev.score) best.set(key, { place, score });
  }

  return Array.from(best.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
