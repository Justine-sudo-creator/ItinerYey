import React from 'react';

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
