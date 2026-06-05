import React from 'react';

interface StateProps {
  title: string;
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, message, action }: StateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-surface border-2 border-border-dark border-dashed rounded-sm m-4">
      <h3 className="text-xl font-bold text-primary mb-2 font-display">{title}</h3>
      <p className="text-secondary text-sm mb-6">{message}</p>
      {action}
    </div>
  );
}

export function LoadingState({ message = 'LOADING...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="border-2 border-border-dark bg-accent-yellow px-4 py-2 font-bold uppercase tracking-wider text-primary animate-pulse shadow-hard-sm">
        {message}
      </div>
    </div>
  );
}

export function ErrorState({ title = 'Error', message, action }: StateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 md:p-8 text-center bg-surface border-2 border-border-dark m-4 shadow-hard">
      <div className="absolute -top-3 left-4 bg-accent-coral border-2 border-border-dark px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        WARNING
      </div>
      <h3 className="text-xl font-bold text-accent-coral mb-2 font-display">{title}</h3>
      <p className="text-secondary text-sm mb-6">{message}</p>
      {action}
    </div>
  );
}
