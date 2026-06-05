'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'Feed', icon: 'F' },
    { href: '/leaderboard', label: 'Top', icon: '🏆' },
    { href: '/submit', label: 'Submit', icon: '+' },
    { href: '/saved', label: 'Saved', icon: '★' },
    { href: '/profile', label: 'Profile', icon: 'P' },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 w-full h-16 bg-surface border-t-2 border-border-dark flex z-50">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${
              isActive ? 'bg-accent-yellow border-t-4 border-t-border-dark' : 'hover:bg-soft-beige border-t-4 border-t-transparent'
            }`}
          >
            <div className={`font-bold text-sm ${isActive ? 'text-primary' : 'text-secondary'}`}>{item.icon}</div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-secondary'}`}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
