import { useState } from 'react';
import api from '../lib/api';

interface AdminNotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentStatus?: string;
}

export default function AdminNotificationDrawer({ isOpen, onClose, tournamentStatus }: AdminNotificationDrawerProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [winnerMessage, setWinnerMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendBroadcast = async (channel: 'email' | 'push') => {
    if (channel === 'email' && (!subject.trim() || !message.trim())) return;
    if (channel === 'push' && !message.trim()) return;

    setIsLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await api.post('/notification/admin/broadcast', {
        subject: subject.trim() || 'Broadcast Announcement',
        message: message.trim(),
        channel
      });
      if (res.data.success) {
        setSuccessMsg(res.data.message || `Broadcast ${channel} sent successfully!`);
        if (channel === 'email') {
          setSubject('');
        }
        setMessage('');
      } else {
        setErrorMsg(res.data.error || 'Failed to dispatch broadcast.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to dispatch broadcast.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReminders = async (channel: 'email' | 'push') => {
    setIsLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await api.post('/notification/admin/remind-pending', { channel });
      if (res.data.success) {
        setSuccessMsg(res.data.message || `Pending match reminders ${channel} sent successfully!`);
      } else {
        setErrorMsg(res.data.error || 'Failed to send reminders.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to send reminders.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendWinnerNotification = async (channel: 'email' | 'push') => {
    if (!winnerMessage.trim()) return;

    setIsLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await api.post('/notification/admin/notify-winner', {
        message: winnerMessage.trim(),
        channel
      });
      if (res.data.success) {
        setSuccessMsg(res.data.message || `Winner claim instructions ${channel} sent successfully!`);
        setWinnerMessage('');
      } else {
        setErrorMsg(res.data.error || 'Failed to dispatch winner notification.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to dispatch winner notification.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(5px)',
          zIndex: 999,
          animation: 'fadeIn 0.2s ease-out',
        }}
      />

      {/* Drawer Container */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100vh',
          width: '440px',
          maxWidth: '90%',
          background: 'rgba(20, 20, 22, 0.85)',
          backdropFilter: 'blur(24px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.6)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          color: '#ffffff',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
              Notifications Console
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontWeight: '600' }}>
              Tournament Email Panel
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.6)';
            }}
          >
            ×
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          
          {successMsg && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#10b981',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                lineHeight: 1.4,
              }}
            >
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                lineHeight: 1.4,
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Quick Actions Card */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '14px',
              padding: '18px',
            }}
          >
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: '700', color: 'rgba(255,255,255,0.8)' }}>
              Outstanding Matches
            </h4>
            <p style={{ margin: '0 0 16px 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
              Instantly scan and remind players with outstanding matches in the active stage.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => handleSendReminders('email')}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
                {isLoading ? '...' : 'Email Reminders'}
              </button>
              <button
                onClick={() => handleSendReminders('push')}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  color: '#60a5fa',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                }}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {isLoading ? '...' : 'Push Reminders'}
              </button>
            </div>
          </div>

          {/* Broadcast Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: 'rgba(255,255,255,0.9)' }}>
              Broadcast Announcement
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Email Subject (Only needed for email)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule updates for Playoffs"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isLoading}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Announcement Message
                </label>
                <textarea
                  placeholder="Type your tournament announcement here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isLoading}
                  rows={8}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none',
                    resize: 'none',
                    lineHeight: 1.5,
                    transition: 'all 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSendBroadcast('email')}
                  disabled={isLoading || !subject.trim() || !message.trim()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #F5C842 0%, #D4AF37 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#121212',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: (isLoading || !subject.trim() || !message.trim()) ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading && subject.trim() && message.trim()) e.currentTarget.style.opacity = '0.9';
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading && subject.trim() && message.trim()) e.currentTarget.style.opacity = '1';
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                  {isLoading ? '...' : 'Broadcast Email'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendBroadcast('push')}
                  disabled={isLoading || !message.trim()}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    color: '#60a5fa',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: (isLoading || !message.trim()) ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading && message.trim()) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoading && message.trim()) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  {isLoading ? '...' : 'Broadcast Push'}
                </button>
              </div>
            </div>
          </div>

          {/* Winner Direct Notification (Only when tournament is completed) */}
          {tournamentStatus === 'completed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '24px' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#F5C842', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🏆 Notify Tournament Winner
              </h4>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                Send custom reward claim instructions directly to the champion of the completed tournament.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Reward & Claim Instructions
                  </label>
                  <textarea
                    placeholder="Provide reward instructions (e.g. contact details, claiming codes)..."
                    value={winnerMessage}
                    onChange={(e) => setWinnerMessage(e.target.value)}
                    disabled={isLoading}
                    rows={6}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      resize: 'none',
                      lineHeight: 1.5,
                      transition: 'all 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => handleSendWinnerNotification('email')}
                    disabled={isLoading || !winnerMessage.trim()}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'linear-gradient(135deg, #F5C842 0%, #D4AF37 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#121212',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: (isLoading || !winnerMessage.trim()) ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading && winnerMessage.trim()) e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading && winnerMessage.trim()) e.currentTarget.style.opacity = '1';
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    {isLoading ? '...' : 'Email Winner'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendWinnerNotification('push')}
                    disabled={isLoading || !winnerMessage.trim()}
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#60a5fa',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      opacity: (isLoading || !winnerMessage.trim()) ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoading && winnerMessage.trim()) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoading && winnerMessage.trim()) e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                    </svg>
                    {isLoading ? '...' : 'Push Winner'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Global Keyframe CSS Injection */}
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}
