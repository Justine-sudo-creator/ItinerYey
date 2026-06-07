import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

function getAppRegion(regionName: string): string {
  const ncr = ['NCR', 'National Capital Region', 'Metro Manila'];
  const northCentral = ['CAR', 'Region I', 'Region II', 'Region III'];
  const southBicol = ['Region IV-A', 'MIMAROPA', 'Region IV-B', 'Region V'];
  const visayas = ['Region VI', 'Region VII', 'Region VIII', 'NIR'];
  const mindanao = ['Region IX', 'Region X', 'Region XI', 'Region XII', 'Region XIII', 'BARMM'];

  if (ncr.some(r => regionName.toLowerCase().includes(r.toLowerCase()))) return 'Metro Manila';
  if (northCentral.some(r => regionName.toLowerCase().includes(r.toLowerCase()))) return 'North & Central Luzon';
  if (southBicol.some(r => regionName.toLowerCase().includes(r.toLowerCase()))) return 'South Luzon & Bicol';
  if (visayas.some(r => regionName.toLowerCase().includes(r.toLowerCase()))) return 'Visayas';
  if (mindanao.some(r => regionName.toLowerCase().includes(r.toLowerCase()))) return 'Mindanao';
  return 'Other';
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

async function seed() {
  console.log('Fetching PSGC data from psgc.gitlab.io/api...');
  
  // 1. Fetch Regions
  const regionsData = await fetchJson('https://psgc.gitlab.io/api/regions');
  const regionMap = new Map();
  regionsData.forEach((r: any) => {
    regionMap.set(r.code, { name: r.regionName || r.name, appRegion: getAppRegion(r.regionName || r.name) });
  });

  // 2. Fetch Provinces
  const provincesData = await fetchJson('https://psgc.gitlab.io/api/provinces');
  const provinceMap = new Map();
  provincesData.forEach((p: any) => {
    provinceMap.set(p.code, { name: p.name, regionCode: p.regionCode });
  });

  // 3. Fetch Cities
  const citiesData = await fetchJson('https://psgc.gitlab.io/api/cities');
  const cityMap = new Map();
  citiesData.forEach((c: any) => {
    cityMap.set(c.code, { name: c.name, provinceCode: c.provinceCode, regionCode: c.regionCode });
  });

  // 4. Fetch Municipalities
  const municipalitiesData = await fetchJson('https://psgc.gitlab.io/api/municipalities');
  municipalitiesData.forEach((m: any) => {
    cityMap.set(m.code, { name: m.name, provinceCode: m.provinceCode, regionCode: m.regionCode });
  });

  // 5. Fetch Barangays (can be large, ~42k)
  console.log('Fetching Barangays... This might take a moment.');
  const barangaysData = await fetchJson('https://psgc.gitlab.io/api/barangays');

  const locations: any[] = [];

  // Helper to push to locations array
  const pushLocation = (code: string, name: string, type: string, regCode: string, provCode?: string, cityCode?: string) => {
    const reg = regionMap.get(regCode);
    const prov = provCode ? provinceMap.get(provCode) : null;
    const city = cityCode ? cityMap.get(cityCode) : null;

    locations.push({
      code,
      name,
      type,
      region_name: reg ? reg.name : null,
      province_name: prov ? prov.name : null,
      city_name: city ? city.name : null,
      app_region: reg ? reg.appRegion : 'Other'
    });
  };

  // Process Regions
  regionsData.forEach((r: any) => pushLocation(r.code, r.name, 'Reg', r.code));
  
  // Process Provinces
  provincesData.forEach((p: any) => pushLocation(p.code, p.name, 'Prov', p.regionCode, p.code));

  // Process Cities and Municipalities
  citiesData.forEach((c: any) => pushLocation(c.code, c.name, 'City', c.regionCode, c.provinceCode, c.code));
  municipalitiesData.forEach((m: any) => pushLocation(m.code, m.name, 'Mun', m.regionCode, m.provinceCode, m.code));

  // Process Barangays
  barangaysData.forEach((b: any) => {
    pushLocation(b.code, b.name, 'Bgy', b.regionCode, b.provinceCode, b.cityCode || b.municipalityCode);
  });

  console.log(`Prepared ${locations.length} locations. Inserting into Supabase...`);

  // Batch insert into supabase
  const BATCH_SIZE = 1000;
  for (let i = 0; i < locations.length; i += BATCH_SIZE) {
    const batch = locations.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('locations').upsert(batch, { onConflict: 'code' });
    if (error) {
      console.error(`Error inserting batch ${i}:`, error);
    } else {
      console.log(`Inserted ${i + batch.length} / ${locations.length}`);
    }
  }

  console.log('Done!');
}

seed().catch(console.error);
