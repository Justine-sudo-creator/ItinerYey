import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // If next parameter is provided, redirect there after login, otherwise default to home page
  const next = searchParams.get('next') ?? '/';

  // Check if Supabase sent an error back in the URL parameters
  const oauthError = searchParams.get('error');
  const oauthErrorDescription = searchParams.get('error_description');
  if (oauthError || oauthErrorDescription) {
    console.error('OAuth callback error from Supabase:', oauthError, oauthErrorDescription);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(oauthErrorDescription || oauthError || 'Authentication failed')}`);
  }

  if (code) {
    const supabase = createClient();
    const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('OAuth exchange error:', error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
    
    if (authData?.user) {
      const userId = authData.user.id;
      const userEmail = authData.user.email;

      // Check if user profile already exists in public.users
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      // Note: single() returns an error if no row is found, which is normal. 
      // But if there's a different database error, we should check it.
      if (!profile) {
        // Fetch display name from Google user metadata, falling back to email prefix
        const userMetadata = authData.user.user_metadata;
        const displayName = userMetadata?.full_name || userEmail?.split('@')[0] || 'User';

        // Initialize user profile
        const { error: dbError } = await supabase.from('users').upsert({
          id: userId,
          email: userEmail,
          has_contributed: false,
          access_expires_at: null,
          display_name: displayName,
        } as never);

        if (dbError) {
          console.error('Database profile insertion error:', dbError);
          return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(dbError.message)}`);
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host'); // Original host before reverse proxy
      const isLocalEnv = process.env.NODE_ENV === 'development';
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // If anything fails, redirect back to login page with an error parameter
  return NextResponse.redirect(`${origin}/login?error=OAuth authentication failed - code missing`);
}
