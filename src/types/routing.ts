// ─────────────────────────────────────────────────────────────────────────────
// Transit Graph & A* Routing Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

// ── Graph primitives ────────────────────────────────────────────────────────

/** A physical stop/waypoint in the transit network */
export interface GraphNode {
  /** Unique key — e.g. "lat,lng" rounded to 5dp */
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export type EdgeKind = 'transit' | 'walk';

/** A directed edge between two GraphNodes */
export interface GraphEdge {
  toId: string;
  /** Cost in minutes */
  costMinutes: number;
  kind: EdgeKind;
  /** Only for transit edges */
  transportType?: string;
  signboard?: string | null;
  fare?: number;
  routeId?: string;
}

/** Adjacency list: nodeId → outgoing edges */
export type AdjacencyList = Map<string, GraphEdge[]>;

// ── A* bookkeeping ───────────────────────────────────────────────────────────

export interface GScore {
  /** Actual accumulated cost (minutes, with transfer penalties) */
  g: number;
  /** Previous node id in the path */
  from: string | null;
  /** Edge used to arrive at this node */
  via: GraphEdge | null;
}

export interface OpenSetEntry {
  nodeId: string;
  /** f = g + h */
  f: number;
}

// ── Raw path step returned by the A* resolver ────────────────────────────────

export interface PathStep {
  nodeId: string;
  name: string;
  lat: number;
  lng: number;
  /** Edge used to reach this node (null for the origin) */
  edge: GraphEdge | null;
}

// ── Final structured API response ────────────────────────────────────────────

export interface TransitLeg {
  type: 'transit';
  transportType: string;
  signboard: string | null;
  stops: Array<{
    name: string;
    lat: number;
    lng: number;
  }>;
  totalFare: number;
  totalTimeMinutes: number;
}

export interface WalkingLeg {
  type: 'walking';
  from: { name: string; lat: number; lng: number };
  to: { name: string; lat: number; lng: number };
  distanceMeters: number;
  timeMinutes: number;
}

export type JourneyLeg = TransitLeg | WalkingLeg;

export interface RoutingResult {
  success: true;
  totalTimeMinutes: number;
  totalFare: number;
  legs: JourneyLeg[];
}

export interface RoutingError {
  success: false;
  error: string;
}

export type RoutingResponse = RoutingResult | RoutingError;
