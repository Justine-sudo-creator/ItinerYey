import { NextRequest, NextResponse } from 'next/server';
import { findRoute } from '@/lib/routingEngine';
import type { RoutingResponse } from '@/types/routing';

// Force Node.js runtime — the routing engine is CPU-intensive and uses the
// service role client which requires full Node.js APIs (not the Edge runtime).
export const runtime = 'nodejs';

// Disable static caching — results depend on live DB data.
export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/route-planner?startLat=&startLng=&endLat=&endLng=
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    // ── Parse & validate query params ───────────────────────────────────────
    const startLatRaw = searchParams.get('startLat');
    const startLngRaw = searchParams.get('startLng');
    const endLatRaw   = searchParams.get('endLat');
    const endLngRaw   = searchParams.get('endLng');

    const missing: string[] = [];
    if (!startLatRaw) missing.push('startLat');
    if (!startLngRaw) missing.push('startLng');
    if (!endLatRaw)   missing.push('endLat');
    if (!endLngRaw)   missing.push('endLng');

    if (missing.length > 0) {
      return NextResponse.json<RoutingResponse>(
        { success: false, error: `Missing required query parameters: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const startLat = parseFloat(startLatRaw!);
    const startLng = parseFloat(startLngRaw!);
    const endLat   = parseFloat(endLatRaw!);
    const endLng   = parseFloat(endLngRaw!);

    const isValidCoord = (n: number) => !isNaN(n) && isFinite(n);
    if (![startLat, startLng, endLat, endLng].every(isValidCoord)) {
      return NextResponse.json<RoutingResponse>(
        { success: false, error: 'One or more coordinate values are not valid numbers.' },
        { status: 400 }
      );
    }

    // Sanity-check for Manila/Metro-Manila bounding box (loose)
    // Lat: 14.0–14.9  |  Lng: 120.8–121.2
    const inPH = (lat: number, lng: number) =>
      lat >= 5 && lat <= 21 && lng >= 116 && lng <= 127;

    if (!inPH(startLat, startLng) || !inPH(endLat, endLng)) {
      return NextResponse.json<RoutingResponse>(
        { success: false, error: 'Coordinates appear to be outside the Philippines.' },
        { status: 400 }
      );
    }

    // ── Run the routing engine ────────────────────────────────────────────────
    console.log(`[route-planner] Finding route (${startLat},${startLng}) → (${endLat},${endLng})`);
    const t0 = Date.now();

    const result = await findRoute({ startLat, startLng, endLat, endLng });

    const elapsed = Date.now() - t0;
    console.log(`[route-planner] Completed in ${elapsed}ms. Success: ${result.success}`);

    // ── Return result ─────────────────────────────────────────────────────────
    if (!result.success) {
      return NextResponse.json<RoutingResponse>(result, { status: 404 });
    }

    return NextResponse.json<RoutingResponse>(result, {
      status: 200,
      headers: {
        // Allow short-lived caching at CDN/browser level (15 seconds)
        // since the GTFS graph rarely changes in real-time.
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
        'X-Routing-Time-Ms': String(elapsed),
      },
    });
  } catch (err: unknown) {
    console.error('[route-planner] Unhandled error:', err);
    return NextResponse.json<RoutingResponse>(
      { success: false, error: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}
