import React from 'react';

export function RetroPanel({ children, label, className = '' }: { children: React.ReactNode, label?: string, className?: string }) {
  return (
    <div className={`bg-soft-beige/30 border border-border-dark/15 rounded-lg shadow-sm p-4 md:p-6 relative ${className}`}>
      {label && (
        <div className="absolute -top-3 left-4 bg-accent-yellow border border-border-dark/15 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm">
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string, action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4 border-b border-border-dark/10 pb-2">
      <h2 className="text-xl md:text-2xl font-bold font-display text-primary">{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}
