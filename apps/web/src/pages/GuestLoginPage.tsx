import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

type Mode = 'register' | 'login';

export default function GuestLoginPage() {
  const { user, signInWithGuest, signUpWithGuest } = useAuthStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('register');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already signed in
  useEffect(() => {
    if (user?.username && !user.is_suspended) navigate('/', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!username.trim() || !password) {
      setError('Username and password are required');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Display name is required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const { sanitized_username } = await signUpWithGuest(name.trim(), username.trim(), password);
        setInfo(`Registered as @${sanitized_username} — logging you in…`);
      } else {
        await signInWithGuest(username.trim(), password);
      }
      // navigation handled by useEffect above once user state updates
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Back */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--gray-500)', fontSize: '0.8125rem', display: 'flex',
            alignItems: 'center', gap: 6, padding: 0, marginBottom: 20,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back
        </button>

        {/* Logo */}
        <div className="login-logo">
          <img src="/logo.png" alt="Matchup" className="login-logo-img" />
          <div className="login-wordmark"><span>MATCH</span><span className="up">UP</span></div>
          <p className="login-tagline">Guest / Test Account</p>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['register', 'login'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); setInfo(null); }}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font)', fontSize: '0.875rem', fontWeight: 500,
                background: mode === m ? 'var(--primary)' : 'var(--bg-2)',
                color: mode === m ? '#000' : 'var(--gray-400)',
                transition: 'all 0.15s',
              }}
            >
              {m === 'register' ? 'Register' : 'Sign In'}
            </button>
          ))}
        </div>

        <div className="login-actions">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171', padding: '10px 14px', borderRadius: 8, fontSize: '0.825rem',
              }}>{error}</div>
            )}
            {info && (
              <div style={{
                background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)',
                color: '#4ade80', padding: '10px 14px', borderRadius: 8, fontSize: '0.825rem',
              }}>{info}</div>
            )}

            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="guest-name">Display Name</label>
                <input id="guest-name" type="text" className="form-input"
                  placeholder="e.g. Jose Mourinho"
                  value={name} onChange={e => setName(e.target.value)} disabled={loading} />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="guest-username">Username</label>
              <input id="guest-username" type="text" className="form-input"
                placeholder="e.g. jose (emails auto-stripped)"
                value={username} onChange={e => setUsername(e.target.value)} disabled={loading} />
              <span className="form-hint">Typing nick@gmail.com? We'll use "nick" automatically.</span>
            </div>

            <div className="form-group">
              <label htmlFor="guest-password">Password</label>
              <input id="guest-password" type="password" className="form-input"
                placeholder="Min 6 characters"
                value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
              {mode === 'register' && (
                <span className="form-hint">Use "admin" as prefix (e.g. admin2) to create an admin account.</span>
              )}
            </div>

            <button id="guest-submit-btn" type="submit" className="btn btn-primary"
              disabled={loading} style={{ width: '100%', marginTop: 4 }}>
              {loading ? 'Please wait…' : mode === 'register' ? 'Create Account' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
