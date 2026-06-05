import React from 'react';

interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
}

export function FilterChip({ active, label, className = '', ...props }: FilterChipProps) {
  return (
    <button
      className={`px-3 py-1 text-sm font-bold border-2 border-border-dark rounded-sm whitespace-nowrap transition-colors ${
        active ? 'bg-accent-yellow text-primary' : 'bg-surface text-secondary hover:bg-soft-beige'
      } ${className}`}
      {...props}
    >
      {label}
    </button>
  );
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
  variant?: 'neutral' | 'success' | 'warning' | 'info' | 'error';
}

export function Badge({ label, variant = 'neutral', className = '', ...props }: BadgeProps) {
  let bgClass = 'bg-surface text-primary';
  switch (variant) {
    case 'success': bgClass = 'bg-accent-green text-primary'; break;
    case 'warning': bgClass = 'bg-accent-yellow text-primary'; break;
    case 'info': bgClass = 'bg-accent-blue text-primary'; break;
    case 'error': bgClass = 'bg-accent-coral text-primary'; break;
    default: bgClass = 'bg-surface text-primary'; break;
  }

  return (
    <span
      className={`inline-block px-2 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider border-2 border-border-dark rounded-none shadow-hard-sm ${bgClass} ${className}`}
      {...props}
    >
      {label}
    </span>
  );
}
