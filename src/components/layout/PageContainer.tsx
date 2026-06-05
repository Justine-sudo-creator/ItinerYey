import React from 'react';

export function PageContainer({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`w-full px-4 mx-auto md:max-w-[900px] lg:max-w-[1180px] pt-6 pb-6 ${className}`}>
      <div className="w-full h-full md:bg-surface md:border-2 md:border-border-dark md:shadow-hard md:p-6 transition-all">
        {children}
      </div>
    </div>
  );
}
