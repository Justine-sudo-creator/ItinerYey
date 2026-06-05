'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { User as AuthUser } from '@supabase/supabase-js';
import type { User as ProfileUser } from '@/types/supabase';

export function useCurrentUserProfile() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setAuthUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      setAuthUser(session.user);

      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (profileData) {
        setProfile(profileData as ProfileUser);
      }
      setLoading(false);
    };

    loadUser().then(() => {
      if (!mounted) return;
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        if (session) {
          setAuthUser(session.user);
          supabase.from('users').select('*').eq('id', session.user.id).single().then(({data}) => {
             if (mounted && data) setProfile(data as ProfileUser);
          });
        } else {
          setAuthUser(null);
          setProfile(null);
        }
      }
    });

    // Custom event listener for manual profile refreshes (e.g., after temporary unlock)
    const handleProfileUpdate = () => {
      if (mounted) loadUser();
    };
    window.addEventListener('profile-updated', handleProfileUpdate);

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
      window.removeEventListener('profile-updated', handleProfileUpdate);
    }
  }, [supabase]);

  const refreshProfile = () => {
    window.dispatchEvent(new Event('profile-updated'));
  };

  return { authUser, profile, loading, refreshProfile };
}
