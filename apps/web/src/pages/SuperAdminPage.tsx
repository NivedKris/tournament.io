import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  admin_email: string;
  status: 'active' | 'suspended';
  created_at: string;
}

export default function SuperAdminPage() {
  const { user, signOut } = useAuthStore();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'super_admin') return;

    fetchTenants();
  }, [user]);

  async function fetchTenants() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/super-admin/tenants');
      if (res.data?.success) {
        setTenants(res.data.data || []);
      } else {
        setError(res.data?.error || 'Failed to fetch tenants');
      }
    } catch (err: any) {
      console.error('Fetch tenants error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to fetch tenants');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateTenant(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitSuccess(null);
    setSubmitError(null);

    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    try {
      const res = await api.post('/super-admin/tenants', {
        name,
        slug: generatedSlug,
        admin_email: adminEmail.trim(),
        logo_url: logoUrl.trim() || null,
        primary_color: primaryColor,
      });

      if (res.data?.success) {
        setSubmitSuccess(`Tenant "${name}" enrolled successfully!`);
        setName('');
        setAdminEmail('');
        setLogoUrl('');
        setPrimaryColor('#3b82f6');
        fetchTenants(); // Refresh list
      } else {
        setSubmitError(res.data?.error || 'Failed to create tenant');
      }
    } catch (err: any) {
      console.error('Create tenant error:', err);
      setSubmitError(err.response?.data?.error || err.message || 'Failed to create tenant');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleStatus(tenantId: string, currentStatus: 'active' | 'suspended') {
    const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      const res = await api.patch(`/super-admin/tenants/${tenantId}/status`, {
        status: nextStatus,
      });
      if (res.data?.success) {
        setTenants(prev =>
          prev.map(t => (t.id === tenantId ? { ...t, status: nextStatus } : t))
        );
      } else {
        alert(res.data?.error || 'Failed to update status');
      }
    } catch (err: any) {
      console.error('Toggle status error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to update status');
    }
  }

  if (user?.role !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#070708',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      padding: '40px 24px'
    }}>
      {/* Premium Header bar */}
      <header style={{
        maxWidth: '1200px',
        margin: '0 auto 40px auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '20px'
      }}>
        <div>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#8e8e93', fontWeight: 600, marginBottom: '4px' }}>
            Global Operations Control
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>
            Super Admin Portal
          </h1>
        </div>
        <button
          onClick={() => signOut()}
          style={{
            background: 'rgba(255, 59, 48, 0.1)',
            color: '#ff453a',
            border: '1px solid rgba(255, 59, 48, 0.2)',
            padding: '10px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.1)'}
        >
          Sign Out
        </button>
      </header>

      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '40px',
      }}>
        
        {/* Left Column: Create Tenant */}
        <section style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '24px',
          padding: '32px',
          height: 'fit-content',
          backdropFilter: 'blur(20px)',
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', marginTop: 0, marginBottom: '24px' }}>
            Enroll New Admin & Tenant
          </h2>

          <form onSubmit={handleCreateTenant} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#8e8e93', fontWeight: 500 }}>LEAGUE NAME</label>
              <input
                type="text"
                required
                placeholder="e.g. Stanford University League"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#8e8e93', fontWeight: 500 }}>ADMIN EMAIL</label>
              <input
                type="email"
                required
                placeholder="admin@university.edu"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#8e8e93', fontWeight: 500 }}>UNIVERSITY LOGO URL</label>
              <input
                type="url"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={e => setLogoUrl(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: '#8e8e93', fontWeight: 500 }}>PRIMARY BRAND COLOR</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    width: '40px',
                    height: '40px',
                    cursor: 'pointer',
                  }}
                />
                <span style={{ fontSize: '14px', fontFamily: 'monospace' }}>{primaryColor.toUpperCase()}</span>
              </div>
            </div>

            {submitSuccess && (
              <div style={{
                background: 'rgba(48, 209, 88, 0.1)',
                border: '1px solid rgba(48, 209, 88, 0.2)',
                color: '#30d158',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '13px',
              }}>
                {submitSuccess}
              </div>
            )}

            {submitError && (
              <div style={{
                background: 'rgba(255, 69, 58, 0.1)',
                border: '1px solid rgba(255, 69, 58, 0.2)',
                color: '#ff453a',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '13px',
              }}>
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: '#fff',
                color: '#000',
                border: 'none',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
                marginTop: '10px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              {isSubmitting ? 'Enrolling...' : 'Create Admin & Tenant'}
            </button>
          </form>
        </section>

        {/* Right Column: Tenants List */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', margin: 0 }}>
              Tenant Admins List
            </h2>
            <button
              onClick={fetchTenants}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#0a84ff',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#8e8e93' }}>
              Retrieving tenant databases...
            </div>
          ) : error ? (
            <div style={{
              background: 'rgba(255, 69, 58, 0.1)',
              border: '1px solid rgba(255, 69, 58, 0.2)',
              color: '#ff453a',
              borderRadius: '16px',
              padding: '20px',
            }}>
              {error}
            </div>
          ) : tenants.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 0',
              border: '1px dashed rgba(255,255,255,0.08)',
              borderRadius: '24px',
              color: '#8e8e93'
            }}>
              No tenant admins enrolled yet. Use the control panel to add your first tenant.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {tenants.map(t => (
                <div
                  key={t.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '20px',
                    padding: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {/* Brand color marker */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      background: t.primary_color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: '#fff',
                      boxShadow: `0 8px 16px ${t.primary_color}33`,
                    }}>
                      {t.name[0].toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
                          {t.name}
                        </h3>
                        <span style={{
                          background: t.status === 'active' ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 69, 58, 0.1)',
                          color: t.status === 'active' ? '#30d158' : '#ff453a',
                          padding: '2px 8px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                        }}>
                          {t.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#8e8e93', marginTop: '4px' }}>
                        Slug: <strong style={{ color: '#fff' }}>{t.slug}</strong> | Admin: {t.admin_email}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => window.open('http://localhost:5173', '_blank')}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#fff',
                        borderRadius: '10px',
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Open Portal
                    </button>
                    {t.slug !== 'default' && (
                      <button
                        onClick={() => handleToggleStatus(t.id, t.status)}
                        style={{
                          background: t.status === 'active' ? 'rgba(255, 69, 58, 0.1)' : 'rgba(48, 209, 88, 0.1)',
                          border: '1px solid rgba(255,255,255,0.02)',
                          color: t.status === 'active' ? '#ff453a' : '#30d158',
                          borderRadius: '10px',
                          padding: '8px 14px',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        {t.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
