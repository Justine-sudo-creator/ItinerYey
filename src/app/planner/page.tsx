import React from 'react';
import { RoutePlanner } from '@/components/planner/RoutePlanner';
import { Badge } from '@/components/ui/Chips';
import { Route } from 'lucide-react';

export const metadata = {
  title: 'Route Planner — ItinerYey',
  description: 'Find the optimal multi-vehicle commute route in Metro Manila using our A* transit engine.',
};

export default function PlannerPage() {
  return (
    <div className="flex flex-col w-full min-h-screen pb-20 relative">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pt-4 border-b-2 border-border-dark pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Route className="w-7 h-7 text-accent-coral" />
            <h1 className="text-3xl md:text-4xl font-display font-bold text-primary leading-tight">
              Route Planner
            </h1>
            <Badge label="A* ENGINE" variant="warning" className="hidden sm:inline-block ml-2" />
          </div>
          <p className="text-secondary font-medium max-w-2xl">
            Drop two pins on the map and our A* pathfinding engine will calculate the optimal multi-vehicle commute — including walking transfers between stops.
          </p>
        </div>
      </div>

      {/* Planner */}
      <RoutePlanner />
    </div>
  );
}
