'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';
import { TripPriceSuggestion, User } from '@/types/supabase';
import { RetroPanel, SectionHeader } from '@/components/ui/Cards';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

export default function ManageTripAudits({ tripId }: { tripId: string }) {
  const [suggestions, setSuggestions] = useState<(TripPriceSuggestion & { users: User })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchSuggestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trip_price_suggestions')
      .select('*, users!inner(*)')
      .eq('trip_id', tripId)
      .eq('status', 'pending');
    
    if (!error && data) {
      setSuggestions(data as any[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSuggestions();
  }, [tripId]);

  const handleUpdate = async (id: string, newStatus: 'approved' | 'rejected', category: string, amount: number) => {
    // For MVP, if approved, we'd normally run a transaction or trigger to update the trips table.
    // Let's do it sequentially from the client if RLS allows, but RLS on trips allows owners to update.
    if (newStatus === 'approved') {
      const dbCategory = category.toLowerCase() === 'activities' ? 'activities_cost' : `${category.toLowerCase()}_cost`;
      
      // Update trip cost
      const { error: tripError } = await supabase
        .from('trips')
        .update({ [dbCategory]: amount } as any)
        .eq('id', tripId);
      
      if (tripError) {
        alert('Failed to update trip cost: ' + tripError.message);
        return;
      }
    }

    // Update suggestion status
    const { error } = await supabase
      .from('trip_price_suggestions')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setSuggestions(suggestions.filter(s => s.id !== id));
      if (newStatus === 'approved') {
        window.location.reload(); // Quick refresh to show new totals
      }
    }
  };

  if (loading || suggestions.length === 0) return null;

  return (
    <RetroPanel className="p-6 border-accent-coral bg-accent-coral/5 mt-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertCircle className="w-5 h-5 text-accent-coral shrink-0" />
        <h2 className="text-lg font-black uppercase tracking-tight">Pending Price Audits</h2>
      </div>
      <p className="text-xs font-bold text-secondary uppercase tracking-wider mb-4">
        Other travelers have suggested corrections to your budget.
      </p>

      <div className="flex flex-col gap-3">
        {suggestions.map(s => (
          <div key={s.id} className="p-4 border-2 border-border-dark bg-white shadow-hard-sm">
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="font-bold text-sm">
                  {s.category} Update suggested by @{s.users.display_name}
                </p>
                <p className="text-lg font-black text-accent-coral mt-1">
                  New Amount: ₱{s.suggested_amount.toLocaleString()}
                </p>
                <p className="text-xs text-secondary mt-2 bg-soft-beige p-2 border border-border-dark">
                  "{s.reason}"
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <Link 
                  href={`/trip/${tripId}/edit`}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 border-2 border-border-dark bg-accent-green text-white font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-all text-center"
                >
                  Edit Trip
                </Link>
                <button 
                  onClick={() => handleUpdate(s.id, 'rejected', s.category, s.suggested_amount)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 border-2 border-border-dark bg-white text-secondary font-bold text-xs uppercase shadow-hard-sm hover:translate-y-0.5 transition-all"
                >
                  <XCircle className="w-3.5 h-3.5" /> Dismiss
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </RetroPanel>
  );
}
