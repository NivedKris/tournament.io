import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const { user, signInWithGoogle } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.username && !user.is_suspended) navigate('/', { replace: true });
  }, [user, navigate]);

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Logo + wordmark */}
        <div className="login-logo">
          <img src="/logo.png" alt="Matchup logo" className="login-logo-img" />
          <div className="login-wordmark">
            <span>MATCH</span><span className="up">UP</span>
          </div>
        </div>

        <div className="login-actions" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button id="google-signin-btn" className="btn btn-google" onClick={signInWithGoogle}>
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

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 20, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--gray-500)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Built by</span>
              <img src="/mark.png" alt="MARK.ORG" style={{ height: 16, width: 'auto', opacity: 0.85 }} />
            </div>
            <p style={{ fontSize: '0.68rem', color: 'var(--gray-700)', letterSpacing: '0.01em', marginTop: 4 }}>
              © {new Date().getFullYear()} MARK.ORG. All rights reserved.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
