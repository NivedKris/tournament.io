import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import NationPicker from '../components/NationPicker';

interface Tournament {
  id: string;
  name: string;
  mode: 'world_cup' | 'ucl';
  status: 'registration' | 'pre_qual' | 'group_stage' | 'knockout' | 'completed';
}

interface Claim {
  id: string;
  user_id: string;
  status: string;
  username: string;
  display_name: string;
}

interface Nation {
  id: string;
  name: string;
  flag_url: string;
  mode: 'world_cup' | 'ucl';
  claims: Claim[];
}

export default function HomePage() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [nations, setNations] = useState<Nation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showClaimPicker, setShowClaimPicker] = useState(user?.role !== 'admin');

  // Admin Create State
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<'world_cup' | 'ucl'>('world_cup');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch current active tournament
      const tRes = await api.get('/tournament/current');
      if (tRes.data.success) {
        setTournament(tRes.data.data);
      }

      // 2. Fetch nations and claims
      const nRes = await api.get('/tournament/nations');
      if (nRes.data.success) {
        setNations(nRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load homepage data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update showClaimPicker when user role loads
  useEffect(() => {
    if (user) {
      setShowClaimPicker(user.role !== 'admin');
    }
  }, [user]);

  // Handle Admin creation of a tournament
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    setCreateError(null);

    try {
      const response = await api.post('/tournament/admin/create', {
        name: newName.trim(),
        mode: newMode,
      });

      if (response.data.success) {
        setNewName('');
        await loadData();
      } else {
        setCreateError(response.data.error || 'Failed to create tournament');
      }
    } catch (err: any) {
      setCreateError(err.response?.data?.error || 'Failed to create tournament');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <span className="loading-label">Loading dashboard...</span>
      </div>
    );
  }

  // Check if current user has claimed a team
  const userClaim = nations
    .flatMap((n) => n.claims || [])
    .find((c) => c.user_id === user?.id);

  const claimedNation = userClaim
    ? nations.find((n) => n.claims.some((c) => c.user_id === user?.id))
    : null;

  return (
    <div className="app-shell">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <img src="/logo.png" alt="Matchup" className="nav-logo" />
          <span className="nav-wordmark">
            <span>MATCH</span><span className="up">UP</span>
          </span>
        </div>

        <div className="nav-right">
          <div className="nav-user-info">
            <span className="nav-display-name">{user?.display_name}</span>
            <span className="nav-username">@{user?.username}</span>
          </div>
          {user?.role === 'admin' && <span className="badge badge-admin">Admin</span>}
          <button id="signout-btn" className="btn btn-secondary btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Page Content */}
      <div className="page-content">
        {/* No Tournament State */}
        {!tournament ? (
          <div className="no-tournament-container">
            <div className="home-hero">
              <h1>No Active Tournament</h1>
              <p>Matchup is currently waiting for the admin to kick off the next tournament.</p>
            </div>

            {/* Admin setup card */}
            {user?.role === 'admin' && (
              <div className="admin-setup-card">
                <h3>KICK OFF A TOURNAMENT</h3>
                <p className="subtitle">Initialize the catalog of nations/clubs and open registrations.</p>
                
                <form onSubmit={handleCreateTournament} className="profile-form">
                  <div className="form-group">
                    <label>Tournament Name</label>
                    <input
                      type="text"
                      placeholder="e.g. World Cup 2026 or Champions League"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Tournament Mode</label>
                    <select
                      value={newMode}
                      onChange={(e) => setNewMode(e.target.value as any)}
                      className="form-input"
                    >
                      <option value="world_cup">FIFA World Cup Mode</option>
                      <option value="ucl">UEFA Champions League Mode</option>
                    </select>
                  </div>

                  {createError && <div className="form-error">{createError}</div>}

                  <button type="submit" className="btn btn-primary" disabled={isCreating}>
                    {isCreating ? 'Initializing...' : 'Launch Tournament'}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="active-tournament-dashboard">
            {/* Header info */}
            <div className="dashboard-header-card">
              <span className="tournament-badge" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {tournament.mode === 'world_cup' ? (
                  <>
                    <img
                      src="https://cdn-icons-png.flaticon.com/512/3217/3217784.png"
                      alt="World Cup"
                      style={{ width: '16px', height: '16px', objectFit: 'contain' }}
                    />
                    World Cup
                  </>
                ) : (
                  <>
                    <img
                      src="https://cdn-icons-png.flaticon.com/512/2629/2629303.png"
                      alt="Champions League"
                      style={{ width: '16px', height: '16px', objectFit: 'contain', filter: 'invert(1)' }}
                    />
                    Champions League
                  </>
                )}
              </span>
              <h1>{tournament.name}</h1>
              <p className="status-label">
                Current Phase: <strong>{tournament.status.toUpperCase()}</strong>
              </p>
            </div>

            {/* Admin Management Panel */}
            {user?.role === 'admin' && (
              <div className="admin-console-card">
                <div className="console-header">
                  <h3>Admin Operations</h3>
                  <span className="console-subtitle">Tournament coordinator view.</span>
                </div>
                <div className="console-stats">
                  <div className="console-stat-item">
                    <span className="c-stat-label">Total Claims</span>
                    <span className="c-stat-val">
                      {nations.reduce((acc, n) => acc + (n.claims?.length || 0), 0)}
                    </span>
                  </div>
                  <div className="console-stat-item">
                    <span className="c-stat-label">Occupied Teams</span>
                    <span className="c-stat-val">
                      {nations.filter((n) => (n.claims?.length || 0) > 0).length}
                    </span>
                  </div>
                  <div className="console-stat-item">
                    <span className="c-stat-label">Contested Teams</span>
                    <span className="c-stat-val">
                      {nations.filter((n) => (n.claims?.length || 0) > 1).length}
                    </span>
                  </div>
                </div>
                <div className="console-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => alert("Registration will close in Phase 3.")}
                  >
                    Close Registration
                  </button>
                  {!claimedNation && !showClaimPicker && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowClaimPicker(true)}
                    >
                      Join Tournament as Player
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* User tactically claimed dashboard */}
            {claimedNation ? (
              <div className="user-tactics-dashboard">
                <div className="claim-profile-row">
                  <div className="claim-flag-wrapper">
                    {claimedNation.flag_url ? (
                      <img src={claimedNation.flag_url} alt={claimedNation.name} className="claim-flag" />
                    ) : (
                      <span className="flag-placeholder">
                        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="claim-text-details">
                    <span>Representing</span>
                    <h2>{claimedNation.name}</h2>
                    <span className="status-label">Registration status: {userClaim?.status}</span>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={() => navigate('/squad-builder')}
                  >
                    Build Squad & Tactics
                  </button>
                </div>
              </div>
            ) : (
              /* Nation Picker for users to select a team */
              tournament.status === 'registration' && showClaimPicker && (
                <div className="claim-picker-section">
                  {user?.role === 'admin' && (
                    <div className="picker-cancel-row">
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowClaimPicker(false)}>
                        ← Back to Admin Console
                      </button>
                    </div>
                  )}
                  <NationPicker nations={nations} onClaimSuccess={() => {
                    setShowClaimPicker(false);
                    loadData();
                  }} />
                </div>
              )
            )}

            {/* Participant claims list */}
            <div className="participants-section">
              <h3>Participating Managers</h3>
              <div className="participants-grid">
                {nations
                  .flatMap((n) =>
                    (n.claims || []).map((c) => ({
                      ...c,
                      nationName: n.name,
                      flagUrl: n.flag_url,
                    }))
                  )
                  .map((participant) => (
                    <div
                      key={participant.id}
                      onClick={() => navigate(`/profile/${participant.id}`)}
                      className="participant-card"
                    >
                      <div className="participant-flag">
                        {participant.flagUrl ? (
                          <img src={participant.flagUrl} alt={participant.nationName} />
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="participant-info">
                        <span className="p-display-name">{participant.display_name}</span>
                        <span className="p-username">@{participant.username}</span>
                        <span className="p-nation">{participant.nationName}</span>
                      </div>
                      <span className={`badge badge-player status-${participant.status}`}>
                        {participant.status}
                      </span>
                    </div>
                  ))}

                {nations.flatMap((n) => n.claims || []).length === 0 && (
                  <div className="no-participants">No players have claimed teams yet.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
