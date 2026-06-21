'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Route } from '@/types/supabase';
import { RouteCard } from './RouteCard';
import { PrimaryButton } from '@/components/ui/Button';
import { ErrorState, EmptyState, LoadingState } from '@/components/ui/States';
import { Search, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';

const FILTER_PILLS = [
  { id: 'all',      label: 'All Routes' },
  { id: 'jeepney',  label: '🛺 Jeepneys' },
  { id: 'uv',       label: '🚐 UV Express' },
  { id: 'trains',   label: '🚊 Trains (MRT/LRT)' },
  { id: 'verified', label: '🟢 Community Verified' },
] as const;

type FilterId = (typeof FILTER_PILLS)[number]['id'];

/** Number of routes shown per page */
const PAGE_SIZE = 20;

/** Maps filter pill IDs to RPC arguments */
function filterToRpcArgs(filter: FilterId): {
  transport_types: string[] | null;
  min_confidence: number | null;
} {
  switch (filter) {
    case 'jeepney':  return { transport_types: ['Jeep'],               min_confidence: null };
    case 'uv':       return { transport_types: ['UV Express'],         min_confidence: null };
    case 'trains':   return { transport_types: ['MRT', 'LRT'],         min_confidence: null };
    case 'verified': return { transport_types: null,                   min_confidence: 80   };
    default:         return { transport_types: null,                   min_confidence: null };
  }
}

export function BrowseRoutes() {
  const supabase = createClient();

  const [routes,  setRoutes]  = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Search is committed on Enter / button — not on every keystroke
  const [searchInput,  setSearchInput]  = useState('');
  const [searchQuery,  setSearchQuery]  = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterId>('all');

  // Pagination
  const [page,       setPage]       = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // ── Fetch via RPC ──────────────────────────────────────────────────────────
  // browse_routes_filtered() uses EXISTS + composite index on route_segments
  // so transport-type filters never cause a full table scan.
  const fetchRoutes = useCallback(async (
    query:     string,
    filter:    FilterId,
    pageIndex: number,
  ) => {
    setLoading(true);
    setError('');
    try {
      const { transport_types, min_confidence } = filterToRpcArgs(filter);

      const { data, error: rpcError } = await supabase.rpc(
        'browse_routes_filtered',
        {
          transport_types,
          min_confidence,
          search_text: query.trim() || '',
          page_offset: pageIndex * PAGE_SIZE,
          page_limit:  PAGE_SIZE,
        }
      );

      if (rpcError) throw rpcError;

      const rows = (data ?? []) as (Route & { total_count: number })[];
      setRoutes(rows as Route[]);
      setTotalCount(rows.length > 0 ? rows[0].total_count : 0);
    } catch (err: unknown) {
      console.error(err);
      setError(
        `Couldn't load routes. Details: ${(err as Error)?.message ?? String(err)}`
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Re-fetch on any dependency change
  useEffect(() => {
    fetchRoutes(searchQuery, activeFilter, page);
  }, [fetchRoutes, searchQuery, activeFilter, page]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const commitSearch = () => {
    setPage(0);
    setSearchQuery(searchInput);
  };

  const handleFilterChange = (filter: FilterId) => {
    setPage(0);
    setActiveFilter(filter);
  };

  const handlePageChange = (next: number) => {
    if (next < 0 || next >= totalPages) return;
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-6">

      {/* Search Header */}
      <div className="bg-surface border border-border-dark p-6 rounded-xl shadow-hard mt-2">
        <h2 className="text-2xl font-display font-black text-primary mb-4">Where to?</h2>

        <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MapPin className="h-5 w-5 text-secondary animate-bounce" />
            </div>
            <input
              type="text"
              placeholder="e.g. UP Diliman to Cubao..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
              className="w-full h-full min-h-[56px] pl-10 pr-4 py-3 bg-soft-beige border border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue placeholder:text-secondary/60 font-medium transition-all text-base shadow-sm"
              aria-label="Search routes"
            />
          </div>
          <PrimaryButton
            className="shrink-0 sm:w-auto h-auto min-h-[56px] px-8 text-lg font-bold"
            onClick={commitSearch}
          >
            <Search className="w-5 h-5 mr-2 inline-block" /> Search
          </PrimaryButton>
        </div>

        {/* Filter Pills */}
        <div className="mt-4 overflow-x-auto pb-1">
          <div className="inline-flex gap-2 min-w-full">
            {FILTER_PILLS.map((pill) => {
              const isActive = activeFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  disabled={loading}
                  onClick={() => handleFilterChange(pill.id)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-wait ${
                    isActive
                      ? 'bg-primary text-white border-transparent shadow-sm'
                      : 'bg-surface text-primary border-border-dark hover:bg-surface/90'
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results header */}
      <div className="flex justify-between items-end border-b-2 border-border-dark pb-2">
        <p className="text-sm font-bold text-primary uppercase tracking-wide">
          {loading
            ? 'Loading...'
            : totalCount === 0
            ? 'No routes found'
            : searchQuery
            ? `Results for "${searchQuery}" — ${totalCount} found`
            : `Showing ${routes.length} of ${totalCount} routes`}
        </p>
        {totalPages > 1 && !loading && (
          <p className="text-xs text-secondary font-medium">
            Page {page + 1} of {totalPages}
          </p>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <LoadingState message="Loading routes..." />
      ) : error ? (
        <ErrorState
          title="Error"
          message={error}
          action={
            <PrimaryButton onClick={() => fetchRoutes(searchQuery, activeFilter, page)}>
              Retry
            </PrimaryButton>
          }
        />
      ) : routes.length === 0 ? (
        <EmptyState
          title="No routes found"
          message={
            activeFilter !== 'all'
              ? `No routes match the "${FILTER_PILLS.find(p => p.id === activeFilter)?.label}" filter.`
              : "We couldn't find any routes matching your search."
          }
        />
      ) : (
        <>
          {/* Route cards */}
          <div className="flex flex-col gap-3 w-full">
            {routes.map((route) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0}
                className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border-dark text-sm font-semibold text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-soft-beige transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i)
                .filter((i) => Math.abs(i - page) <= 2)
                .map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handlePageChange(i)}
                    className={`w-9 h-9 rounded-lg border text-sm font-bold transition-colors ${
                      i === page
                        ? 'bg-primary text-white border-transparent'
                        : 'border-border-dark text-primary hover:bg-soft-beige'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}

              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-4 py-2 rounded-lg border border-border-dark text-sm font-semibold text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-soft-beige transition-colors"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
