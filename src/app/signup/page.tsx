'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RetroPanel, SectionHeader } from '@/components/ui/Cards';
import { TextInput } from '@/components/ui/Inputs';
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Safely read error parameter from URL on client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get('error');
      if (urlError) {
        setError(urlError);
      }
    }
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email.');
      return;
    }
    if (!password) {
      setError('Password cannot be empty.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // If email confirmation is enabled, session will be null.
        if (!authData.session) {
          setError('Please check your email to confirm your account before logging in.');
          return;
        }

        // Create/upsert the public.users row
        const { error: dbError } = await supabase.from('users').upsert({
          id: authData.user.id,
          email: authData.user.email,
          has_contributed: false,
          access_expires_at: null,
          display_name: authData.user.email?.split('@')[0] || 'User',
        } as never);

        if (dbError) {
          console.error('Profile initialization failed:', dbError);
          throw new Error('Failed to create user profile. Please check database permissions.');
        }

        const urlParams = new URLSearchParams(window.location.search);
        const returnTo = urlParams.get('returnTo');
        router.push(returnTo || '/onboarding');
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'An error occurred during signup.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError('');
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) throw authError;
    } catch (err: unknown) {
      setError((err as Error).message || 'An error occurred initiating Google sign-up.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[70vh]">
      <RetroPanel label="Create Account" className="w-full max-w-md">
        <SectionHeader title="Sign Up" />
        
        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          <TextInput 
            label="Email" 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          <TextInput 
            label="Password" 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          <TextInput 
            label="Confirm Password" 
            type="password" 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required 
          />
          
          {error && (
            <div className="bg-accent-coral border-2 border-border-dark p-2 text-primary font-bold text-sm">
              {error}
            </div>
          )}
          
          <PrimaryButton type="submit" disabled={loading} className="mt-4">
            {loading ? 'Creating Account...' : 'Sign Up'}
          </PrimaryButton>
        </form>

        <div className="relative my-6 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-dashed border-border-dark opacity-50"></div>
          </div>
          <span className="relative px-3 bg-surface text-secondary font-bold text-xs uppercase tracking-wider">
            Or
          </span>
        </div>

        <SecondaryButton 
          type="button" 
          onClick={handleGoogleSignup} 
          className="w-full flex items-center justify-center gap-2 border-2 shadow-hard-sm hover:bg-surface-alt active:translate-y-[2px] active:translate-x-[2px] active:shadow-none"
        >
          <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-5.84-4.53z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </SecondaryButton>

        <p className="mt-6 text-sm text-secondary text-center font-bold">
          Already have an account? <Link href="/login" className="text-primary underline hover:text-accent-blue">Log in here</Link>
        </p>
      </RetroPanel>
    </div>
  );
}
