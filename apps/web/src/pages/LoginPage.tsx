import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTenant } from '../components/TenantProvider';
import { getTenantSlug } from '../lib/api';
import { supabase } from '../lib/supabase';
import PWAInstallButton from '../components/PWAInstallButton';

export default function LoginPage() {
  const { user, signInWithGoogle } = useAuthStore();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const errorParam = searchParams.get('error');

  useEffect(() => {
    // Automatically clear stale cookies/localStorage sessions on login mount to prevent post-wipe session bugs
    supabase.auth.signOut().catch(() => {});
    
    // Clear oauth target tenant slug if on root default domain to force dropdown selection on next clean login
    const tenantSlug = getTenantSlug();
    if (!tenantSlug || tenantSlug === 'default') {
      localStorage.removeItem('oauth_tenant_slug');
    }
  }, []);

  useEffect(() => {
    if (user?.username && !user.is_suspended) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    localStorage.setItem('oauth_tenant_slug', getTenantSlug());
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in failed:', err);
      localStorage.removeItem('oauth_tenant_slug');
    }
  };

  const logoSrc = tenant?.logo_url || "/logo.png";
  const brandName = tenant?.name || "MATCHUP";
  const isCustomTenant = tenant && tenant.slug !== 'default';

  let errorMessage = '';
  if (errorParam === 'no_invitation') {
    errorMessage = 'Access Denied: You have not been invited to join this tournament. Please check your invitation link or contact your tournament coordinator.';
  } else if (errorParam === 'suspended') {
    errorMessage = 'Account Suspended: Your profile has been suspended by an administrator.';
  } else if (errorParam === 'auth_failed') {
    errorMessage = 'Authentication failed. Please try signing in again.';
  } else if (errorParam === 'session_sync_failed') {
    errorMessage = 'Session sync failed. Please contact support.';
  }

  return (
    <div className="login-page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '40px 24px' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <div className="login-card">
          {errorMessage && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              padding: '14px 16px',
              fontSize: '0.85rem',
              color: '#fca5a5',
              lineHeight: 1.5,
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              {errorMessage}
            </div>
          )}

          {/* Logo + wordmark */}
          <div className="login-logo">
            <img src={logoSrc} alt={`${brandName} logo`} className="login-logo-img" style={{ maxHeight: '64px', objectFit: 'contain' }} />
            <div className="login-wordmark">
              {isCustomTenant ? (
                <span style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--primary-color)' }}>{brandName}</span>
              ) : (
                <><span>MATCH</span><span className="up">UP</span></>
              )}
            </div>
          </div>

          <div className="login-actions" style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
            <button id="google-signin-btn" className="btn btn-google" onClick={handleGoogleSignIn}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <p className="login-footer" style={{ marginTop: 8 }}>
              By continuing, you agree to participate fairly<br />in the tournament.
            </p>
          </div>

        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', width: '100%', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--gray-400)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Built by</span>
          <img src="/mark.png" alt="MARK.ORG" style={{ height: 20, width: 'auto', opacity: 0.9 }} />
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-600)', letterSpacing: '0.01em' }}>
          © {new Date().getFullYear()} MARK.ORG. All rights reserved.
        </p>
      </div>
      <PWAInstallButton />
    </div>
  );
}
