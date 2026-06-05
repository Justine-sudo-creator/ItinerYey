'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import type { User } from '@supabase/supabase-js';
import { HelpModal } from './HelpModal';
import { NotificationDrawer } from './NotificationDrawer';
import { Bell, HelpCircle, LogOut, Menu, X } from 'lucide-react';

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  useEffect(() => {
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);


  useEffect(() => {
    if (!user) {
      setUnreadNotifCount(0);
      return;
    }

    const fetchUnreadCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
        
      if (count !== null) setUnreadNotifCount(count);
    };

    fetchUnreadCount();

    const channel = supabase
      .channel('public:notifications:header')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const navLinks = [
    { href: '/', label: 'Feed' },
    { href: '/meetups', label: 'Meetups' },
    { href: '/submit', label: 'Submit' },
    { href: '/profile', label: 'Profile' },
  ];

  // For MVP client-side rendering hide/show. Real security is enforced server-side.
  const adminEmailsStr = process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'justinemationg12@gmail.com'; // fallback if they only set the private one
  const adminEmails = adminEmailsStr.split(',').map(e => e.trim().toLowerCase());
  const isAdmin = user?.email && adminEmails.includes(user.email.toLowerCase());

  if (isAdmin) {
    navLinks.push({ href: '/admin', label: 'Admin' });
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between w-full h-16 px-4 md:px-8 bg-soft-beige border-b-2 border-border-dark">
      <div className="flex items-center gap-8 w-full max-w-[1180px] mx-auto">
        <Link href="/" className="flex items-center gap-2 font-display font-bold tracking-tight text-primary text-xl md:text-2xl whitespace-nowrap group">
          <svg
            className="w-8 h-8 shrink-0 group-hover:scale-105 transition-transform duration-200"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M40 8C23.43 8 10 21.43 10 38c0 22.5 30 38 30 38s30-15.5 30-38c0-16.57-13.43-30-30-30z" 
              fill="#E25C43" 
              stroke="#2D3748" 
              strokeWidth="4.5" 
              strokeLinejoin="round"
            />
            <text 
              x="40" 
              y="48" 
              fill="#FCF5E3" 
              stroke="#2D3748" 
              strokeWidth="2" 
              fontFamily="system-ui, -apple-system, sans-serif" 
              fontWeight="900" 
              fontSize="28" 
              textAnchor="middle"
            >₱</text>
          </svg>
          <span>ItinerYey</span>
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 flex-1 ml-4">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.label} 
                href={link.href} 
                className={`text-primary font-bold text-sm uppercase tracking-wide px-3 py-1 border-2 transition-all rounded-sm ${
                  isActive 
                    ? 'bg-accent-yellow border-border-dark' 
                    : 'border-transparent hover:border-border-dark hover:bg-surface'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side utilities */}
        <div className="flex items-center gap-4 ml-auto">
          {user ? (
            <button 
              onClick={handleSignOut}
              className="hidden md:flex items-center gap-1.5 text-xs font-black uppercase tracking-wider border-2 border-border-dark px-3 py-1.5 bg-surface hover:bg-accent-coral hover:text-primary transition-all rounded-sm"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          ) : (
            <Link 
              href="/login"
              className="hidden md:flex items-center gap-1.5 text-xs font-black uppercase tracking-wider border-2 border-border-dark px-3 py-1.5 bg-accent-coral text-primary transition-all rounded-sm"
            >
              Login
            </Link>
          )}

          {user && (
            <button 
              onClick={() => setIsNotifOpen(true)}
              className="relative flex items-center justify-center w-8 h-8 md:w-10 md:h-10 border-2 border-border-dark bg-surface hover:bg-accent-yellow transition-all rounded-sm"
              aria-label="Notifications"
            >
              <Bell size={18} className="text-primary" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[1.25rem] h-5 px-1 bg-accent-coral text-primary text-[10px] font-black border-2 border-border-dark rounded-full">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </button>
          )}

          <button 
            onClick={() => setIsHelpOpen(true)}
            className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 border-2 border-border-dark bg-surface hover:bg-accent-yellow transition-all rounded-sm"
            aria-label="Help"
          >
            <HelpCircle size={18} className="text-primary" />
          </button>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`lg:hidden flex items-center justify-center w-8 h-8 md:w-10 md:h-10 border-2 border-border-dark transition-all rounded-sm ${
              isMenuOpen ? 'bg-accent-yellow' : 'bg-surface hover:bg-accent-yellow'
            }`}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={18} className="text-primary" /> : <Menu size={18} className="text-primary" />}
          </button>
        </div>
      </div>

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      
      {/* Notification Drawer */}
      <NotificationDrawer isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />

      {/* Mobile Navigation Drawer Side Menu */}
      {isMenuOpen && (
        <>
          {/* Overlay backdrop */}
          <div 
            onClick={() => setIsMenuOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-50 animate-in fade-in duration-200"
          />
          
          {/* Side Drawer */}
          <div className="lg:hidden absolute top-16 right-4 w-48 bg-soft-beige border-4 border-border-dark p-4 z-50 flex flex-col shadow-hard animate-in zoom-in-95 duration-200">
            {/* Drawer Header */}
            <div className="flex justify-between items-center pb-3 border-b-2 border-border-dark mb-4">
              <span className="font-display font-black text-sm uppercase tracking-wider text-primary">Menu</span>
              <button 
                onClick={() => setIsMenuOpen(false)}
                className="w-7 h-7 border-2 border-border-dark bg-surface shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link 
                    key={link.label} 
                    href={link.href} 
                    onClick={() => setIsMenuOpen(false)}
                    className={`text-primary font-black text-xs uppercase tracking-wider py-2 border-2 border-border-dark shadow-hard-sm transition-all rounded-sm text-center ${
                      isActive 
                        ? 'bg-accent-yellow' 
                        : 'bg-surface hover:bg-accent-yellow/20'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Footer action in drawer */}
            <div className="border-t-2 border-border-dark pt-3 mt-4">
              {user ? (
                <button 
                  onClick={() => {
                    setIsMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full block text-xs font-black uppercase tracking-wider border-2 border-border-dark py-2 bg-accent-coral text-primary shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all rounded-sm text-center"
                >
                  Sign Out
                </button>
              ) : (
                <Link 
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full block text-xs font-black uppercase tracking-wider border-2 border-border-dark py-2 bg-accent-coral text-primary shadow-hard-sm hover:translate-y-0.5 hover:shadow-none transition-all rounded-sm text-center"
                >
                  Login
                </Link>
              )}
            </div>

          </div>
        </>
      )}
    </header>
  );
}
