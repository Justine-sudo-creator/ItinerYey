// On-device route index — loaded from data/offline/snapshot.json.gz (built by
// scripts/build_offline_snapshot.ts) so routing, place search and signboard
// matching keep working when Supabase is unreachable.

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface RawSegment {
  route_id: string;
  transport_type: string;
  signboard: string | null;
  fare: number;
  boarding_name: string | null;
  boarding_lat: number | null;
  boarding_lng: number | null;
  drop_off_name: string | null;
  drop_off_lat: number | null;
  drop_off_lng: number | null;
  estimated_duration: string | null;
}

export interface OfflineRoute {
  id: string;
  origin: string;
  destination: string;
  totalFare: number;
  transportType: string;
  signboard: string | null;
  segments: RawSegment[];
}

export interface OfflineSnapshot {
  generatedAt: string;
  source: 'supabase' | 'gtfs' | 'gtfs+community';
  routes: OfflineRoute[];
  segments: RawSegment[];
}

type SnapshotFile = {
  version: 1;
  generatedAt: string;
  source: 'supabase' | 'gtfs' | 'gtfs+community';
  routes: [string, string, string, number][];
  segments: [number, string, string | null, number, string | null, number, number, string | null, number, number, string | null][];
};

const SNAPSHOT_PATH = path.join(process.cwd(), 'data', 'offline', 'snapshot.json.gz');

let cached: OfflineSnapshot | null = null;

export function loadOfflineSnapshot(): OfflineSnapshot {
  if (cached) return cached;

  if (!fs.existsSync(SNAPSHOT_PATH)) {
    throw new Error(
      'Offline route index not found. Run `npx tsx scripts/build_offline_snapshot.ts` while online.'
    );
  }

  const file = JSON.parse(zlib.gunzipSync(fs.readFileSync(SNAPSHOT_PATH)).toString('utf8')) as SnapshotFile;

  const routes: OfflineRoute[] = file.routes.map(([id, origin, destination, totalFare]) => ({
    id, origin, destination, totalFare, transportType: '', signboard: null, segments: [],
  }));

  const segments: RawSegment[] = file.segments.map(
    ([ri, transport_type, signboard, fare, boarding_name, boarding_lat, boarding_lng,
      drop_off_name, drop_off_lat, drop_off_lng, estimated_duration]) => {
      const route = routes[ri];
      const seg: RawSegment = {
        route_id: route.id, transport_type, signboard, fare,
        boarding_name, boarding_lat, boarding_lng,
        drop_off_name, drop_off_lat, drop_off_lng, estimated_duration,
      };
      route.segments.push(seg);
      if (!route.transportType) route.transportType = transport_type;
      if (!route.signboard && signboard) route.signboard = signboard;
      return seg;
    }
  );

  cached = { generatedAt: file.generatedAt, source: file.source, routes, segments };
  return cached;
}

/** Skip Supabase entirely (set OFFLINE_MODE=1, or leave Supabase env unset). */
export function isOfflineMode(): boolean {
  return (
    process.env.OFFLINE_MODE === '1' ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
