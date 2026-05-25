import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import LoadingScreen from '../components/LoadingScreen';

interface InviteDetails {
  id: string;
  email: string;
  role: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    primary_color: string;
  };
}

export default function InvitePage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const { signInWithGoogle, user } = useAuthStore();
  const [details, setDetails] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If they are already logged in as that email or username, they shouldn't need this, but we let them join.
    async function resolveInvite() {
      try {
        const res = await api.get(`/tenant/invitations/resolve/${inviteId}`);
        if (res.data?.success) {
          setDetails(res.data.data);
          
          // Apply tenant colors temporarily for branding page
          const primaryColor = res.data.data.tenant.primary_color;
          if (primaryColor) {
            document.documentElement.style.setProperty('--primary-color', primaryColor);
            document.documentElement.style.setProperty('--primary-glow', `${primaryColor}33`);
            document.documentElement.style.setProperty('--primary-solid', primaryColor);
          }
        } else {
          setError(res.data?.error || 'Invitation not found');
        }
      } catch (err: any) {
        console.error('Resolve invite error:', err);
        setError(err.response?.data?.error || 'Invalid or expired invitation link');
      } finally {
        setLoading(false);
      }
    }
    if (inviteId) {
      resolveInvite();
    }
  }, [inviteId]);

  const handleAccept = async () => {
    // Save tenant context so sign-in redirect routes correctly
    if (details) {
      localStorage.setItem('oauth_tenant_slug', details.tenant.slug);
    }
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google Sign In failed:', err);
    }
  };

  if (loading) return <LoadingScreen />;

  if (error || !details) {
    return (
      <div className="invite-container" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="invite-card">
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '50%',
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--gray-100)', marginBottom: 12 }}>Invitation Issue</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: 24 }}>
            {error || 'This invitation link is invalid or has already been accepted.'}
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('/login')} style={{ width: '100%' }}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const tenantLogo = details.tenant.logo_url || '/logo.png';

  return (
    <div className="invite-container">
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <div className="invite-card">
          
          {/* Tenant Logo */}
          <div style={{ marginBottom: 24 }}>
            <img 
              src={tenantLogo} 
              alt={details.tenant.name} 
              style={{ maxHeight: 80, maxWidth: 120, objectFit: 'contain', margin: '0 auto' }} 
            />
          </div>

          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--primary-color)',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            display: 'block',
            marginBottom: 8
          }}>
            Official Invitation
          </span>

          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: 700, 
            color: '#fff', 
            letterSpacing: '-0.02em', 
            lineHeight: 1.25, 
            marginBottom: 16 
          }}>
            Join {details.tenant.name}
          </h1>

          <p style={{ 
            fontSize: '0.95rem', 
            color: 'var(--gray-300)', 
            lineHeight: 1.6, 
            marginBottom: 32 
          }}>
            You've been invited to register as a <strong>{details.role}</strong> using your email <span style={{ color: 'var(--primary-color)' }}>{details.email}</span>. Click below to connect with Google.
          </p>

          <button 
            id="google-signin-btn" 
            className="btn btn-google" 
            onClick={handleAccept}
            style={{ width: '100%', padding: '14px 20px', fontSize: '0.95rem' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ marginRight: 10 }}>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Accept Invite & Sign In
          </button>
          
          <div style={{ marginTop: 24, fontSize: '0.8rem', color: 'var(--gray-500)' }}>
            Make sure to use the Google account corresponding to <strong>{details.email}</strong>.
          </div>

        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', width: '100%', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--gray-400)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Powered by</span>
          <img src="/mark.png" alt="MARK.ORG" style={{ height: 20, width: 'auto', opacity: 0.9 }} />
        </div>
      </div>
    </div>
  );
}
