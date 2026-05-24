import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import LoadingScreen from '../components/LoadingScreen';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loadSession } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [targetPath, setTargetPath] = useState('/');

  useEffect(() => {
    const handle = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session) {
        console.error('[AuthCallback] No session found:', error?.message);
        navigate('/login?error=auth_failed', { replace: true });
        return;
      }

      await loadSession();

      const { user, isNewUser } = useAuthStore.getState();

      if (!user) {
        navigate('/login?error=session_sync_failed', { replace: true });
        return;
      }

      if (isNewUser || !user.username || user.username.startsWith('google_')) {
        setTargetPath('/complete-profile');
      } else {
        setTargetPath('/');
      }
      setReady(true);
    };

    handle();
  }, [navigate, loadSession]);

  if (!ready) {
    return <LoadingScreen />;
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      textAlign: 'center'
    }}>
      <div style={{
        maxWidth: 400,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 32,
        animation: 'fadeUp var(--slow) var(--ease) both'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <img src="/logo.png" alt="Matchup" style={{ height: 64, width: 'auto', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.15))' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gray-100)', letterSpacing: '-0.02em' }}>
            Sign In Successful
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--gray-400)', maxWidth: 300 }}>
            Enter the Arena!
          </p>
        </div>

        <button
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '1rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            border: 'none',
            boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)'
          }}
          onClick={() => navigate(targetPath, { replace: true })}
        >
          Enter Arena
        </button>
      </div>
    </div>
  );
}
