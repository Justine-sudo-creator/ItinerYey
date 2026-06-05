import React from 'react';
import { BrowseFeed } from '@/components/feed/BrowseFeed';
import { PrimaryButton } from '@/components/ui/Button';
import Link from 'next/link';
import { Badge } from '@/components/ui/Chips';

export default function Home() {
  return (
    <div className="flex flex-col w-full min-h-screen pb-20 relative">
      {/* Browse Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pt-4 border-b-2 border-border-dark pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-primary leading-tight">
              Browse Trips
            </h1>
            <Badge label="COMMUNITY TRAVEL BOARD" variant="warning" className="hidden sm:inline-block ml-2" />
          </div>
          <p className="text-secondary font-medium">
            Gusto mo bang gumala on a budget? See actual spend, routes, itineraries, and tips from fellow travelers.
          </p>
        </div>
        
        {/* Prominent action button */}
        <div className="shrink-0">
          <Link href="/submit">
            <PrimaryButton className="text-xs sm:text-sm md:text-base py-2.5 px-4 md:py-3 md:px-6">
              Share Your Trip
            </PrimaryButton>
          </Link>
        </div>
      </div>
      
      {/* Feed Area */}
      <BrowseFeed />
    </div>
  );
}
