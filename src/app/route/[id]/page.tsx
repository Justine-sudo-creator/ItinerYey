import { createClient } from '@/utils/supabase/server';
import { RouteDetailView } from '@/components/route/RouteDetailView';
import { notFound } from 'next/navigation';
import React from 'react';
import { Route, RouteSegment } from '@/types/supabase';

interface RoutePageProps {
  params: { id: string };
}

export default async function RoutePage({ params }: RoutePageProps) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const currentUserId = session?.user?.id || null;

  const { data: routeData, error } = await supabase
    .from('routes')
    .select('*, users!routes_user_id_fkey(display_name, avatar_url)')
    .eq('id', params.id)
    .single();

  if (error || !routeData) {
    console.error('Failed to load route:', error);
    notFound();
  }

  const { data: segments } = await supabase
    .from('route_segments')
    .select('*')
    .eq('route_id', params.id)
    .order('display_order', { ascending: true });

  return (
    <div className="min-h-screen px-4 pb-20">
      <RouteDetailView 
        route={routeData as unknown as Route} 
        segments={segments as unknown as RouteSegment[]} 
        currentUserId={currentUserId}
      />
    </div>
  );
}
