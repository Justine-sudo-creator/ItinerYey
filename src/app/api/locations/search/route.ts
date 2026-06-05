import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { searchNominatim } from '@/lib/nominatim';
import { extractLocationRegion } from '@/lib/locations';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const isOrigin = searchParams.get('isOrigin') === 'true';

  if (!q || q.length < 3) {
    return NextResponse.json([]);
  }

  try {
    const cleanQ = q.trim().toLowerCase();
    const cacheKey = isOrigin ? `origin-${cleanQ}` : cleanQ;

    // 1. Search PSGC database (Supabase) for exact/partial official matches
    const { data: psgcData, error } = await supabase
      .from('locations')
      .select('code, name, type, province_name, city_name, app_region')
      .ilike('name', `%${q}%`)
      .limit(5);

    if (error) {
      console.error('Supabase query error:', error);
    }

    // Format PSGC results
    const psgcResults = (psgcData || []).map(loc => {
      let displayName = loc.name;
      if (loc.type === 'Bgy' && loc.city_name) displayName += `, ${loc.city_name}`;
      if (loc.province_name && loc.type !== 'Prov') displayName += `, ${loc.province_name}`;

      return {
        id: `psgc-${loc.code}`,
        name: displayName,
        shortName: loc.name,
        type: loc.type === 'Bgy' ? 'Barangay' : loc.type === 'Mun' ? 'Municipality' : loc.type === 'Prov' ? 'Province' : loc.type,
        region: loc.app_region,
        source: 'psgc',
        structured: {
          place_id: `psgc-${loc.code}`,
          lat: null,
          lng: null,
          city: loc.city_name,
          province: loc.province_name,
          country: 'Philippines'
        }
      };
    });

    // 1.5. If this is an Origin query, return PSGC results immediately to avoid slow external APIs
    if (isOrigin) {
      return NextResponse.json(psgcResults);
    }

    // 2. Check the local Supabase cache for POIs
    const { data: cachedRow } = await supabase
      .from('location_search_cache')
      .select('results')
      .eq('query', cacheKey)
      .maybeSingle();

    if (cachedRow?.results) {
      const cachedOsmResults = cachedRow.results as Record<string, unknown>[];
      return NextResponse.json([...psgcResults, ...cachedOsmResults]);
    }

    // 3. Cache Miss: Resolve using Gemini with a strict timeout
    const geminiApiKey = process.env.GEMINI_API_KEY;
    let osmResults: Record<string, unknown>[] = [];
    let resolvedByGemini = false;

    if (geminiApiKey) {
      try {
        const promptText = `You are an expert in Philippine geography. The user is searching for a location/destination/point of interest in the Philippines: "${q}".
Resolve this search query into a list of the top 3 most likely matching specific locations, landmarks, or POIs in the Philippines they are looking for.

Return a JSON array where each item has this exact JSON structure:
{
  "name": "Brief, clean name of the spot (e.g., 'Binondo', 'Bonifacio High Street', 'Tomas Morato')",
  "city": "Name of the City or Municipality (e.g., 'Manila', 'Taguig', 'Quezon City')",
  "province": "Name of the Province, or null for NCR",
  "appRegion": "One of these exact region labels: 'Metro Manila', 'North & Central Luzon', 'South Luzon & Bicol', 'Visayas', 'Mindanao'",
  "lat": 14.5995,
  "lng": 120.9842
}

Ensure the coordinates are as accurate as possible for the spot.
Provide your response ONLY as a valid JSON array, without any markdown formatting or backticks.`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2-second timeout

        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: promptText
                }]
              }],
              generationConfig: {
                responseMimeType: "application/json"
              }
            })
          }
        );
        clearTimeout(timeoutId);

        if (geminiResponse.ok) {
          const data = await geminiResponse.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            const parsed = JSON.parse(text);
            osmResults = parsed.map((item: { name: string; city: string | null; province: string | null; appRegion: string; lat: number; lng: number }, index: number) => {
              const cityProv = [item.city, item.province].filter(Boolean).join(', ');
              return {
                id: `ai-${cacheKey}-${index}`,
                name: item.name,
                shortName: item.name,
                type: 'POI',
                region: cityProv ? `${cityProv} (${item.appRegion})` : item.appRegion,
                source: 'osm',
                structured: {
                  place_id: `ai-${cacheKey}-${index}`,
                  lat: item.lat,
                  lng: item.lng,
                  city: item.city,
                  province: item.province,
                  country: 'Philippines'
                }
              };
            });
            resolvedByGemini = true;

            // Save resolved results in the Supabase cache
            await supabase
              .from('location_search_cache')
              .insert({ query: cacheKey, results: osmResults });
          }
        } else {
          const errText = await geminiResponse.text();
          try {
            fs.writeFileSync('gemini-error.log', JSON.stringify({
              status: geminiResponse.status,
              error: errText,
              hasKey: !!geminiApiKey,
              keyLength: geminiApiKey?.length
            }, null, 2));
          } catch {}
        }
      } catch (geminiError: unknown) {
        const errorDetails = geminiError instanceof Error ? geminiError.message : String(geminiError);
        const errorStack = geminiError instanceof Error ? geminiError.stack : undefined;
        console.error('Gemini query error, falling back to OSM:', geminiError);
        try {
          fs.writeFileSync('gemini-error.log', JSON.stringify({
            error: errorDetails,
            stack: errorStack,
            hasKey: !!geminiApiKey,
            keyLength: geminiApiKey?.length
          }, null, 2));
        } catch {}
      }
    }

    // 4. Fallback to OpenStreetMap if Gemini is unavailable or failed
    if (!resolvedByGemini) {
      try {
        const osmData = await searchNominatim(q);
        
        // Batch query Supabase to resolve appRegion for cities/provinces to avoid queries inside loop
        const namesToQuery = new Set<string>();
        for (const res of osmData) {
          const addr = extractLocationRegion(res.address);
          if (addr.city) namesToQuery.add(addr.city.toLowerCase());
          if (addr.province) namesToQuery.add(addr.province.toLowerCase());
        }

        const appRegionMap = new Map<string, string>();
        if (namesToQuery.size > 0) {
          const namesArray = Array.from(namesToQuery);
          // Query matching locations in batch
          const { data: matches } = await supabase
            .from('locations')
            .select('name, app_region, type')
            .or(namesArray.map(name => `name.ilike.%${name}%`).join(','));
          
          if (matches && matches.length > 0) {
            // Prefer higher-level geographic ranks (Province > City > Region > Mun > Bgy)
            const sortedMatches = [...matches].sort((a, b) => {
              const rank = { 'Prov': 1, 'City': 2, 'Reg': 3, 'Mun': 4, 'Bgy': 5 };
              return (rank[a.type as keyof typeof rank] || 9) - (rank[b.type as keyof typeof rank] || 9);
            });
            for (const match of sortedMatches) {
              const matchLower = match.name.toLowerCase();
              if (!appRegionMap.has(matchLower)) {
                appRegionMap.set(matchLower, match.app_region);
              }
            }
          }
        }

        const uniqueOsm = new Map();
        for (const res of osmData) {
          // Skip large administrative regions/cities already covered by PSGC, but keep suburbs/neighborhoods!
          if ((res.type === 'administrative' || res.type === 'city' || res.type === 'town') && 
              res.addresstype !== 'suburb' && 
              res.addresstype !== 'neighbourhood') {
            continue;
          }

          const addr = extractLocationRegion(res.address);
          let appRegion = 'Other';
          if (addr.city && appRegionMap.has(addr.city.toLowerCase())) {
            appRegion = appRegionMap.get(addr.city.toLowerCase())!;
          } else if (addr.province && appRegionMap.has(addr.province.toLowerCase())) {
            appRegion = appRegionMap.get(addr.province.toLowerCase())!;
          }
 
          const id = `osm-${res.place_id}`;
          if (!uniqueOsm.has(id)) {
            const poiName = res.name || res.display_name.split(',')[0];
            const cityProv = [
              addr.city,
              addr.province
            ].filter(Boolean).join(', ');
            
            const cleanRegion = cityProv ? `${cityProv} (${appRegion})` : appRegion;
 
            uniqueOsm.set(id, {
              id,
              name: poiName.trim(),
              shortName: poiName.trim(),
              type: 'POI',
              region: cleanRegion,
              source: 'osm',
              structured: {
                place_id: res.osm_id ? `${res.osm_type}:${res.osm_id}` : res.place_id.toString(),
                lat: parseFloat(res.lat),
                lng: parseFloat(res.lon),
                city: addr.city,
                province: addr.province,
                country: addr.country || 'Philippines'
              }
            });
          }
        }
        osmResults = Array.from(uniqueOsm.values()).slice(0, 5);

        // Also cache OSM results so we don't hit the rate limits for raw queries either!
        if (osmResults.length > 0) {
          await supabase
            .from('location_search_cache')
            .insert({ query: cleanQ, results: osmResults });
        }
      } catch (osmError) {
        console.error('OSM fallback query error:', osmError);
      }
    }
 
    // 5. Return PSGC + POI results
    const combined = [...psgcResults, ...osmResults];
    return NextResponse.json(combined);

  } catch (err) {
    console.error('Search API error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
