import React from 'react';
import { RetroPanel } from '@/components/ui/Cards';

export default function Loading() {
  return (
    <div className="w-full max-w-5xl mx-auto pb-12 pt-6 px-4 animate-pulse">
      {/* Detail view skeleton */}
      <RetroPanel className="w-full mb-6 p-6">
        {/* Title & header skeleton */}
        <div className="h-8 bg-border-dark/10 w-2/3 mb-4 rounded"></div>
        <div className="h-4 bg-border-dark/10 w-1/3 mb-6 rounded"></div>
        
        {/* Photo grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="col-span-2 aspect-[16/10] bg-border-dark/10 rounded"></div>
          <div className="flex flex-col gap-4">
            <div className="flex-1 bg-border-dark/10 rounded min-h-[120px]"></div>
            <div className="flex-1 bg-border-dark/10 rounded min-h-[120px]"></div>
          </div>
        </div>

        {/* Content columns skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="h-40 bg-border-dark/10 rounded w-full"></div>
            <div className="h-6 bg-border-dark/10 rounded w-1/4"></div>
            <div className="h-24 bg-border-dark/10 rounded w-full"></div>
          </div>
          <div className="flex flex-col gap-6">
            <div className="h-48 bg-border-dark/10 rounded w-full"></div>
            <div className="h-32 bg-border-dark/10 rounded w-full"></div>
          </div>
        </div>
      </RetroPanel>
    </div>
  );
}
