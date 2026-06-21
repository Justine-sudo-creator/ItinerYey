'use client';

import React from 'react';
import { ArrowRight } from 'lucide-react';

interface TransferConnectorProps {
  text: string;
}

export function TransferConnector({ text }: TransferConnectorProps) {
  return (
    <div className="flex items-center gap-2 py-2.5 px-4 my-1 ml-0 sm:ml-16 rounded-r-md border-l-4 bg-green-50 border-green-500">
      <ArrowRight className="w-4 h-4 shrink-0 text-green-600" />
      <p className="text-sm font-bold text-primary leading-snug">{text}</p>
    </div>
  );
}
