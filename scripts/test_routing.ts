import { createServiceClient } from '../src/utils/supabase/service';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const R = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function nodeKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

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

class MinHeap {
  private heap: { nodeId: string; f: number }[] = [];
  get size() { return this.heap.length; }
  push(entry: { nodeId: string; f: number }): void {
    this.heap.push(entry);
    this.bubbleUp(this.heap.length - 1);
  }
  pop(): { nodeId: string; f: number } | undefined {
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

async function run() {
  const startLat = 14.69786;
  const startLng = 121.11041;
  const endLat = 14.65736;
  const endLng = 121.02889;

  console.log(`Fetching ALL segments from database...`);
  const supabase = createServiceClient();
  const segments: RawSegment[] = [];
  let from = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('route_segments')
      .select('route_id, transport_type, signboard, fare, boarding_name, boarding_lat, boarding_lng, drop_off_name, drop_off_lat, drop_off_lng, estimated_duration')
      .not('boarding_lat', 'is', null)
      .not('drop_off_lat', 'is', null)
      .range(from, from + limit - 1);

    if (error) {
      console.error('Error fetching segments:', error.message);
      break;
    }

    if (data && data.length > 0) {
      segments.push(...(data as any[]));
      if (data.length < limit) {
        hasMore = false;
      } else {
        from += limit;
      }
    } else {
      hasMore = false;
    }
  }

  console.log(`Total loaded segments: ${segments.length}`);

  // Find all unique stops/nodes
  const nodes = new Map<string, { id: string; name: string; lat: number; lng: number }>();
  for (const seg of segments) {
    const k1 = nodeKey(seg.boarding_lat!, seg.boarding_lng!);
    if (!nodes.has(k1)) {
      nodes.set(k1, { id: k1, name: seg.boarding_name ?? 'Stop', lat: seg.boarding_lat!, lng: seg.boarding_lng! });
    }
    const k2 = nodeKey(seg.drop_off_lat!, seg.drop_off_lng!);
    if (!nodes.has(k2)) {
      nodes.set(k2, { id: k2, name: seg.drop_off_name ?? 'Stop', lat: seg.drop_off_lat!, lng: seg.drop_off_lng! });
    }
  }

  console.log(`Total unique nodes: ${nodes.size}`);

  // Snap start & end
  let startNode: any = null;
  let startDist = Infinity;
  let endNode: any = null;
  let endDist = Infinity;

  for (const node of Array.from(nodes.values())) {
    const dStart = haversineM(startLat, startLng, node.lat, node.lng);
    if (dStart < startDist) {
      startDist = dStart;
      startNode = node;
    }
    const dEnd = haversineM(endLat, endLng, node.lat, node.lng);
    if (dEnd < endDist) {
      endDist = dEnd;
      endNode = node;
    }
  }

  console.log(`Start snapped to: ${startNode.name} (${startNode.lat}, ${startNode.lng}) at ${startDist.toFixed(1)}m`);
  console.log(`End snapped to: ${endNode.name} (${endNode.lat}, ${endNode.lng}) at ${endDist.toFixed(1)}m`);

  // Build Adjacency
  const adjacency = new Map<string, any[]>();
  for (const id of Array.from(nodes.keys())) {
    adjacency.set(id, []);
  }

  for (const seg of segments) {
    const fromId = nodeKey(seg.boarding_lat!, seg.boarding_lng!);
    const toId = nodeKey(seg.drop_off_lat!, seg.drop_off_lng!);
    adjacency.get(fromId)!.push({ toId, costMinutes: 3, kind: 'transit', transportType: seg.transport_type, signboard: seg.signboard });
    adjacency.get(toId)!.push({ toId: fromId, costMinutes: 3, kind: 'transit', transportType: seg.transport_type, signboard: seg.signboard });
  }

  // Walking transfers
  console.log('Calculating walking transfer edges...');
  const GRID_SIZE = 0.001;
  const grid = new Map<string, string[]>();
  for (const [id, node] of Array.from(nodes.entries())) {
    const cellKey = `${Math.floor(node.lat / GRID_SIZE)},${Math.floor(node.lng / GRID_SIZE)}`;
    if (!grid.has(cellKey)) grid.set(cellKey, []);
    grid.get(cellKey)!.push(id);
  }

  const WALK_TRANSFER_RADIUS_M = 400;
  for (const id of Array.from(nodes.keys())) {
    const node = nodes.get(id)!;
    const gRow = Math.floor(node.lat / GRID_SIZE);
    const gCol = Math.floor(node.lng / GRID_SIZE);
    const candidates: string[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const neighbours = grid.get(`${gRow + dr},${gCol + dc}`) ?? [];
        candidates.push(...neighbours);
      }
    }
    const direct = new Set(adjacency.get(id)!.map(e => e.toId));
    for (const otherId of candidates) {
      if (otherId === id || direct.has(otherId)) continue;
      const other = nodes.get(otherId)!;
      const dist = haversineM(node.lat, node.lng, other.lat, other.lng);
      if (dist <= WALK_TRANSFER_RADIUS_M) {
        const walkMin = dist / 80;
        adjacency.get(id)!.push({ toId: otherId, costMinutes: walkMin, kind: 'walk' });
        adjacency.get(otherId)!.push({ toId: id, costMinutes: walkMin, kind: 'walk' });
        direct.add(otherId);
      }
    }
  }

