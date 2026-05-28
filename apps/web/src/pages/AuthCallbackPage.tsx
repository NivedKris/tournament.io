import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import LoadingScreen from '../components/LoadingScreen';


/**
 * Supabase redirects back to /auth/callback after Google OAuth.
 * The URL contains the session tokens in the hash fragment.
 * We detect the session, sync with the backend, then redirect.
 */
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loadSession } = useAuthStore();

  useEffect(() => {
    const handle = async () => {
      // Supabase automatically picks up the session from the URL hash
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        console.error('[AuthCallback] No session found:', error?.message);
        navigate('/login?error=auth_failed', { replace: true });
        return;
      }

      let sessionData: any;
      try {
        sessionData = await loadSession();
      } catch (err: any) {
        console.error('[AuthCallback] Session load error:', err);
        const backendErr = err.response?.data?.error;
        if (backendErr === 'no_invitations') {
          navigate('/login?error=no_invitation', { replace: true });
        } else {
          navigate('/login?error=session_sync_failed', { replace: true });
        }
        return;
      }
      localStorage.removeItem('oauth_tenant_slug');

      const { user, isNewUser } = useAuthStore.getState();

      if (!user) {
        navigate('/login?error=session_sync_failed', { replace: true });
        return;
      }

      if (isNewUser || !user.username || user.username.startsWith('google_')) {
        navigate('/complete-profile', { replace: true });
        return;
      }

      if (user.role === 'super_admin') {
        navigate('/super-admin', { replace: true });
        return;
      }

      // Check if multi-tenant selection is required
      if (sessionData?.data?.requireTenantSelection) {
        navigate('/select-tenant', { replace: true });
        return;
      }

      navigate('/', { replace: true });
    };

    handle();
  }, [navigate, loadSession]);

  return <LoadingScreen />;
}
