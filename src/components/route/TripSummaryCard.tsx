'use client';

import React from 'react';
import { TripSummary, TRANSPORT_EMOJI, modeLabel } from '@/lib/routeSummary';
import { Clock, Coins, ArrowLeftRight } from 'lucide-react';

interface TripSummaryCardProps {
  summary: TripSummary;
}

export function TripSummaryCard({ summary }: TripSummaryCardProps) {
  const modeChips = Object.entries(summary.modeBreakdown).map(([type, count]) => ({
    type,
    count,
    emoji: TRANSPORT_EMOJI[type] || '🚌',
    label: modeLabel(type, count),
  }));

  return (
    <div className="flex flex-wrap gap-2 pt-3 border-t border-border-dark/10">
      {summary.duration && (
        <SummaryChip icon={<Clock className="w-3.5 h-3.5" />} value={summary.duration} />
      )}
      <SummaryChip icon={<Coins className="w-3.5 h-3.5" />} value={`₱${summary.totalFare}`} />
      {summary.transfers > 0 && (
        <SummaryChip
          icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
          value={summary.transfers === 1 ? '1 transfer' : `${summary.transfers} transfers`}
        />
      )}
      {modeChips.map(({ type, emoji, label }) => (
        <span
          key={type}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-border-dark/30 rounded-full text-xs font-bold text-primary"
        >
          <span aria-hidden>{emoji}</span>
          {label}
        </span>
      ))}
      {summary.walkCount > 0 && !summary.modeBreakdown['Walk'] && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-border-dark/30 rounded-full text-xs font-bold text-primary">
          <span aria-hidden>🚶</span>
          {summary.walkCount === 1 ? '1 walk' : `${summary.walkCount} walks`}
        </span>
      )}
    </div>
  );
}

function SummaryChip({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/5 border border-border-dark/40 rounded-full text-xs font-black text-primary">
      {icon}
      {value}
    </span>
  );
}
