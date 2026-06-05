import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabaseAdmin
    .from('trips')
    .select('*')
    .limit(1);

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  // To get policies, we can try to query pg_policies if exposed.
  // Often it's not exposed, but let's try a direct query via a raw SQL rpc if exists, 
  // or just return the trips data to verify service_role works.
  
  // Wait, we can't query pg_policies via standard supabase-js unless there's an RPC.
  // Instead, let's see if we can trigger the insert via service_role to see if it's RLS or a CHECK constraint.
  
  return NextResponse.json({ data });
}
