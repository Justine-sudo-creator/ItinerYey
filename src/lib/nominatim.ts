export type NominatimResult = {
  place_id: number;
  osm_type?: string;
  osm_id?: number;
  lat: string;
  lon: string;
  name: string;
  display_name: string;
  address?: {
    mall?: string;
    tourism?: string;
    amenity?: string;
    city?: string;
    town?: string;
    municipality?: string;
    village?: string;
    suburb?: string;
    county?: string;
    province?: string;
    state?: string;
    region?: string;
    country?: string;
  };
  type: string;
  addresstype?: string;
};

// In-memory cache to prevent duplicate requests
const queryCache = new Map<string, NominatimResult[]>();

// Nominatim requires max 1 request per second.
let lastRequestTime = 0;

export async function searchNominatim(query: string): Promise<NominatimResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  // Check cache first
  if (queryCache.has(trimmed)) {
    return queryCache.get(trimmed)!;
  }

  // Rate limiting (1 request per second)
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLast));
  }
  
  lastRequestTime = Date.now();

  try {
    const params = new URLSearchParams({
      q: trimmed,
      format: 'json',
      addressdetails: '1',
      countrycodes: 'ph',
      limit: '8',
    });

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'ItinerYey/1.0 (https://itineryey.com)'
      }
    });

    if (!response.ok) {
      throw new Error('Nominatim API error');
    }

    const data: NominatimResult[] = await response.json();
    
    // Cache the result
    queryCache.set(trimmed, data);
    
    return data;
  } catch (error) {
    console.error('Failed to fetch from Nominatim', error);
    return []; // Graceful fallback on error
  }
}
