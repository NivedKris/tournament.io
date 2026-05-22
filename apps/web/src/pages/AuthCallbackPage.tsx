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

      // Sync with backend — upserts user record
      await loadSession();

      const { user, isNewUser } = useAuthStore.getState();

      if (!user) {
        navigate('/login?error=session_sync_failed', { replace: true });
        return;
      }

      if (isNewUser || !user.username) {
        navigate('/complete-profile', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    };

    handle();
  }, [navigate, loadSession]);

  return <LoadingScreen />;
}
