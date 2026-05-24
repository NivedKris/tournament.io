import React, { useState, useEffect } from 'react';
import api from '../lib/api';

interface InviteRecord {
  id: string;
  email: string;
  role: 'player' | 'admin';
  status: 'pending' | 'joined';
  created_at: string;
}

export default function InvitationsTab() {
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Single invitation state
  const [singleEmail, setSingleEmail] = useState('');
  const [singleRole, setSingleRole] = useState<'player' | 'admin'>('player');
  const [singleSubmitting, setSingleSubmitting] = useState(false);

  // Bulk/CSV invitation state
  const [csvEmails, setCsvEmails] = useState<string[]>([]);
  const [bulkRole, setBulkRole] = useState<'player' | 'admin'>('player');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const fetchInvites = async () => {
    try {
      const res = await api.get('/tenant/invitations');
      if (res.data?.success) {
        setInvites(res.data.data || []);
      }
    } catch (err: any) {
      console.error('Fetch invites error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to fetch active invitations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleSingleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleEmail.trim()) return;

    setSingleSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.post('/tenant/invitations', {
        email: singleEmail.trim(),
        role: singleRole,
      });

      if (res.data?.success) {
        setSuccessMsg(`Successfully invited ${singleEmail.trim()} as a ${singleRole}.`);
        setSingleEmail('');
        fetchInvites();
      }
    } catch (err: any) {
      console.error('Single invite error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to send invitation.');
    } finally {
      setSingleSubmitting(false);
    }
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      // Extract emails using regular expression or simple splitting
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const found = text.match(emailRegex) || [];
      
      // Deduplicate parsed emails
      const uniqueEmails = Array.from(new Set(found.map(em => em.trim().toLowerCase())));

      if (uniqueEmails.length === 0) {
        setErrorMsg('Could not find any valid email addresses in the uploaded file.');
      } else {
        setCsvEmails(uniqueEmails);
        setSuccessMsg(`Parsed ${uniqueEmails.length} unique email addresses from file.`);
      }
    };
    reader.onerror = () => {
      setErrorMsg('Failed to read file.');
    };
    reader.readAsText(file);
  };

  const handleBulkInvite = async () => {
    if (csvEmails.length === 0) return;

    setBulkSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.post('/tenant/invitations/bulk', {
        emails: csvEmails,
        role: bulkRole,
      });

      if (res.data?.success) {
        setSuccessMsg(`Successfully sent bulk invitations to ${res.data.data.count} players.`);
        setCsvEmails([]);
        fetchInvites();
      }
    } catch (err: any) {
      console.error('Bulk invite error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to send bulk invitations.');
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, email: string) => {
    if (!window.confirm(`Are you sure you want to revoke the invitation for ${email}? This will also delete any active membership if they have already joined.`)) {
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.delete(`/tenant/invitations/${id}`);
      if (res.data?.success) {
        setSuccessMsg(`Invitation for ${email} has been successfully revoked.`);
        fetchInvites();
      }
    } catch (err: any) {
      console.error('Revoke invite error:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to revoke invitation.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Alert Messages */}
      {successMsg && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          color: '#10b981',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '0.85rem',
          lineHeight: 1.4,
        }}>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#ef4444',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '0.85rem',
          lineHeight: 1.4,
        }}>
          {errorMsg}
        </div>
      )}

      {/* Grid of invite methods */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
      }}>
        {/* Single Invitation Form */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '14px',
          padding: '24px',
        }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
            Invite Single User
          </h4>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.8rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>
            Directly invite an administrator or player by entering their email address.
          </p>

          <form onSubmit={handleSingleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="e.g. player@example.com"
                value={singleEmail}
                onChange={(e) => setSingleEmail(e.target.value)}
                required
                disabled={singleSubmitting}
                className="form-input"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Assigned Role
              </label>
              <select
                value={singleRole}
                onChange={(e) => setSingleRole(e.target.value as any)}
                disabled={singleSubmitting}
                className="form-input"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              >
                <option value="player">Player (Contestant)</option>
                <option value="admin">Admin (Co-Organizer)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={singleSubmitting || !singleEmail.trim()}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '0.85rem',
                fontWeight: '700',
              }}
            >
              {singleSubmitting ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>

        {/* Bulk/CSV Invitation Form */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '14px',
          padding: '24px',
        }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
            Invite in Bulk (CSV/TXT)
          </h4>
          <p style={{ margin: '0 0 20px 0', fontSize: '0.8rem', color: 'var(--gray-500)', lineHeight: 1.4 }}>
            Upload a CSV, text, or spreadsheet dump containing email addresses to invite them at once.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Upload File
              </label>
              <input
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                onChange={handleCSVUpload}
                disabled={bulkSubmitting}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#fff',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>

            {csvEmails.length > 0 && (
              <>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Bulk Role
                  </label>
                  <select
                    value={bulkRole}
                    onChange={(e) => setBulkRole(e.target.value as any)}
                    disabled={bulkSubmitting}
                    className="form-input"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  >
                    <option value="player">Player (Contestant)</option>
                    <option value="admin">Admin (Co-Organizer)</option>
                  </select>
                </div>

                <div style={{
                  maxHeight: '120px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  color: 'var(--gray-300)',
                  textAlign: 'left',
                }}>
                  <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.75rem', color: 'var(--gray-400)' }}>Emails parsed:</strong>
                  {csvEmails.map((email, idx) => (
                    <div key={idx} style={{ padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      • {email}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      setCsvEmails([]);
                      setSuccessMsg(null);
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '10px', fontSize: '0.8rem' }}
                    disabled={bulkSubmitting}
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleBulkInvite}
                    disabled={bulkSubmitting}
                    className="btn btn-primary"
                    style={{ flex: 2, padding: '10px', fontSize: '0.8rem', fontWeight: '700' }}
                  >
                    {bulkSubmitting ? 'Sending...' : `Invite All (${csvEmails.length})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Invitations Table List */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '14px',
        padding: '24px',
        marginTop: '8px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
              Active Invitations
            </h4>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--gray-500)' }}>
              A total of {invites.length} users have been invited to this tournament portal.
            </p>
          </div>
          <button
            onClick={fetchInvites}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '6px 12px',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--gray-500)', fontSize: '0.9rem' }}>
            Loading active invitations...
          </div>
        ) : invites.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--gray-500)', fontSize: '0.9rem' }}>
            No invitations found. Invite players or admins above.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--gray-400)', fontWeight: '600' }}>Email Address</th>
                  <th style={{ padding: '12px 16px', color: 'var(--gray-400)', fontWeight: '600' }}>Assigned Role</th>
                  <th style={{ padding: '12px 16px', color: 'var(--gray-400)', fontWeight: '600' }}>Sent On</th>
                  <th style={{ padding: '12px 16px', color: 'var(--gray-400)', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '12px 16px', color: 'var(--gray-400)', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => {
                  const dateStr = new Date(invite.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr 
                      key={invite.id} 
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 16px', color: '#fff', fontWeight: '500' }}>
                        {invite.email}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                          background: invite.role === 'admin' ? 'rgba(245, 200, 66, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                          color: invite.role === 'admin' ? '#F5C842' : 'var(--gray-300)',
                        }}>
                          {invite.role}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--gray-400)' }}>
                        {dateStr}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          color: invite.status === 'joined' ? '#10b981' : '#F5C842',
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: invite.status === 'joined' ? '#10b981' : '#F5C842',
                          }} />
                          {invite.status === 'joined' ? 'Joined' : 'Pending'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRevoke(invite.id, invite.email)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
