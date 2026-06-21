// ─────────────────────────────────────────────────────────────────────────────
// ItinerYey — A* Multi-Vehicle Transit Routing Engine
//
// Architecture:
//   1. Build an in-memory spatial graph from Supabase route_segments data.
//   2. Inject virtual "walk" edges between nearby stops on different lines.
//   3. Run A* with a Haversine heuristic + transfer penalty.
//   4. Reconstruct and format the path into structured journey legs.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from '@/utils/supabase/service';
import type {
  GraphNode,
  GraphEdge,
  AdjacencyList,
  GScore,
  OpenSetEntry,
  PathStep,
  TransitLeg,
  WalkingLeg,
  JourneyLeg,
  RoutingResult,
  RoutingError,
} from '@/types/routing';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Maximum walking-transfer radius in meters */
const WALK_TRANSFER_RADIUS_M = 400;

/** Average walking speed for transfer cost (m/min) */
const WALK_SPEED_M_PER_MIN = 80;

/** A* heuristic divisor — optimistic average transit speed (m/min)
 *  ~250 m/min ≈ 15 km/h, reasonable for mixed urban transit */
const HEURISTIC_SPEED_M_PER_MIN = 250;

/** Extra minutes added whenever the vehicle line changes (transfer penalty) */
const TRANSFER_PENALTY_MIN = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Haversine distance (meters) — inlined & optimised to avoid per-call overhead
// by pre-computing sin²(Δlat/2) and sin²(Δlng/2).
// ─────────────────────────────────────────────────────────────────────────────

const R = 6_371_000; // Earth radius in metres
const DEG_TO_RAD = Math.PI / 180;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic node key from coordinates (rounded to ~1 m precision)
// ─────────────────────────────────────────────────────────────────────────────

function nodeKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Min-heap (priority queue) for the A* open set
// Using a simple binary heap to keep O(log n) push/pop.
// ─────────────────────────────────────────────────────────────────────────────

class MinHeap {
  private heap: OpenSetEntry[] = [];

  get size() { return this.heap.length; }

  push(entry: OpenSetEntry): void {
    this.heap.push(entry);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): OpenSetEntry | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].f <= this.heap[i].f) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.heap[l].f < this.heap[smallest].f) smallest = l;
      if (r < n && this.heap[r].f < this.heap[smallest].f) smallest = r;
      if (smallest === i) break;
      [this.heap[smallest], this.heap[i]] = [this.heap[i], this.heap[smallest]];
      i = smallest;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph construction
// ─────────────────────────────────────────────────────────────────────────────

