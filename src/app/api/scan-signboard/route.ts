import { NextRequest, NextResponse } from 'next/server';
import { VISION_MODEL, ollamaJson } from '@/lib/localAI';
import { loadOfflineSnapshot, type OfflineRoute } from '@/lib/offlineData';
import { nameScore, normalize, searchPlaces } from '@/lib/placeSearch';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const READ_PROMPT = `This photo shows a Philippine public transport vehicle (jeepney, bus, UV Express, tricycle) or its route signboard.
Read the route signboard text exactly as written. List each place name on it separately (e.g. "CUBAO", "QUIAPO", "VIA AURORA").
Also say what kind of vehicle it is if visible. Return JSON only.`;

const READ_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    places: { type: 'array', items: { type: 'string' } },
    vehicle: { type: ['string', 'null'] },
  },
  required: ['text', 'places', 'vehicle'],
};

interface SignboardRead { text: string; places: string[]; vehicle: string | null }

function vehicleBonus(vehicle: string | null, transportType: string): number {
  if (!vehicle) return 0;
  const v = normalize(vehicle);
  const t = normalize(transportType);
  if (v.includes('jeep') && t.includes('jeep')) return 8;
  if (v.includes('bus') && t.includes('bus')) return 8;
  if ((v.includes('uv') || v.includes('van')) && t.includes('uv')) return 8;
  return 0;
}

function scoreRoute(read: SignboardRead, route: OfflineRoute): number {
  const labels = [route.signboard ?? '', route.origin, route.destination].filter(Boolean);
  const places = read.places
    .map(p => p.replace(/^via\s+/i, '').trim())
    .filter(p => normalize(p).length >= 3);
  if (places.length === 0) return nameScore(read.text, labels.join(' '));

  let total = 0;
  let strong = 0;
  for (const p of places) {
    const best = Math.max(...labels.map(l => nameScore(p, l)));
    total += best;
    if (best >= 70) strong++;
  }
  return total / places.length + strong * 5 + vehicleBonus(read.vehicle, route.transportType) + viaBonus(read.text, route.signboard);
}

/** Signboards often differ only by "via X" — reward the one whose via matches what was read. */
function viaBonus(text: string, signboard: string | null): number {
  const via = signboard?.match(/\bvia\s+(.+)$/i)?.[1];
  if (!via) return 0;
  const squash = (s: string) => normalize(s).replace(/\s+/g, '');
  return squash(text).includes(squash(via).slice(0, 8)) ? 10 : 0;
}

function routeStops(route: OfflineRoute) {
  const stops: { name: string; lat: number; lng: number; fareFromStart: number; index: number }[] = [];
  let fare = 0;
  route.segments.forEach((s, i) => {
    if (i === 0 && s.boarding_lat != null && s.boarding_lng != null) {
      stops.push({ name: s.boarding_name ?? 'Stop', lat: s.boarding_lat, lng: s.boarding_lng, fareFromStart: 0, index: 0 });
    }
    fare += s.fare;
    if (s.drop_off_lat != null && s.drop_off_lng != null) {
      stops.push({ name: s.drop_off_name ?? 'Stop', lat: s.drop_off_lat, lng: s.drop_off_lng, fareFromStart: fare, index: i + 1 });
    }
  });
  return stops;
}

export async function POST(request: NextRequest) {
  let image = '';
  let destination = '';
  try {
    ({ image, destination = '' } = await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }
  const base64 = (image ?? '').replace(/^data:image\/[a-z+]+;base64,/, '');
  if (!base64) {
    return NextResponse.json({ success: false, error: 'No image provided.' }, { status: 400 });
  }

  // 1. Read the signboard with the on-device vision model
  let read: SignboardRead;
  let visionMs = 0;
  try {
    const { data, durationMs } = await ollamaJson<SignboardRead>({
      model: VISION_MODEL,
      format: READ_SCHEMA,
      temperature: 0,
      timeoutMs: 180_000,
      messages: [{ role: 'user', content: READ_PROMPT, images: [base64] }],
    });
    read = { text: data.text ?? '', places: data.places ?? [], vehicle: data.vehicle ?? null };
    visionMs = durationMs;
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: `Local vision model unavailable (${VISION_MODEL}). Is Ollama running? ${(err as Error).message}`,
    }, { status: 503 });
  }

  // 2. Match what was read against the on-device route index
  const t0 = Date.now();
  const snapshot = loadOfflineSnapshot();
  const seen = new Set<string>();
  const ranked = snapshot.routes
    .map(route => ({ route, score: scoreRoute(read, route) }))
    .filter(r => r.score >= 55)
    .sort((a, b) => b.score - a.score)
    .filter(({ route }) => {
      const key = `${route.transportType}|${normalize(route.signboard ?? route.origin + route.destination)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);

  const matches = ranked.map(({ route, score }) => {
    const stops = routeStops(route);
    let passesThrough: { stopName: string; stopsAway: number; fareFromStart: number } | null = null;
    if (destination.trim()) {
      const [hit] = searchPlaces(destination, stops, 1);
      if (hit && hit.score >= 60) {
        passesThrough = { stopName: hit.place.name, stopsAway: hit.place.index, fareFromStart: hit.place.fareFromStart };
      } else if (stops.length > 0 && nameScore(destination, route.destination) >= 70) {
        const last = stops[stops.length - 1];
        passesThrough = { stopName: `${route.destination} (terminal)`, stopsAway: last.index, fareFromStart: last.fareFromStart };
      }
    }
    return {
      routeId: route.id,
      signboard: route.signboard,
      transportType: route.transportType,
      origin: route.origin,
      destination: route.destination,
      totalFare: route.totalFare,
      stopCount: stops.length,
      firstStop: stops[0]?.name ?? null,
      lastStop: stops[stops.length - 1]?.name ?? null,
      score: Math.round(score),
      passesThrough,
    };
  });

  return NextResponse.json({
    success: true,
    read,
    matches,
    destination: destination.trim() || null,
    linkable: snapshot.source === 'supabase',
    ai: { model: VISION_MODEL, visionMs, matchMs: Date.now() - t0 },
  });
}
