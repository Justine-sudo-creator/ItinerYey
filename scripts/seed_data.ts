/**
 * scripts/seed_data.ts
 *
 * ItinerYey — Full Database Seed Script
 * ──────────────────────────────────────
 * Parses real Sakay.ph GTFS data from scratch/gtfs/ and seeds:
 *   • public.users        (7 mock Filipino commuter profiles)
 *   • public.routes       (parsed from GTFS routes.txt)
 *   • public.route_segments (parsed from stop_times.txt + stops.txt)
 *   • public.route_verifications (mock, triggers confidence score recalc)
 *   • public.businesses   (5 mock PH business listings)
 *   • public.user_badges  (3 admin badges)
 *   • public.notifications (welcome messages per user)
 *
 * Run: npx tsx scripts/seed_data.ts
 *
 * Prerequisites:
 *   • scratch/gtfs/routes.txt
 *   • scratch/gtfs/trips.txt
 *   • scratch/gtfs/stops.txt
 *   • scratch/gtfs/stop_times.txt
 *   • SUPABASE_SERVICE_ROLE_KEY set in .env.local
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const csv = require('csv-parser') as typeof import('csv-parser');

// ─── Env & Supabase client ────────────────────────────────────────────────────

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── GTFS file paths ──────────────────────────────────────────────────────────

const GTFS_DIR    = path.resolve('scratch/gtfs');
const ROUTES_FILE = path.join(GTFS_DIR, 'routes.txt');
const TRIPS_FILE  = path.join(GTFS_DIR, 'trips.txt');
const STOPS_FILE  = path.join(GTFS_DIR, 'stops.txt');
const TIMES_FILE  = path.join(GTFS_DIR, 'stop_times.txt');

function assertFileExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌  GTFS file not found: ${filePath}`);
    console.error('    Please place routes.txt, trips.txt, stops.txt, stop_times.txt inside scratch/gtfs/');
    process.exit(1);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TransportType = 'Jeep' | 'Bus' | 'LRT' | 'MRT' | 'UV Express' | 'Tricycle' | 'Walk';

interface StopMeta {
  stop_name: string;
  stop_lat:  number;
  stop_lon:  number;
}

interface GtfsRoute {
  route_id:        string;
  agency_id:       string;
  route_short_name:string;
  route_long_name: string;
  route_type:      number;
}

interface TripRow {
  route_id: string;
  trip_id:  string;
}

interface StopTimeRow {
  trip_id:       string;
  stop_sequence: number;
  stop_id:       string;
}

// ─── Utility: stream a CSV into an array ──────────────────────────────────────

function streamCsv<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const rows: T[] = [];
    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim().replace(/^"|"$/g, '') }))
      .on('data', (row: any) => {
        // Strip surrounding quotes from values (some GTFS files double-quote everything)
        const cleaned: any = {};
        for (const key of Object.keys(row)) {
          const val = String(row[key] ?? '').trim().replace(/^"|"$/g, '');
          cleaned[key] = val;
        }
        rows.push(cleaned as T);
      })
      .on('end',   () => resolve(rows))
      .on('error', reject);
  });
}

// ─── Transport type resolver ──────────────────────────────────────────────────
// Uses agency_id + route_id prefix + route_long_name keywords.
// In this GTFS feed:
//   agency LRTA  → LRT
//   agency MRTC  → MRT
//   agency PNR   → MRT (rail)
//   LTFRB_PUB### → Bus
//   LTFRB_PUJ### → Jeep
//   FORT_*       → UV Express (BGC internal shuttles)

function resolveTransportType(route: GtfsRoute): TransportType {
  const agency = route.agency_id.toUpperCase();
  const routeId = route.route_id.toUpperCase();
  const name    = route.route_long_name.toUpperCase();

  if (agency === 'LRTA')                          return 'LRT';
  if (agency === 'MRTC' || agency === 'PNR')      return 'MRT';
  if (agency === 'FORT')                          return 'UV Express';
  if (routeId.includes('_PUJ'))                  return 'Jeep';
  if (routeId.includes('_PUB'))                  return 'Bus';

  // Keyword fallback on route_long_name
  if (name.includes('UV') || name.includes('FX') || name.includes('P2P')) return 'UV Express';
  if (name.includes('JEEP') || name.includes('PUJ'))                       return 'Jeep';
  if (name.includes('LRT'))                                                 return 'LRT';
  if (name.includes('MRT'))                                                 return 'MRT';

  // Numeric route_type fallback
  if (route.route_type === 0)                    return 'LRT';
  if (route.route_type === 1 || route.route_type === 2) return 'MRT';

  return 'Bus'; // safe default
}

// ─── Origin / destination splitter ───────────────────────────────────────────
// Handles: "Fairview - Cubao", "Recto - Santolan", "Alabang (Starmall) Lagro"
// The route_desc contains the full address strings separated by " - "

function splitOriginDestination(longName: string, desc: string): { origin: string; destination: string } {
  // Prefer route_desc which contains explicit "A - B" address pairs
  const source = desc && desc.trim().length > 0 ? desc.trim() : longName.trim();

  const delimiters = [' - ', ' to ', ' / ', '–', '—'];
  for (const delim of delimiters) {
    const idx = source.indexOf(delim);
    if (idx !== -1 && idx > 0 && idx < source.length - delim.length) {
      // Trim to a reasonable display length (the desc can be very long addresses)
      let origin      = source.slice(0, idx).trim();
      let destination = source.slice(idx + delim.length).trim();

      // Shorten to the first meaningful segment (before the first comma)
      const truncate = (s: string) => {
        const comma = s.indexOf(',');
        return comma > 10 ? s.slice(0, comma).trim() : s;
      };

      // If using desc (long addresses), truncate for readability
      if (source === desc) {
        origin      = truncate(origin);
        destination = truncate(destination);
      }

      return { origin, destination };
    }
  }

  // No delimiter found — use long_name as both (e.g., single-terminal routes)
  const clean = longName.trim();
  return { origin: clean, destination: clean };
}

// ─── Haversine distance (km) ──────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── 2026 LTFRB fare matrix ───────────────────────────────────────────────────

function computeFare(type: TransportType, distanceKm: number): number {
  switch (type) {
    case 'Jeep': {
      const extra = Math.max(0, distanceKm - 4);
      return Math.round(14 + extra * 2.0);
    }
    case 'Bus': {
      const extra = Math.max(0, distanceKm - 5);
      return Math.round(15 + extra * 2.65);
    }
    case 'UV Express': {
      const extra = Math.max(0, distanceKm - 5);
      return Math.round(18 + extra * 3.0);
    }
    case 'LRT':
      return Math.min(Math.round(11 + distanceKm * 1.5), 30);
    case 'MRT':
      return Math.min(Math.round(13 + distanceKm * 2.0), 28);
    case 'Walk':
    case 'Tricycle':
      return 0;
    default:
      return 15;
  }
}

// ─── Mock Users ───────────────────────────────────────────────────────────────

const MOCK_USERS = [
  {
    email:               'maria@demo.com',
    password:            'Password123!',
    display_name:        'Maria Santos',
    region:              'Metro Manila',
    travel_style:        'Backpacker',
    typical_budget:      'Budget',
    bio:                 'Commuter since birth. I know every jeep route in QC by heart.',
    social_link:         'https://facebook.com/mariasantos.demo',
    is_wallet_verified:  true,
    is_verified_organizer: false,
    vouch_count:         5,
    total_vouches:       5,
    has_contributed:     true,
    hosting_credits:     2,
  },
  {
    email:               'juan@demo.com',
    password:            'Password123!',
    display_name:        'Juan dela Cruz',
    region:              'Metro Manila',
    travel_style:        'Explorer',
    typical_budget:      'Budget',
    bio:                 'Weekend hiker, everyday MRT warrior. Top contributor badge holder.',
    social_link:         'https://facebook.com/juandelacruz.demo',
    is_wallet_verified:  false,
    is_verified_organizer: true,
    vouch_count:         8,
    total_vouches:       8,
    has_contributed:     true,
    hosting_credits:     0,
  },
  {
    email:               'ana@demo.com',
    password:            'Password123!',
    display_name:        'Ana Reyes',
    region:              'North & Central Luzon',
    travel_style:        'Budget',
    typical_budget:      'Budget',
    bio:                 'Pampanga to Manila commuter. Jeepney is life.',
    social_link:         null,
    is_wallet_verified:  false,
    is_verified_organizer: false,
    vouch_count:         2,
    total_vouches:       2,
    has_contributed:     false,
    hosting_credits:     0,
  },
  {
    email:               'carlo@demo.com',
    password:            'Password123!',
    display_name:        'Carlo Mendoza',
    region:              'Metro Manila',
    travel_style:        'Backpacker',
    typical_budget:      'Mid-range',
    bio:                 'BGC to Makati to Ortigas — I commute the triangle daily.',
    social_link:         'https://facebook.com/carlomendoza.demo',
    is_wallet_verified:  false,
    is_verified_organizer: true,
    vouch_count:         3,
    total_vouches:       3,
    has_contributed:     true,
    hosting_credits:     1,
  },
  {
    email:               'bea@demo.com',
    password:            'Password123!',
    display_name:        'Bea Villanueva',
    region:              'Visayas',
    travel_style:        'Explorer',
    typical_budget:      'Budget',
    bio:                 'Cebu-raised, Manila-based. Still figuring out EDSA.',
    social_link:         null,
    is_wallet_verified:  false,
    is_verified_organizer: false,
    vouch_count:         1,
    total_vouches:       1,
    has_contributed:     false,
    hosting_credits:     0,
  },
  {
    email:               'rico@demo.com',
    password:            'Password123!',
    display_name:        'Rico Aquino',
    region:              'Metro Manila',
    travel_style:        'Budget',
    typical_budget:      'Budget',
    bio:                 'Pasay to Pasig everyday. UV Express or bust.',
    social_link:         null,
    is_wallet_verified:  false,
    is_verified_organizer: false,
    vouch_count:         0,
    total_vouches:       0,
    has_contributed:     false,
    hosting_credits:     0,
  },
  {
    email:               'liza@demo.com',
    password:            'Password123!',
    display_name:        'Liza Fernandez',
    region:              'South Luzon & Bicol',
    travel_style:        'Explorer',
    typical_budget:      'Mid-range',
    bio:                 'Laguna girl living the Manila commuter dream (or nightmare).',
    social_link:         'https://facebook.com/lizafernandez.demo',
    is_wallet_verified:  true,
    is_verified_organizer: false,
    vouch_count:         4,
    total_vouches:       4,
    has_contributed:     true,
    hosting_credits:     0,
  },
] as const;

// ─── Mock Businesses ──────────────────────────────────────────────────────────

const MOCK_BUSINESSES = [
  {
    business_name: 'Jollibee Cubao Farmers',
    destination:   'Cubao, Quezon City',
    business_type: 'Food & Dining',
    price_range:   '₱',
    contact:       '+63 2 8911 1111',
    description:   'The original Filipino fast food giant. Perfect merienda stop after the MRT ride.',
    is_featured:   false,
  },
  {
    business_name: 'SM City North EDSA',
    destination:   'North EDSA, Quezon City',
    business_type: 'Shopping Mall',
    price_range:   '₱₱',
    contact:       '+63 2 8924 5800',
    description:   'One of the largest malls in the Philippines. Major transport hub and shopping destination.',
    is_featured:   true,
    feature_start: new Date().toISOString(),
    feature_end:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    business_name: 'Mang Inasal Divisoria',
    destination:   'Divisoria, Manila',
    business_type: 'Food & Dining',
    price_range:   '₱',
    contact:       '+63 2 8251 0000',
    description:   'Unlimited rice chicken inasal — the commuter\'s comfort food after crossing Divisoria.',
    is_featured:   false,
  },
  {
    business_name: 'KidZania Manila',
    destination:   'BGC, Taguig',
    business_type: 'Entertainment',
    price_range:   '₱₱₱',
    contact:       '+63 2 7798 8888',
    description:   'Edutainment hub inside Bonifacio High Street. Great family destination at the end of your BGC commute.',
    is_featured:   false,
  },
  {
    business_name: 'Robinsons Galleria',
    destination:   'Ortigas, Pasig',
    business_type: 'Shopping Mall',
    price_range:   '₱₱',
    contact:       '+63 2 8633 9999',
    description:   'Ortigas\' central mall connected directly to the EDSA corridor. Cinema, dining, and retail all in one.',
    is_featured:   false,
  },
];

// ─── Step 1: Seed users ───────────────────────────────────────────────────────

async function seedUsers(): Promise<Record<string, string>> {
  console.log('\n👤  Seeding users...');
  const emailToId: Record<string, string> = {};

  for (const user of MOCK_USERS) {
    // Try creating the auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email:             user.email,
      password:          user.password,
      email_confirm:     true,
    });

    let userId: string;

    if (authError) {
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        // User already exists — fetch their ID
        const { data: list } = await supabase.auth.admin.listUsers();
        const existing = list?.users?.find((u) => u.email === user.email);
        if (!existing) {
          console.warn(`  ⚠️  Could not resolve existing user ${user.email}, skipping.`);
          continue;
        }
        userId = existing.id;
        console.log(`  ↩️  User already exists: ${user.display_name} (${user.email})`);
      } else {
        console.error(`  ❌  Auth error for ${user.email}:`, authError.message);
        continue;
      }
    } else {
      userId = authData.user.id;
      console.log(`  ✅  Auth created: ${user.display_name} (${user.email})`);
    }

    emailToId[user.email] = userId;

    // Upsert into public.users
    const { error: profileError } = await supabase.from('users').upsert(
      {
        id:                   userId,
        email:                user.email,
        display_name:         user.display_name,
        region:               user.region,
        travel_style:         user.travel_style,
        typical_budget:       user.typical_budget,
        bio:                  user.bio,
        social_link:          user.social_link ?? null,
        is_wallet_verified:   user.is_wallet_verified,
        is_verified_organizer:user.is_verified_organizer,
        vouch_count:          user.vouch_count,
        total_vouches:        user.total_vouches,
        has_contributed:      user.has_contributed,
        hosting_credits:      user.hosting_credits,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      console.error(`  ❌  Profile upsert error for ${user.email}:`, profileError.message);
    } else {
      console.log(`  ✅  Profile upserted: ${user.display_name}`);
    }
  }

  return emailToId;
}

// ─── Step 2: Parse GTFS files ─────────────────────────────────────────────────

async function parseGtfs() {
  console.log('\n📂  Parsing GTFS files from scratch/gtfs/...');

  // 2a. stops.txt → stopMap
  console.log('  📍 Parsing stops.txt...');
  const rawStops = await streamCsv<{
    stop_id: string; stop_name: string; stop_lat: string; stop_lon: string;
  }>(STOPS_FILE);

  const stopMap = new Map<string, StopMeta>();
  for (const s of rawStops) {
    const lat = parseFloat(s.stop_lat);
    const lon = parseFloat(s.stop_lon);
    if (!isNaN(lat) && !isNaN(lon)) {
      stopMap.set(s.stop_id, { stop_name: s.stop_name, stop_lat: lat, stop_lon: lon });
    }
  }
  console.log(`     → ${stopMap.size} stops loaded`);

  // 2b. routes.txt → routeMetaMap
  console.log('  🗺️  Parsing routes.txt...');
  const rawRoutes = await streamCsv<{
    route_id: string; agency_id: string; route_short_name: string;
    route_long_name: string; route_desc: string; route_type: string;
  }>(ROUTES_FILE);

  const routeMetaMap = new Map<string, GtfsRoute & { route_desc: string }>();
  for (const r of rawRoutes) {
    routeMetaMap.set(r.route_id, {
      route_id:         r.route_id,
      agency_id:        r.agency_id,
      route_short_name: r.route_short_name,
      route_long_name:  r.route_long_name,
      route_type:       parseInt(r.route_type, 10) || 3,
      route_desc:       r.route_desc,
    });
  }
  console.log(`     → ${routeMetaMap.size} routes loaded`);

  // 2c. trips.txt → routeToFirstTrip (one representative trip per route)
  console.log('  🚌  Parsing trips.txt...');
  const rawTrips = await streamCsv<{
    route_id: string; trip_id: string;
  }>(TRIPS_FILE);

  const routeToFirstTrip = new Map<string, string>();
  for (const t of rawTrips) {
    if (!routeToFirstTrip.has(t.route_id)) {
      routeToFirstTrip.set(t.route_id, String(t.trip_id));
    }
  }
  console.log(`     → ${routeToFirstTrip.size} representative trips selected`);

  // Build a Set of trip IDs we actually need (one per route) to filter stop_times
  const neededTripIds = new Set(routeToFirstTrip.values());

  // 2d. stop_times.txt → tripStops (only for needed trips)
  console.log('  ⏱️  Parsing stop_times.txt (streaming, filtered)...');
  const tripStops = new Map<string, { stop_id: string; stop_sequence: number }[]>();
  let timesTotal = 0;

  await new Promise<void>((resolve, reject) => {
    fs.createReadStream(TIMES_FILE)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim().replace(/^"|"$/g, '') }))
      .on('data', (row: any) => {
        const tripId = String(row.trip_id ?? '').trim().replace(/^"|"$/g, '');
        if (!neededTripIds.has(tripId)) return; // skip unneeded trips early

        const stopId  = String(row.stop_id ?? '').trim().replace(/^"|"$/g, '');
        const seq     = parseInt(String(row.stop_sequence ?? '0'), 10);

        if (!tripStops.has(tripId)) tripStops.set(tripId, []);
        tripStops.get(tripId)!.push({ stop_id: stopId, stop_sequence: seq });
        timesTotal++;
      })
      .on('end', () => {
        // Sort each trip's stops by sequence
        Array.from(tripStops.values()).forEach((stops) => {
          stops.sort((a, b) => a.stop_sequence - b.stop_sequence);
        });
        resolve();
      })
      .on('error', reject);
  });
  console.log(`     → ${timesTotal} stop-time rows loaded for ${tripStops.size} trips`);

  return { stopMap, routeMetaMap, routeToFirstTrip, tripStops };
}

// ─── Step 3: Seed routes + segments ──────────────────────────────────────────

const MAX_STOPS_PER_ROUTE = 30; // guard rail: truncate very long routes
const SEGMENT_BATCH_SIZE  = 500;

async function seedRoutesAndSegments(
  emailToId: Record<string, string>,
  stopMap: Map<string, StopMeta>,
  routeMetaMap: Map<string, GtfsRoute & { route_desc: string }>,
  routeToFirstTrip: Map<string, string>,
  tripStops: Map<string, { stop_id: string; stop_sequence: number }[]>
): Promise<string[]> {
  console.log('\n🗺️  Seeding routes and segments...');

  const defaultUserId = emailToId['maria@demo.com'];
  if (!defaultUserId) {
    console.error('  ❌  Default user (maria@demo.com) not seeded — cannot assign route owner.');
    return [];
  }

  const seededRouteIds: string[] = [];
  const allSegments: object[] = [];

  for (const [routeId, meta] of Array.from(routeMetaMap.entries())) {
    const tripId = routeToFirstTrip.get(routeId);
    if (!tripId) continue;

    const stops = tripStops.get(tripId);
    if (!stops || stops.length < 2) continue; // need at least 2 stops for 1 segment

    const transportType = resolveTransportType(meta);
    const { origin, destination } = splitOriginDestination(meta.route_long_name, meta.route_desc);

    // Resolve first and last stop coordinates for route-level lat/lng
    const firstStop = stopMap.get(stops[0].stop_id);
    const lastStop  = stopMap.get(stops[stops.length - 1].stop_id);

    if (!firstStop || !lastStop) continue;

    // ── Insert route ──────────────────────────────────────────────────────────
    const { data: routeData, error: routeError } = await supabase
      .from('routes')
      .insert({
        user_id:         defaultUserId,
        origin,
        destination,
        origin_lat:      firstStop.stop_lat,
        origin_lng:      firstStop.stop_lon,
        destination_lat: lastStop.stop_lat,
        destination_lng: lastStop.stop_lon,
        estimated_duration: `~${Math.max(5, stops.length * 3)} mins`,
        confidence_score: 50,
        // total_fare computed below and updated after segments are known
      })
      .select('id')
      .single();

    if (routeError || !routeData) {
      console.warn(`  ⚠️  Route insert failed [${routeId}]: ${routeError?.message}`);
      continue;
    }

    const dbRouteId = routeData.id as string;
    seededRouteIds.push(dbRouteId);

    // ── Build segments ────────────────────────────────────────────────────────
    const capped = stops.slice(0, MAX_STOPS_PER_ROUTE);
    let totalFare = 0;

    for (let i = 0; i < capped.length - 1; i++) {
      const fromStop = stopMap.get(capped[i].stop_id);
      const toStop   = stopMap.get(capped[i + 1].stop_id);
      if (!fromStop || !toStop) continue;

      const distKm = haversineKm(fromStop.stop_lat, fromStop.stop_lon, toStop.stop_lat, toStop.stop_lon);
      const fare   = computeFare(transportType, distKm);
      totalFare   += fare;

      allSegments.push({
        route_id:           dbRouteId,
        transport_type:     transportType,
        signboard:          meta.route_short_name || meta.route_long_name.slice(0, 60),
        fare,
        boarding_name:      fromStop.stop_name,
        boarding_lat:       fromStop.stop_lat,
        boarding_lng:       fromStop.stop_lon,
        drop_off_name:      toStop.stop_name,
        drop_off_lat:       toStop.stop_lat,
        drop_off_lng:       toStop.stop_lon,
        estimated_duration: `~3 mins`,
        display_order:      i + 1,
      });
    }

    // Update route total_fare now that we know it
    await supabase
      .from('routes')
      .update({ total_fare: totalFare })
      .eq('id', dbRouteId);
  }

  console.log(`  ✅  ${seededRouteIds.length} routes inserted`);

  // ── Batch insert all segments ─────────────────────────────────────────────
  console.log(`  📦  Inserting ${allSegments.length} segments in batches of ${SEGMENT_BATCH_SIZE}...`);
  let segmentErrors = 0;

  for (let i = 0; i < allSegments.length; i += SEGMENT_BATCH_SIZE) {
    const batch = allSegments.slice(i, i + SEGMENT_BATCH_SIZE);
    const { error } = await supabase.from('route_segments').insert(batch);
    if (error) {
      console.warn(`  ⚠️  Segment batch ${i}–${i + batch.length} error: ${error.message}`);
      segmentErrors++;
    } else {
      process.stdout.write(`\r     Segments: ${Math.min(i + SEGMENT_BATCH_SIZE, allSegments.length)} / ${allSegments.length}`);
    }
  }
  console.log(`\n  ✅  Segments done. Errors: ${segmentErrors}`);

  return seededRouteIds;
}

// ─── Step 4: Seed route verifications ────────────────────────────────────────
// Strategically inserts verifications against the first 8 seeded routes
// to produce a variety of confidence score colours (green/yellow/red).
// The DB trigger `trg_update_route_confidence` auto-recalculates scores.
// The trigger `trg_notify_route_feedback` auto-inserts notifications for
// non-accurate verifications.

async function seedVerifications(
  emailToId: Record<string, string>,
  routeIds: string[]
) {
  if (routeIds.length < 2) {
    console.warn('\n⚠️  Not enough routes seeded to insert verifications — skipping.');
    return;
  }
  console.log('\n✅  Seeding route verifications...');

  const userIds = Object.values(emailToId);
  const u = (i: number) => userIds[i % userIds.length];

  type VerifType = 'accurate' | 'fare_changed' | 'boarding_point_changed' | 'unavailable';

  interface VerifEntry {
    routeIndex: number;
    userId: string;
    type: VerifType;
    newFare?: number;
    notes?: string;
  }

  const verifications: VerifEntry[] = [
    // Route 0 → green (2x accurate = +30 → score 80)
    { routeIndex: 0, userId: u(1), type: 'accurate', notes: 'Still accurate as of this week.' },
    { routeIndex: 0, userId: u(2), type: 'accurate', notes: 'Boarding point unchanged, fare still correct.' },

    // Route 1 → green (2x accurate = +30 → score 80)
    { routeIndex: 1, userId: u(3), type: 'accurate', notes: 'Verified personally yesterday.' },
    { routeIndex: 1, userId: u(4), type: 'accurate', notes: 'Route and stops confirmed.' },

    // Route 2 → yellow/neutral (1x accurate = +15 → score 65)
    { routeIndex: 2, userId: u(1), type: 'accurate', notes: 'Mostly accurate, minor construction nearby.' },

    // Route 3 → slightly below (1x accurate, 1x fare_changed = +15-5 → score 60)
    { routeIndex: 3, userId: u(2), type: 'accurate' },
    { routeIndex: 3, userId: u(5), type: 'fare_changed', newFare: 22, notes: 'Driver charged ₱22 instead of ₱20.' },

    // Route 4 → red (1x unavailable = -25 → score 25)
    { routeIndex: 4, userId: u(3), type: 'unavailable', notes: 'Route suspended due to road works on EDSA.' },

    // Route 5 → red (1x boarding_point_changed + 1x fare_changed = -10 → score 40)
    { routeIndex: 5, userId: u(4), type: 'boarding_point_changed', notes: 'Terminal moved 300m south of the old stop.' },
    { routeIndex: 5, userId: u(6), type: 'fare_changed', newFare: 30, notes: 'New fare since June re-classification.' },
  ];

  for (const v of verifications) {
    const routeId = routeIds[v.routeIndex];
    if (!routeId) continue;

    const { error } = await supabase.from('route_verifications').insert({
      route_id:          routeId,
      user_id:           v.userId,
      verification_type: v.type,
      new_fare:          v.newFare ?? null,
      notes:             v.notes ?? null,
    });

    if (error) {
      console.warn(`  ⚠️  Verification error (route index ${v.routeIndex}): ${error.message}`);
    } else {
      const icon = v.type === 'accurate' ? '🟢' : v.type === 'unavailable' ? '🔴' : '🟡';
      console.log(`  ${icon}  [route ${v.routeIndex}] ${v.type}`);
    }
  }
}

// ─── Step 5: Seed businesses ──────────────────────────────────────────────────

async function seedBusinesses() {
  console.log('\n🏪  Seeding businesses...');

  // No unique constraint on business_name — delete existing demo rows first, then insert fresh
  const names = MOCK_BUSINESSES.map((b) => b.business_name);
  await supabase.from('businesses').delete().in('business_name', names);

  const { error } = await supabase.from('businesses').insert(
    MOCK_BUSINESSES.map((b) => ({
      business_name: b.business_name,
      destination:   b.destination,
      business_type: b.business_type,
      price_range:   b.price_range,
      contact:       b.contact,
      description:   b.description,
      is_featured:   b.is_featured,
      feature_start: 'feature_start' in b ? (b as {feature_start: string}).feature_start : null,
      feature_end:   'feature_end'   in b ? (b as {feature_end: string}).feature_end   : null,
    }))
  );
  if (error) {
    console.warn('  ⚠️  Businesses insert warning:', error.message);
  } else {
    console.log(`  ✅  ${MOCK_BUSINESSES.length} businesses inserted`);
  }
}

// ─── Step 6: Seed user badges ─────────────────────────────────────────────────

async function seedBadges(emailToId: Record<string, string>) {
  console.log('\n🏅  Seeding user badges...');

  const badges = [
    { email: 'maria@demo.com', badge_name: 'Early Adopter' },
    { email: 'juan@demo.com',  badge_name: 'Top Contributor' },
    { email: 'carlo@demo.com', badge_name: 'Route Pioneer' },
  ];

  for (const badge of badges) {
    const userId = emailToId[badge.email];
    if (!userId) { console.warn(`  ⚠️  User not found for badge: ${badge.email}`); continue; }

    const { error } = await supabase.from('user_badges').insert({
      user_id:    userId,
      badge_name: badge.badge_name,
    });
    if (error && !error.message.includes('duplicate')) {
      console.warn(`  ⚠️  Badge error for ${badge.email}:`, error.message);
    } else {
      console.log(`  ✅  Badge "${badge.badge_name}" → ${badge.email}`);
    }
  }
}

// ─── Step 7: Seed welcome notifications ──────────────────────────────────────

async function seedNotifications(emailToId: Record<string, string>) {
  console.log('\n🔔  Seeding welcome notifications...');

  const rows = Object.entries(emailToId).map(([email, userId]) => ({
    user_id:  userId,
    actor_id: null,
    type:     'system_welcome',
    title:    'Welcome to ItinerYey! 🎉',
    message:  `Salamat sa pagsali! You can now browse commute routes, share tips, and help fellow commuters get around.`,
    link:     '/routes',
    is_read:  false,
  }));

  const { error } = await supabase.from('notifications').insert(rows);
  if (error) {
    console.warn('  ⚠️  Notification insert warning:', error.message);
  } else {
    console.log(`  ✅  ${rows.length} welcome notifications inserted`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   ItinerYey — Database Seed Script   ║');
  console.log('╚══════════════════════════════════════╝');

  // Validate GTFS files
  [ROUTES_FILE, TRIPS_FILE, STOPS_FILE, TIMES_FILE].forEach(assertFileExists);

  const startTime = Date.now();

  // 1. Users
  const emailToId = await seedUsers();
  const userCount = Object.keys(emailToId).length;
  console.log(`\n  → ${userCount} user(s) ready`);

  // 2. Parse GTFS
  const { stopMap, routeMetaMap, routeToFirstTrip, tripStops } = await parseGtfs();

  // 3. Routes + Segments
  const seededRouteIds = await seedRoutesAndSegments(
    emailToId, stopMap, routeMetaMap, routeToFirstTrip, tripStops
  );

  // 4. Verifications (triggers auto-update confidence scores + notifications)
  await seedVerifications(emailToId, seededRouteIds);

  // 5. Businesses
  await seedBusinesses();

  // 6. Badges
  await seedBadges(emailToId);

  // 7. Welcome notifications
  await seedNotifications(emailToId);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║   ✅  Seeding complete in ${elapsed}s       ║`);
  console.log(`║   Users:    ${String(userCount).padEnd(26)}║`);
  console.log(`║   Routes:   ${String(seededRouteIds.length).padEnd(26)}║`);
  console.log(`║   Biz:      ${String(MOCK_BUSINESSES.length).padEnd(26)}║`);
  console.log('╚══════════════════════════════════════╝');
}

main().catch((err) => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
