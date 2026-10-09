/**
 * scripts/build_offline_snapshot.ts
 *
 * Builds the on-device route index used when the cloud is unreachable
 * (data/offline/snapshot.json.gz). Run it once while online.
 *
 *   npx tsx scripts/build_offline_snapshot.ts            # from Supabase (.env.local)
 *   npx tsx scripts/build_offline_snapshot.ts --gtfs ./scratch/gtfs   # from a GTFS feed
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

dotenv.config({ path: '.env.local' });

const OUT_FILE = path.resolve('data/offline/snapshot.json.gz');

type SnapshotRoute = [id: string, origin: string, destination: string, totalFare: number];
type SnapshotSegment = [
  routeIndex: number,
  transportType: string,
  signboard: string | null,
  fare: number,
  boardingName: string | null,
  boardingLat: number,
  boardingLng: number,
  dropOffName: string | null,
  dropOffLat: number,
  dropOffLng: number,
  estimatedDuration: string | null,
];

interface Snapshot {
  version: 1;
  generatedAt: string;
  source: 'supabase' | 'gtfs' | 'gtfs+community';
  routes: SnapshotRoute[];
  segments: SnapshotSegment[];
}

// ─── Supabase source ──────────────────────────────────────────────────────────

/** Plain PostgREST over fetch — avoids supabase-js realtime, which needs WebSocket (Node 22+). */
async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  const rows: T[] = [];
  const limit = 1000;
  for (let from = 0; ; from += limit) {
    const qs = new URLSearchParams({ select: columns.replace(/\s+/g, ''), order: 'id' });
    const res = await fetch(`${url}/rest/v1/${table}?${qs}`, {
      headers: { ...headers, Range: `${from}-${from + limit - 1}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const data = (await res.json()) as T[];
    rows.push(...data);
    if (data.length < limit) break;
  }
  return rows;
}

async function fromSupabase(): Promise<Snapshot> {
  interface RouteRow { id: string; origin: string; destination: string; total_fare: number | null }
  interface SegRow {
    route_id: string; transport_type: string; signboard: string | null; fare: number | null;
    boarding_name: string | null; boarding_lat: number | null; boarding_lng: number | null;
    drop_off_name: string | null; drop_off_lat: number | null; drop_off_lng: number | null;
    estimated_duration: string | null; display_order: number;
  }

  const routes = await fetchAll<RouteRow>('routes', 'id, origin, destination, total_fare');
  const segments = await fetchAll<SegRow>(
    'route_segments',
    'id, route_id, transport_type, signboard, fare, boarding_name, boarding_lat, boarding_lng, ' +
    'drop_off_name, drop_off_lat, drop_off_lng, estimated_duration, display_order'
  );

  const routeIndex = new Map(routes.map((r, i) => [r.id, i]));
  segments.sort((a, b) =>
    a.route_id === b.route_id ? a.display_order - b.display_order : a.route_id.localeCompare(b.route_id)
  );

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'supabase',
    routes: routes.map(r => [r.id, r.origin, r.destination, Number(r.total_fare ?? 0)]),
    segments: segments
      .filter(s =>
        routeIndex.has(s.route_id) &&
        s.boarding_lat != null && s.boarding_lng != null &&
        s.drop_off_lat != null && s.drop_off_lng != null
      )
      .map(s => [
        routeIndex.get(s.route_id)!, s.transport_type, s.signboard, Number(s.fare ?? 0),
        s.boarding_name, s.boarding_lat!, s.boarding_lng!,
        s.drop_off_name, s.drop_off_lat!, s.drop_off_lng!, s.estimated_duration,
      ]),
  };
}

// ─── GTFS source (same conversion rules as scripts/seed_data.ts) ──────────────

function parseCsv(file: string): Record<string, string>[] {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(Boolean);
  const split = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
      } else if (c === ',' && !quoted) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out.map(v => v.trim());
  };
  const header = split(lines[0]);
  return lines.slice(1).map(l => {
    const vals = split(l);
    return Object.fromEntries(header.map((h, i) => [h, vals[i] ?? '']));
  });
}

function resolveTransportType(agency: string, routeId: string, longName: string, routeType: number): string {
  const a = agency.toUpperCase();
  const id = routeId.toUpperCase();
  const name = longName.toUpperCase();
  if (a === 'LRTA') return 'LRT';
  if (a === 'MRTC' || a === 'PNR') return 'MRT';
  if (a === 'FORT') return 'UV Express';
  if (id.includes('_PUJ')) return 'Jeep';
  if (id.includes('_PUB')) return 'Bus';
  if (name.includes('UV') || name.includes('FX') || name.includes('P2P')) return 'UV Express';
  if (name.includes('JEEP') || name.includes('PUJ')) return 'Jeep';
  if (routeType === 0) return 'LRT';
  if (routeType === 1 || routeType === 2) return 'MRT';
  return 'Bus';
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeFare(type: string, km: number): number {
  switch (type) {
    case 'Jeep': return Math.round(14 + Math.max(0, km - 4) * 2.0);
    case 'Bus': return Math.round(15 + Math.max(0, km - 5) * 2.65);
    case 'UV Express': return Math.round(18 + Math.max(0, km - 5) * 3.0);
    case 'LRT': return Math.min(Math.round(11 + km * 1.5), 30);
    case 'MRT': return Math.min(Math.round(13 + km * 2.0), 28);
    default: return 15;
  }
}

function splitOriginDestination(longName: string): { origin: string; destination: string } {
  for (const delim of [' - ', ' to ', ' / ', '–', '—']) {
    const idx = longName.indexOf(delim);
    if (idx > 0 && idx < longName.length - delim.length) {
      return { origin: longName.slice(0, idx).trim(), destination: longName.slice(idx + delim.length).trim() };
    }
  }
  return { origin: longName.trim(), destination: longName.trim() };
}

const MAX_STOPS_PER_ROUTE = 40;
const AVG_SPEED_M_PER_MIN: Record<string, number> = { LRT: 600, MRT: 600, PNR: 600, Bus: 300 };

/** Evenly sample long routes down to `max` stops, always keeping both terminals. */
function sampleStops<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items;
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(items[Math.round((i * (items.length - 1)) / (max - 1))]);
  return out;
}

function fromGtfs(dir: string): Snapshot {
  const stops = new Map(
    parseCsv(path.join(dir, 'stops.txt')).map(s => [
      s.stop_id,
      { name: s.stop_name, lat: parseFloat(s.stop_lat), lng: parseFloat(s.stop_lon) },
    ])
  );
  const routesCsv = parseCsv(path.join(dir, 'routes.txt'));
  const firstTrip = new Map<string, string>();
  for (const t of parseCsv(path.join(dir, 'trips.txt'))) {
    if (!firstTrip.has(t.route_id)) firstTrip.set(t.route_id, t.trip_id);
  }
  const needed = new Set(firstTrip.values());
  const tripStops = new Map<string, { seq: number; stopId: string }[]>();
  for (const st of parseCsv(path.join(dir, 'stop_times.txt'))) {
    if (!needed.has(st.trip_id)) continue;
    if (!tripStops.has(st.trip_id)) tripStops.set(st.trip_id, []);
    tripStops.get(st.trip_id)!.push({ seq: parseInt(st.stop_sequence, 10), stopId: st.stop_id });
  }

  const routes: SnapshotRoute[] = [];
  const segments: SnapshotSegment[] = [];

  for (const r of routesCsv) {
    const tripId = firstTrip.get(r.route_id);
    const seq = tripId ? tripStops.get(tripId) : undefined;
    if (!seq || seq.length < 2) continue;
    seq.sort((a, b) => a.seq - b.seq);
    const capped = sampleStops(seq, MAX_STOPS_PER_ROUTE).map(s => stops.get(s.stopId)).filter(Boolean) as
      { name: string; lat: number; lng: number }[];
    if (capped.length < 2) continue;

    const type = resolveTransportType(r.agency_id, r.route_id, r.route_long_name, parseInt(r.route_type, 10) || 3);
    const signboard = r.route_short_name || r.route_long_name.slice(0, 60);
    const { origin, destination } = splitOriginDestination(r.route_long_name);
    const routeIdx = routes.length;
    let total = 0;
    let km = 0;

    // Per-hop fare is the increase in the distance-based fare, so summing the
    // hops of one ride gives the LTFRB fare for the whole distance.
    for (let i = 0; i < capped.length - 1; i++) {
      const a = capped[i];
      const b = capped[i + 1];
      const prevKm = km;
      const hopKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
      km += hopKm;
      const mins = Math.max(1, Math.round((hopKm * 1000) / (AVG_SPEED_M_PER_MIN[type] ?? 250)));
      const fare = i === 0 ? computeFare(type, km) : computeFare(type, km) - computeFare(type, prevKm);
      total += fare;
      segments.push([routeIdx, type, signboard, fare, a.name, a.lat, a.lng, b.name, b.lat, b.lng, `~${mins} mins`]);
    }
    routes.push([r.route_id, origin, destination, total]);
  }

  return { version: 1, generatedAt: new Date().toISOString(), source: 'gtfs', routes, segments };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const gtfsFlag = process.argv.indexOf('--gtfs');
  const snapshot = gtfsFlag !== -1
    ? fromGtfs(path.resolve(process.argv[gtfsFlag + 1] ?? 'scratch/gtfs'))
    : await fromSupabase();

  // --with-community: keep GTFS fares, add community-submitted Supabase routes the feed doesn't have.
  if (gtfsFlag !== -1 && process.argv.includes('--with-community')) {
    const community = await fromSupabase();
    const known = new Set(snapshot.segments.map(s => s[2]));
    let added = 0;
    community.routes.forEach((route, idx) => {
      const segs = community.segments.filter(s => s[0] === idx);
      if (segs.length === 0 || segs.some(s => known.has(s[2]))) return;
      const newIdx = snapshot.routes.length;
      snapshot.routes.push(route);
      for (const s of segs) snapshot.segments.push([newIdx, ...s.slice(1)] as SnapshotSegment);
      added++;
    });
    snapshot.source = 'gtfs+community';
    console.log(`Added ${added} community routes from Supabase`);
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, zlib.gzipSync(JSON.stringify(snapshot), { level: 9 }));
  const kb = Math.round(fs.statSync(OUT_FILE).size / 1024);
  console.log(`Wrote ${OUT_FILE} (${kb} KB): ${snapshot.routes.length} routes, ${snapshot.segments.length} segments from ${snapshot.source}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
