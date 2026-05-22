import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const { setUser, setIsNewUser } = useAuthStore();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername]       = useState('');
  const [error, setError]             = useState('');
  const [submitting, setSubmitting]   = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/complete-profile', {
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
      });
      if (data.success) {
        setUser(data.data);
        setIsNewUser(false);
        navigate('/', { replace: true });
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Header */}
        <div className="profile-form-title">
          <img src="/logo.png" alt="Matchup" className="login-logo-img" style={{ width: 52, height: 52, marginBottom: 16 }} />
          <h1>Create your profile</h1>
          <p>One last step before the tournament</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label htmlFor="display-name">Display name</label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. John Doe"
              required
              minLength={2}
              maxLength={50}
              className="form-input"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
              }
              placeholder="e.g. john_pes"
              required
              minLength={3}
              maxLength={20}
              className="form-input"
            />
            <span className="form-hint">
              3–20 characters · lowercase letters, numbers and underscores only
            </span>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            id="complete-profile-btn"
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : 'Get started'}
          </button>
        </form>

      </div>
    </div>
  );
}
