import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useState } from 'react';

export default function SelectTenantPage() {
  const { enrolledTenants, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (tenantId: string, slug: string) => {
    setSelectingId(tenantId);
    setError(null);
    try {
      const res = await api.post('/auth/select-tenant', { tenantId });
      if (res.data?.success && res.data?.data?.user) {
        setUser(res.data.data.user);
        
        // Save the chosen tenant slug so main redirection works correctly
        localStorage.setItem('oauth_tenant_slug', slug);
        
        // Redirect directly to the tournament homepage (on the single root domain)
        window.location.href = '/';
      } else {
        setError(res.data?.error || 'Failed to enter tournament');
        setSelectingId(null);
      }
    } catch (err: any) {
      console.error('Select tenant failed:', err);
      setError(err.response?.data?.error || 'Failed to switch tournament portal');
      setSelectingId(null);
    }
  };

  if (!enrolledTenants || enrolledTenants.length === 0) {
    return (
      <div className="login-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24 }}>
        <div className="login-card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', marginBottom: 12 }}>No Tournaments Found</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--gray-400)', marginBottom: 24 }}>
            You do not have memberships in any active tournaments.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/login')} style={{ width: '100%' }}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '40px 24px', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--primary-color)',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            display: 'block',
            marginBottom: 8
          }}>
            Welcome Back
          </span>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', margin: 0 }}>
            Select Your Arena
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--gray-400)', marginTop: 8 }}>
            Choose which tournament portal you want to proceed with today.
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            padding: '14px 16px',
            fontSize: '0.85rem',
            color: '#fca5a5',
            marginBottom: 24,
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {enrolledTenants.map((t: any) => {
            const logo = t.logo_url || '/logo.png';
            const isSelecting = selectingId === t.id;

            return (
              <div 
                key={t.id}
                onClick={() => !selectingId && handleSelect(t.id, t.slug)}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 16,
                  padding: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  cursor: selectingId ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  opacity: selectingId && !isSelecting ? 0.5 : 1,
                  transform: isSelecting ? 'scale(0.98)' : 'none',
                }}
                className="select-tenant-card"
              >
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  <img src={logo} alt={t.name} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
                </div>

                <div style={{ flex: 1, textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', margin: '0 0 4px 0' }}>
                    {t.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>
                      slug: {t.slug}
                    </span>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: t.role === 'admin' ? 'var(--primary-color)' : 'var(--gray-300)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {t.role}
                    </span>
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {isSelecting ? (
                    <div style={{
                      width: 24,
                      height: 24,
                      border: '2px solid rgba(255,255,255,0.1)',
                      borderTopColor: 'var(--primary-color)',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }} />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={() => navigate('/login')}
          disabled={!!selectingId}
          style={{ marginTop: 32, width: '100%', maxWidth: 200, display: 'block', marginLeft: 'auto', marginRight: 'auto' }}
        >
          Sign Out
        </button>

      </div>
    </div>
  );
}
