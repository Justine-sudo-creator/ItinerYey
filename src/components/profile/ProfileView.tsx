'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Route, RouteSegment, User } from '@/types/supabase';
import { RouteCard } from '@/components/feed/RouteCard';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { createClient } from '@/utils/supabase/client';
import { EmptyState } from '@/components/ui/States';
import { Pencil, Trash2, MapPin } from 'lucide-react';

type RouteWithSegments = Route & { route_segments: RouteSegment[] };

interface ProfileViewProps {
  profile: User;
  routes: RouteWithSegments[];
}

export function ProfileView({ profile, routes: initialRoutes }: ProfileViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [routes, setRoutes] = useState(initialRoutes);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleDelete = async (routeId: string) => {
    setDeletingId(routeId);
    setError('');
    try {
      const { error: deleteError } = await supabase
        .from('routes')
        .delete()
        .eq('id', routeId)
        .eq('user_id', profile.id);

      if (deleteError) throw deleteError;

      setRoutes((prev) => prev.filter((r) => r.id !== routeId));
      setConfirmDeleteId(null);
      router.refresh();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to delete route.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-16 pt-6 px-4">
      <div className="mb-8 border-b-2 border-border-dark pb-6">
        <h1 className="text-3xl font-display font-black text-primary mb-1">My Profile</h1>
        <p className="text-secondary font-medium">
          {profile.display_name || profile.email}
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-black text-primary flex items-center gap-2">
          <MapPin className="w-5 h-5 text-accent-coral" />
          My Submitted Routes
          <span className="text-sm font-bold text-secondary">({routes.length})</span>
        </h2>
        <Link href="/submit">
          <PrimaryButton className="text-xs py-2 px-4">Add Route</PrimaryButton>
        </Link>
      </div>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded font-bold text-sm">
          {error}
        </div>
      )}

      {routes.length === 0 ? (
        <EmptyState
          title="No routes yet"
          message="Share your daily commute to help others navigate."
          action={
            <Link href="/submit">
              <PrimaryButton>Submit Your First Route</PrimaryButton>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map((route) => {
            const segments = [...(route.route_segments || [])].sort(
              (a, b) => a.display_order - b.display_order
            );

            return (
              <div key={route.id} className="flex flex-col gap-2">
                <RouteCard route={route} segments={segments} />
                <div className="flex gap-2 px-1">
                  <Link href={`/route/${route.id}/edit`} className="flex-1">
                    <SecondaryButton className="w-full py-2 text-xs font-bold flex items-center justify-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </SecondaryButton>
                  </Link>
                  {confirmDeleteId === route.id ? (
                    <div className="flex gap-1 flex-1">
                      <button
                        type="button"
                        disabled={deletingId === route.id}
                        onClick={() => handleDelete(route.id)}
                        className="flex-1 py-2 text-xs font-bold border-2 border-red-600 bg-red-50 text-red-700 rounded-sm hover:bg-red-100 transition-all disabled:opacity-50"
                      >
                        {deletingId === route.id ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-2 text-xs font-bold border-2 border-border-dark bg-surface rounded-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(route.id)}
                      className="flex-1 py-2 text-xs font-bold border-2 border-border-dark bg-surface hover:bg-red-50 hover:border-red-300 hover:text-red-700 rounded-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