interface RawSegment {
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

function parseDurationMin(raw: string | null): number {
  if (!raw) return 3; // default 3 min per stop
  const match = raw.match(/\d+/);
  return match ? Math.max(1, parseInt(match[0], 10)) : 3;
}

// In-memory cache for the built graph to avoid reloading 39k segments from DB on every route planner request
let cachedGraph: {
  nodes: Map<string, GraphNode>;
  adjacency: AdjacencyList;
} | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

async function buildGraph(): Promise<{
  nodes: Map<string, GraphNode>;
  adjacency: AdjacencyList;
}> {
  const now = Date.now();
  if (cachedGraph && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedGraph;
  }

  const supabase = createServiceClient();
  const segments: RawSegment[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('route_segments')
      .select(
        'route_id, transport_type, signboard, fare, ' +
        'boarding_name, boarding_lat, boarding_lng, ' +
        'drop_off_name, drop_off_lat, drop_off_lng, ' +
        'estimated_duration'
      )
      .not('boarding_lat', 'is', null)
      .not('drop_off_lat', 'is', null)
      .range(from, from + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch segments: ${error.message}`);
    }

    if (data && data.length > 0) {
      segments.push(...(data as unknown as RawSegment[]));
      if (data.length < limit) {
        hasMore = false;
      } else {
        from += limit;
      }
    } else {
      hasMore = false;
    }
  }

  const nodes = new Map<string, GraphNode>();
  const adjacency: AdjacencyList = new Map();

  const addNode = (lat: number, lng: number, name: string): string => {
    const key = nodeKey(lat, lng);
    if (!nodes.has(key)) {
      nodes.set(key, { id: key, name, lat, lng });
      adjacency.set(key, []);
    }
    return key;
  };

  const addEdge = (fromId: string, edge: GraphEdge) => {
    adjacency.get(fromId)!.push(edge);
  };

  // ── 1. Transit edges from segments ──────────────────────────────────────

  for (const seg of (segments as unknown) as RawSegment[]) {
    const { boarding_lat, boarding_lng, drop_off_lat, drop_off_lng } = seg;
    if (
      boarding_lat == null || boarding_lng == null ||
      drop_off_lat == null || drop_off_lng == null
    ) continue;

    const fromId = addNode(boarding_lat, boarding_lng, seg.boarding_name ?? 'Stop');
    const toId   = addNode(drop_off_lat, drop_off_lng, seg.drop_off_name ?? 'Stop');

    let costMinutes = parseDurationMin(seg.estimated_duration);
    if (
      seg.transport_type?.toLowerCase().includes('trike') ||
      seg.transport_type?.toLowerCase().includes('tricycle') ||
      seg.signboard?.toLowerCase().includes('trike') ||
      seg.signboard?.toLowerCase().includes('tricycle')
    ) {
      costMinutes *= 2.5; // Artificially make tricycle paths look much slower to the engine
    }

    // Add forward transit edge
    addEdge(fromId, {
      toId,
      costMinutes,
      kind: 'transit',
      transportType: seg.transport_type,
      signboard: seg.signboard,
      fare: seg.fare ?? 0,
      routeId: seg.route_id,
    });

    // Add reverse transit edge (since PH transit lines operate bi-directionally)
    addEdge(toId, {
      toId: fromId,
      costMinutes,
      kind: 'transit',
      transportType: seg.transport_type,
      signboard: seg.signboard,
      fare: seg.fare ?? 0,
      routeId: seg.route_id,
    });
  }

  // ── 2. Virtual walking transfer edges (the secret sauce) ────────────────
  //
  // We compare every pair of nodes. Two nodes qualify for a walking edge if:
  //   a) they are within WALK_TRANSFER_RADIUS_M of each other, AND
  //   b) they do NOT already share a direct transit edge (same line).
  //
  // To avoid O(n²) at scale, we use a coarse grid-bucketing approach:
  // group nodes by a 0.001° grid cell (~111 m) and only compare nodes in
  // the same or adjacent cells. This brings the comparison set from 39k²
  // down to only a few dozen candidates per node.

  // Grid bucket size in degrees (~111 m per 0.001°)
  const GRID_SIZE = 0.001;
  const grid = new Map<string, string[]>(); // cellKey → nodeIds

  for (const [id, node] of Array.from(nodes.entries())) {
    const cellKey = `${Math.floor(node.lat / GRID_SIZE)},${Math.floor(node.lng / GRID_SIZE)}`;
    if (!grid.has(cellKey)) grid.set(cellKey, []);
    grid.get(cellKey)!.push(id);
  }

  const allNodeIds = Array.from(nodes.keys());

  for (const id of allNodeIds) {
    const node = nodes.get(id)!;
    const gRow = Math.floor(node.lat / GRID_SIZE);
    const gCol = Math.floor(node.lng / GRID_SIZE);

    // Collect candidates from the 3×3 neighbourhood of grid cells
    const candidates: string[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const neighbours = grid.get(`${gRow + dr},${gCol + dc}`) ?? [];
        candidates.push(...neighbours);
      }
    }

    // Existing direct transit neighbours (to avoid duplicate walk edges on same platform)
    const directNeighbours = new Set(adjacency.get(id)!.map(e => e.toId));

    for (const otherId of candidates) {
      if (otherId === id) continue;
      if (directNeighbours.has(otherId)) continue;

      const other = nodes.get(otherId)!;
      const distM = haversineM(node.lat, node.lng, other.lat, other.lng);
      if (distM > WALK_TRANSFER_RADIUS_M) continue;

      const walkMin = distM / WALK_SPEED_M_PER_MIN;

      // Bidirectional walk edge
      addEdge(id, { toId: otherId, costMinutes: walkMin, kind: 'walk' });
      addEdge(otherId, { toId: id, costMinutes: walkMin, kind: 'walk' });

      // Mark so we don't add it again in reverse
      directNeighbours.add(otherId);
    }
  }

  cachedGraph = { nodes, adjacency };
  lastFetchTime = Date.now();
  return cachedGraph;
}

// ─────────────────────────────────────────────────────────────────────────────
// A* pathfinder
// ─────────────────────────────────────────────────────────────────────────────

function astar(
  startId: string,
  goalId: string,
  nodes: Map<string, GraphNode>,
  adjacency: AdjacencyList
): PathStep[] | null {
  const goalNode = nodes.get(goalId);
  if (!goalNode) return null;

  // h(n) — admissible heuristic: straight-line distance / optimistic speed
  const h = (id: string): number => {
    const n = nodes.get(id);
    if (!n) return 0;
    return haversineM(n.lat, n.lng, goalNode.lat, goalNode.lng) / HEURISTIC_SPEED_M_PER_MIN;
  };

  // gScores: nodeId → best known cost + traceback
  const gScores = new Map<string, GScore>();
  gScores.set(startId, { g: 0, from: null, via: null });

  const openSet = new MinHeap();
  openSet.push({ nodeId: startId, f: h(startId) });

  // Closed set — nodes whose optimal path has been finalised
  const closed = new Set<string>();

  while (openSet.size > 0) {
    const { nodeId: current } = openSet.pop()!;

    if (current === goalId) break;
    if (closed.has(current)) continue;
    closed.add(current);

    const currentScore = gScores.get(current)!;
    const prevEdge = currentScore.via;

    for (const edge of (adjacency.get(current) ?? [])) {
      if (closed.has(edge.toId)) continue;

      // Transfer penalty when switching lines
      let transferPenalty = 0;
      if (
        prevEdge &&
        edge.kind === 'transit' &&
        prevEdge.kind === 'transit' &&
        (edge.transportType !== prevEdge.transportType || edge.signboard !== prevEdge.signboard)
      ) {
        transferPenalty = TRANSFER_PENALTY_MIN;
      }

      const tentativeG = currentScore.g + edge.costMinutes + transferPenalty;

      const existing = gScores.get(edge.toId);
      if (existing && existing.g <= tentativeG) continue;

      gScores.set(edge.toId, { g: tentativeG, from: current, via: edge });
      openSet.push({ nodeId: edge.toId, f: tentativeG + h(edge.toId) });
    }
  }

  // Reconstruct path
  if (!gScores.has(goalId)) return null;

  const path: PathStep[] = [];
  let cur: string | null = goalId;

  while (cur !== null) {
    const score: GScore = gScores.get(cur)!;
    const node  = nodes.get(cur)!;
    path.unshift({
      nodeId: cur,
      name:   node.name,
      lat:    node.lat,
      lng:    node.lng,
      edge:   score.via,
    });
    cur = score.from;
  }

  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
// Path → structured journey legs
// ─────────────────────────────────────────────────────────────────────────────

function buildLegs(path: PathStep[]): JourneyLeg[] {
  const legs: JourneyLeg[] = [];

  let i = 1; // skip origin node (its edge is null)
  while (i < path.length) {
    const step = path[i];
    const edge = step.edge!;

    // ── Walking transfer ──────────────────────────────────────────────────
    if (edge.kind === 'walk') {
      const distM = haversineM(
        path[i - 1].lat, path[i - 1].lng,
        step.lat, step.lng
      );
      legs.push({
        type: 'walking',
        from: { name: path[i - 1].name, lat: path[i - 1].lat, lng: path[i - 1].lng },
        to:   { name: step.name,         lat: step.lat,         lng: step.lng         },
        distanceMeters: Math.round(distM),
        timeMinutes: Math.round(distM / WALK_SPEED_M_PER_MIN),
      } satisfies WalkingLeg);
      i++;
      continue;
    }

    // ── Transit leg — absorb all consecutive steps on the same line ───────
    const lineType = edge.transportType ?? '';
    const lineSign = edge.signboard    ?? null;

    const legStops: TransitLeg['stops'] = [
      { name: path[i - 1].name, lat: path[i - 1].lat, lng: path[i - 1].lng },
    ];
    let totalFare = 0;
    let totalTime = 0;

    while (
      i < path.length &&
      path[i].edge?.kind === 'transit' &&
      path[i].edge?.transportType === lineType &&
      path[i].edge?.signboard     === lineSign
    ) {
      const s = path[i];
      legStops.push({ name: s.name, lat: s.lat, lng: s.lng });
      totalFare += s.edge?.fare ?? 0;
      totalTime += s.edge?.costMinutes ?? 0;
      i++;
    }

    legs.push({
      type: 'transit',
      transportType: lineType,
      signboard:     lineSign,
      stops:         legStops,
      totalFare:     Math.round(totalFare * 100) / 100,
      totalTimeMinutes: Math.round(totalTime),
    } satisfies TransitLeg);
  }

  return legs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — findRoute
//
// Given two lat/lng pairs (representing the start and end of a commute),
// this function:
//   1. Builds the spatial graph from Supabase.
//   2. Snaps the start/end to the nearest graph nodes.
//   3. Runs A* to find the optimal path.
//   4. Formats and returns structured journey legs.
// ─────────────────────────────────────────────────────────────────────────────

export interface FindRouteParams {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

export async function findRoute(
  params: FindRouteParams
): Promise<RoutingResult | RoutingError> {
  const { startLat, startLng, endLat, endLng } = params;

  // Build graph
  const { nodes, adjacency } = await buildGraph();

  if (nodes.size === 0) {
    return { success: false, error: 'Transit network is empty — check your database seeding.' };
  }

  // Snap start & end to nearest graph node
  const snapToNearest = (lat: number, lng: number): GraphNode | null => {
    let best: GraphNode | null = null;
    let bestDist = Infinity;
    for (const node of Array.from(nodes.values())) {
      const d = haversineM(lat, lng, node.lat, node.lng);
      if (d < bestDist) { bestDist = d; best = node; }
    }
    return best;
  };

  const startNode = snapToNearest(startLat, startLng);
  const endNode   = snapToNearest(endLat,   endLng);

  if (!startNode || !endNode) {
    return { success: false, error: 'Could not snap coordinates to any transit stop.' };
  }

  if (startNode.id === endNode.id) {
    return { success: false, error: 'Origin and destination resolve to the same transit stop.' };
  }

  // Run A*
  const path = astar(startNode.id, endNode.id, nodes, adjacency);

  if (!path || path.length < 2) {
    return { success: false, error: 'No route found between the given stops.' };
  }

  // Format legs
  const legs = buildLegs(path);
  const totalFare = legs
    .filter((l): l is TransitLeg => l.type === 'transit')
    .reduce((s, l) => s + l.totalFare, 0);
  const totalTime = legs.reduce((s, l) => s + (l.type === 'transit' ? l.totalTimeMinutes : l.timeMinutes), 0);

  return {
    success:          true,
    totalTimeMinutes: Math.round(totalTime),
    totalFare:        Math.round(totalFare * 100) / 100,
    legs,
  };
}
