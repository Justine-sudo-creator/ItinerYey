import { NextRequest, NextResponse } from 'next/server';
import { findRoute, getTransitStops } from '@/lib/routingEngine';
import { searchPlaces } from '@/lib/placeSearch';
import { CHAT_MODEL, VISION_MODEL, ollamaChat, ollamaJson, ollamaStatus } from '@/lib/localAI';
import { isOfflineMode, loadOfflineSnapshot } from '@/lib/offlineData';
import type { JourneyLeg, RoutingResult } from '@/types/routing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── GET /api/assistant — local AI + offline data health check ───────────────

export async function GET() {
  const status = await ollamaStatus();
  let snapshot: { generatedAt: string; source: string; routes: number; segments: number } | null = null;
  try {
    const s = loadOfflineSnapshot();
    snapshot = { generatedAt: s.generatedAt, source: s.source, routes: s.routes.length, segments: s.segments.length };
  } catch {
    snapshot = null;
  }
  const has = (m: string) => status.models.some(n => n === m || n === `${m}:latest`);
  return NextResponse.json({
    ollama: status.ok,
    chatModel: CHAT_MODEL,
    visionModel: VISION_MODEL,
    chatModelReady: has(CHAT_MODEL),
    visionModelReady: has(VISION_MODEL),
    offlineMode: isOfflineMode(),
    snapshot,
  });
}

// ─── POST /api/assistant { message } ──────────────────────────────────────────

const EXTRACT_SYSTEM = `You extract the commute ORIGIN and DESTINATION from a Filipino commuter's message.
Messages may be in Tagalog, English or Taglish. "galing/mula sa X" = origin X. "papunta/pupunta sa Y", "to Y" = destination Y.
Return only the place names as written (no extra words like "sa", "station"). Use null for anything not mentioned.
Examples:
"paano pumunta sa SM North galing Cubao?" -> {"origin":"Cubao","destination":"SM North"}
"From Baclaran to Monumento" -> {"origin":"Baclaran","destination":"Monumento"}
"Quiapo papuntang Fairview, magkano?" -> {"origin":"Quiapo","destination":"Fairview"}
"Pa-Divisoria ako" -> {"origin":null,"destination":"Divisoria"}`;

const EXTRACT_SCHEMA = {
  type: 'object',
  properties: {
    origin: { type: ['string', 'null'] },
    destination: { type: ['string', 'null'] },
    language: { type: 'string', enum: ['tagalog', 'english'] },
  },
  required: ['origin', 'destination', 'language'],
};

/** Optional: let the local LLM re-phrase the directions (needs a strong model, e.g. qwen2.5:7b). */
const LLM_REPHRASE = process.env.ASSISTANT_REPHRASE === '1';

const EXPLAIN_SYSTEM = `You are ItinerYey, a friendly offline commute buddy for Filipino commuters.
Rewrite the given route steps as short, clear directions in the SAME language style as the commuter's question (Tagalog, English, or Taglish).
STRICT RULES:
- Write exactly one numbered line per fact step, in the same order, then one final line with the total.
- Use ONLY the facts given. Copy every place name, signboard, vehicle type, fare (₱) and time exactly.
- The last stop in the facts IS the destination. Never add walking, extra steps, landmarks, fares, times or tips.
- If the question is in Tagalog/Taglish, answer in natural Taglish (e.g. "Sumakay ng...", "Bumaba sa...").`;

/** Reject LLM output that mentions any number not present in the grounded facts. */
function isGrounded(reply: string, facts: string, stepCount: number): boolean {
  const allowed = new Set(facts.match(/\d+/g) ?? []);
  for (let i = 1; i <= stepCount + 1; i++) allowed.add(String(i));
  return (reply.match(/\d+/g) ?? []).every(n => allowed.has(n));
}

interface Extracted { origin: string | null; destination: string | null; language?: 'tagalog' | 'english' }

const TAGALOG_HINT = /\b(paano|pumunta|pupunta|papunta|papuntang|galing|mula|sa|ng|ako|magkano|saan|bababa|sasakay)\b/i;