  // Reachability BFS
  const visited = new Set<string>();
  const queue: string[] = [startNode.id];
  visited.add(startNode.id);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const neighbors = adjacency.get(curr) ?? [];
    for (const n of neighbors) {
      if (!visited.has(n.toId)) {
        visited.add(n.toId);
        queue.push(n.toId);
      }
    }
  }

  console.log(`Reachable nodes from start: ${visited.size}`);
  console.log(`Is destination reachable? ${visited.has(endNode.id)}`);

  // Run A*
  console.log('Running A* pathfinder...');
  const h = (id: string): number => {
    const n = nodes.get(id)!;
    return haversineM(n.lat, n.lng, endNode.lat, endNode.lng) / 250;
  };

  const gScores = new Map<string, { g: number; from: string | null; via: any }>();
  gScores.set(startNode.id, { g: 0, from: null, via: null });

  const openSet = new MinHeap();
  openSet.push({ nodeId: startNode.id, f: h(startNode.id) });

  const closed = new Set<string>();

  while (openSet.size > 0) {
    const { nodeId: current } = openSet.pop()!;
    if (current === endNode.id) break;
    if (closed.has(current)) continue;
    closed.add(current);

    const currentScore = gScores.get(current)!;
    const prevEdge = currentScore.via;

    for (const edge of (adjacency.get(current) ?? [])) {
      if (closed.has(edge.toId)) continue;
      let transferPenalty = 0;
      if (
        prevEdge &&
        edge.kind === 'transit' &&
        prevEdge.kind === 'transit' &&
        (edge.transportType !== prevEdge.transportType || edge.signboard !== prevEdge.signboard)
      ) {
        transferPenalty = 5;
      }
      const tentativeG = currentScore.g + edge.costMinutes + transferPenalty;
      const existing = gScores.get(edge.toId);
      if (existing && existing.g <= tentativeG) continue;

      gScores.set(edge.toId, { g: tentativeG, from: current, via: edge });
      openSet.push({ nodeId: edge.toId, f: tentativeG + h(edge.toId) });
    }
  }

  if (gScores.has(endNode.id)) {
    console.log('🎉 Path found!');
    // Print path trace
    const path = [];
    let cur = endNode.id;
    while (cur !== null) {
      const s = gScores.get(cur)!;
      path.unshift({ id: cur, name: nodes.get(cur)!.name, via: s.via });
      cur = s.from!;
    }
    console.log('Path Steps:');
    path.forEach((p, idx) => {
      console.log(`  ${idx + 1}. ${p.name} (${p.via ? p.via.kind + (p.via.signboard ? ' (' + p.via.signboard + ')' : '') : 'Start'})`);
    });
  } else {
    console.log('❌ A* could not find a path.');
  }
}

run().catch(console.error);
