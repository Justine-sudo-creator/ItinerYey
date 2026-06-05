import React from 'react';

export function PrimaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`bg-accent-coral text-primary font-bold py-2 px-4 border-2 border-border-dark rounded-sm shadow-hard-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`bg-surface text-primary font-bold py-2 px-4 border-2 border-border-dark rounded-sm active:translate-y-[1px] active:translate-x-[1px] transition-all ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`flex items-center justify-center w-10 h-10 bg-surface border-2 border-border-dark rounded-sm shadow-hard-sm active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