/** Small models sometimes leak junk tokens into JSON strings; keep only a place that the user actually typed. */
function cleanPlace(place: string | null | undefined, message: string): string | null {
  if (!place) return null;
  const cut = place.split(/['"{}<>\n]/)[0].replace(/[?.!,]+$/, '').trim();
  if (cut.length < 2) return null;
  const firstWord = cut.toLowerCase().split(/\s+/)[0];
  return message.toLowerCase().includes(firstWord) ? cut : null;
}

function regexExtract(message: string): Extracted {
  const m = message.trim()
    .replace(/[,;]?\s*\b(magkano|how much|ilan|gaano|pls|please)\b.*$/i, '')
    .replace(/[?.!,]+$/, '');
  const fromTo = m.match(/(?:galing|from|mula)\s+(?:sa\s+)?(.+?)\s+(?:papunta(?:ng)?|pupunta|to|hanggang|going to)\s+(?:sa\s+)?(.+)$/i);
  if (fromTo) return { origin: fromTo[1], destination: fromTo[2] };
  const toFrom = m.match(/(?:papunta(?:ng)?|pumunta|pupunta|to|go to)\s+(?:sa\s+)?(.+?)\s+(?:galing|from|mula)\s+(?:sa\s+)?(.+)$/i);
  if (toFrom) return { origin: toFrom[2], destination: toFrom[1] };
  const ab = m.match(/^(.+?)\s+(?:to|papuntang|-)\s+(.+)$/i);
  if (ab) return { origin: ab[1], destination: ab[2] };
  return { origin: null, destination: null };
}

function legLines(route: RoutingResult, tagalog: boolean): string {
  const lines = route.legs.map((leg: JourneyLeg, i: number) => {
    if (leg.type === 'walking') {
      return tagalog
        ? `${i + 1}. Maglakad ng ${leg.distanceMeters} m mula ${leg.from.name} papunta sa ${leg.to.name} (~${leg.timeMinutes} mins).`
        : `${i + 1}. Walk ${leg.distanceMeters} m from ${leg.from.name} to ${leg.to.name} (~${leg.timeMinutes} mins).`;
    }
    const first = leg.stops[0]?.name;
    const last = leg.stops[leg.stops.length - 1]?.name;
    const sign = leg.signboard ? ` "${leg.signboard}"` : '';
    const stops = leg.stops.length - 1;
    return tagalog
      ? `${i + 1}. Sumakay ng ${leg.transportType}${sign} sa ${first}. Bumaba sa ${last} (${stops} stops, ₱${leg.totalFare}, ~${leg.totalTimeMinutes} mins).`
      : `${i + 1}. Take the ${leg.transportType}${sign} at ${first}. Get off at ${last} (${stops} stops, ₱${leg.totalFare}, ~${leg.totalTimeMinutes} mins).`;
  });
  lines.push(tagalog
    ? `Kabuuan: mga ₱${route.totalFare}, ~${route.totalTimeMinutes} mins.`
    : `Total: about ₱${route.totalFare}, ~${route.totalTimeMinutes} mins.`);
  return lines.join('\n');
}

function legFacts(route: RoutingResult): string {
  const lines = route.legs.map((leg: JourneyLeg, i: number) => {
    if (leg.type === 'walking') {
      return `${i + 1}. Walk ${leg.distanceMeters} m from "${leg.from.name}" to "${leg.to.name}" (~${leg.timeMinutes} mins).`;
    }
    const first = leg.stops[0]?.name;
    const last = leg.stops[leg.stops.length - 1]?.name;
    const sign = leg.signboard ? ` with signboard "${leg.signboard}"` : '';
    return `${i + 1}. Ride ${leg.transportType}${sign} from "${first}" and get off at "${last}" ` +
      `(${leg.stops.length - 1} stops, ₱${leg.totalFare}, ~${leg.totalTimeMinutes} mins).`;
  });
  lines.push(`Total: about ₱${route.totalFare} and ~${route.totalTimeMinutes} mins.`);
  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  let message = '';
  try {
    ({ message } = await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!message?.trim()) {
    return NextResponse.json({ success: false, error: 'Ask me something like "Paano pumunta sa Quiapo galing Cubao?"' }, { status: 400 });
  }

  const timings: Record<string, number> = {};
  let aiUsed = false;
  let aiError: string | null = null;

  // 1. Understand the question (local LLM, regex fallback)
  let extracted: Extracted = { origin: null, destination: null };
  try {
    const { data, durationMs } = await ollamaJson<Extracted>({
      model: CHAT_MODEL,
      format: EXTRACT_SCHEMA,
      temperature: 0,
      messages: [
        { role: 'system', content: EXTRACT_SYSTEM },
        { role: 'user', content: message },
      ],
    });
    extracted = {
      origin: cleanPlace(data.origin, message),
      destination: cleanPlace(data.destination, message),
      language: data.language,
    };
    timings.understandMs = durationMs;
    aiUsed = true;
  } catch (err) {
    aiError = (err as Error).message;
  }
  if (!extracted.origin || !extracted.destination) {
    const fallback = regexExtract(message);
    extracted = {
      origin: extracted.origin || cleanPlace(fallback.origin, message),
      destination: extracted.destination || cleanPlace(fallback.destination, message),
      language: extracted.language,
    };
  }

  if (!extracted.origin || !extracted.destination) {
    return NextResponse.json({
      success: false,
      reply: !extracted.origin && extracted.destination
        ? `Saan ka manggagaling papuntang ${extracted.destination}? Halimbawa: "galing Cubao papuntang ${extracted.destination}".`
        : 'Saan ka manggagaling at saan ka pupunta? Halimbawa: "Paano pumunta sa Quiapo galing Cubao?"',
      extracted,
      ai: { used: aiUsed, model: CHAT_MODEL, error: aiError, timings },
    });
  }

  // 2. Resolve place names against the local stop directory
  const t0 = Date.now();
  const { stops } = await getTransitStops();
  const [originMatch] = searchPlaces(extracted.origin, stops, 1);
  const [destMatch] = searchPlaces(extracted.destination, stops, 1);
  timings.placesMs = Date.now() - t0;

  const missing = [!originMatch && extracted.origin, !destMatch && extracted.destination].filter(Boolean);
  if (missing.length > 0) {
    return NextResponse.json({
      success: false,
      reply: `Hindi ko mahanap ang ${missing.map(m => `"${m}"`).join(' at ')} sa offline route map. Subukan ang mas kilalang landmark o istasyon.`,
      extracted,
      ai: { used: aiUsed, model: CHAT_MODEL, error: aiError, timings },
    });
  }

  // 3. Plan with the A* engine (grounded data — never the LLM)
  const t1 = Date.now();
  const route = await findRoute({
    startLat: originMatch.place.lat, startLng: originMatch.place.lng,
    endLat: destMatch.place.lat, endLng: destMatch.place.lng,
  });
  timings.routeMs = Date.now() - t1;

  const origin = { query: extracted.origin, name: originMatch.place.name, lat: originMatch.place.lat, lng: originMatch.place.lng };
  const destination = { query: extracted.destination, name: destMatch.place.name, lat: destMatch.place.lat, lng: destMatch.place.lng };

  if (!route.success) {
    return NextResponse.json({
      success: false,
      reply: `Wala akong nahanap na ruta mula ${origin.name} papuntang ${destination.name}. (${route.error})`,
      extracted, origin, destination,
      ai: { used: aiUsed, model: CHAT_MODEL, error: aiError, timings },
    });
  }

  // 4. Directions in the commuter's language — built from planner output so
  //    fares and stops are never hallucinated; optional LLM re-phrasing.
  const tagalog = extracted.language === 'tagalog' || TAGALOG_HINT.test(message);
  const facts = legFacts(route);
  let reply = legLines(route, tagalog);
  if (LLM_REPHRASE) try {
    const { content, durationMs } = await ollamaChat({
      model: CHAT_MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: EXPLAIN_SYSTEM },
        { role: 'user', content: `Commuter's question: ${message}\n\nRoute facts:\n${facts}` },
      ],
    });
    if (content.trim() && isGrounded(content, facts, route.legs.length)) {
      reply = content.trim();
      aiUsed = true;
    } else {
      aiError = 'Local model answer contained unverified details; showing the planner output instead.';
    }
    timings.explainMs = durationMs;
  } catch (err) {
    aiError = (err as Error).message;
  }

  timings.totalMs = Date.now() - started;

  return NextResponse.json({
    success: true,
    reply,
    facts,
    extracted, origin, destination,
    route,
    ai: { used: aiUsed, model: CHAT_MODEL, error: aiError, timings },
  });
}
