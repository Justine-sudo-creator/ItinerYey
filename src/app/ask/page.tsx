import React from 'react';
import { Cpu } from 'lucide-react';
import { Badge } from '@/components/ui/Chips';
import { OfflineAssistant } from '@/components/assistant/OfflineAssistant';

export const metadata = {
  title: 'Ask ItinerYey (Offline AI) — ItinerYey',
  description: 'Ask for commute directions in Taglish or scan a jeepney signboard. Runs entirely on your device — no internet needed.',
};

export default function AskPage() {
  return (
    <div className="flex flex-col w-full min-h-screen pb-20 relative">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pt-4 border-b-2 border-border-dark pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-7 h-7 text-accent-coral" />
            <h1 className="text-3xl md:text-4xl font-display font-bold text-primary leading-tight">
              Ask ItinerYey
            </h1>
            <Badge label="100% ON-DEVICE AI" variant="warning" className="hidden sm:inline-block ml-2" />
          </div>
          <p className="text-secondary font-medium max-w-2xl">
            Ask for directions in Taglish or scan a jeepney signboard. The AI model, the route map and the
            A* planner all run on this device, so it keeps working with no signal and nothing is sent to the cloud.
          </p>
        </div>
      </div>

      <OfflineAssistant />
    </div>
  );
}
