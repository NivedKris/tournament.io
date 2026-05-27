import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Player {
  id: number;
  name: string;
  positions: string[];
  overall: number;
  club: string | null;
  nationality: string | null;
  image_url: string | null;
}

interface ClaimInfo {
  id: string;
  tournament_id: string;
  nation_id: string;
  user_id: string;
  status: string;
  username: string;
  display_name: string;
  nation_name: string;
  flag_url: string | null;
}

const PRESETS: Record<string, Record<string, { x: number; y: number }>> = {
  '4-3-3': {
    GK: { x: 50, y: 88 },
    LB: { x: 15, y: 70 },
    CB_L: { x: 35, y: 73 },
    CB_R: { x: 65, y: 73 },
    RB: { x: 85, y: 70 },
    DM: { x: 50, y: 54 },
    CM_L: { x: 30, y: 40 },
    CM_R: { x: 70, y: 40 },
    LW: { x: 18, y: 18 },
    RW: { x: 82, y: 18 },
    CF: { x: 50, y: 12 },
  },
  '4-4-2': {
    GK: { x: 50, y: 88 },
    LB: { x: 15, y: 70 },
    CB_L: { x: 35, y: 73 },
    CB_R: { x: 65, y: 73 },
    RB: { x: 85, y: 70 },
    LM: { x: 15, y: 42 },
    CM_L: { x: 38, y: 46 },
    CM_R: { x: 62, y: 46 },
    RM: { x: 85, y: 42 },
    CF_L: { x: 35, y: 15 },
    CF_R: { x: 65, y: 15 },
  },
  '3-5-2': {
    GK: { x: 50, y: 88 },
    CB_L: { x: 28, y: 73 },
    CB_C: { x: 50, y: 76 },
    CB_R: { x: 72, y: 73 },
    DM_L: { x: 35, y: 55 },
    DM_R: { x: 65, y: 55 },
    LM: { x: 12, y: 38 },
    RM: { x: 88, y: 38 },
    AM: { x: 50, y: 35 },
    CF_L: { x: 35, y: 15 },
    CF_R: { x: 65, y: 15 },
  },
  '4-2-3-1': {
    GK: { x: 50, y: 88 },
    LB: { x: 15, y: 70 },
    CB_L: { x: 35, y: 73 },
    CB_R: { x: 65, y: 73 },
    RB: { x: 85, y: 70 },
    DM_L: { x: 35, y: 55 },
    DM_R: { x: 65, y: 55 },
    LM: { x: 15, y: 32 },
    AM: { x: 50, y: 30 },
    RM: { x: 85, y: 32 },
    CF: { x: 50, y: 12 },
  },
  '4-1-2-1-2': {
    GK: { x: 50, y: 88 },
    LB: { x: 15, y: 70 },
    CB_L: { x: 35, y: 73 },
    CB_R: { x: 65, y: 73 },
    RB: { x: 85, y: 70 },
    DM: { x: 50, y: 58 },
    LM: { x: 20, y: 42 },
    RM: { x: 80, y: 42 },
    AM: { x: 50, y: 32 },
    CF_L: { x: 35, y: 14 },
    CF_R: { x: 65, y: 14 },
  },
  '4-5-1': {
    GK: { x: 50, y: 88 },
    LB: { x: 15, y: 70 },
    CB_L: { x: 35, y: 73 },
    CB_R: { x: 65, y: 73 },
    RB: { x: 85, y: 70 },
    LM: { x: 15, y: 38 },
    CM_L: { x: 33, y: 44 },
    CM_C: { x: 50, y: 46 },
    CM_R: { x: 67, y: 44 },
    RM: { x: 85, y: 38 },
    CF: { x: 50, y: 14 },
  },
  '4-3-2-1': {
    GK: { x: 50, y: 88 },
    LB: { x: 15, y: 70 },
    CB_L: { x: 35, y: 73 },
    CB_R: { x: 65, y: 73 },
    RB: { x: 85, y: 70 },
    CM_L: { x: 25, y: 50 },
    CM_C: { x: 50, y: 53 },
    CM_R: { x: 75, y: 50 },
    AM_L: { x: 33, y: 28 },
    AM_R: { x: 67, y: 28 },
    CF: { x: 50, y: 14 },
  },
  '5-3-2': {
    GK: { x: 50, y: 88 },
    LWB: { x: 12, y: 60 },
    CB_L: { x: 30, y: 74 },
    CB_C: { x: 50, y: 76 },
    CB_R: { x: 70, y: 74 },
    RWB: { x: 88, y: 60 },
    CM_L: { x: 30, y: 42 },
    CM_C: { x: 50, y: 45 },
    CM_R: { x: 70, y: 42 },
    CF_L: { x: 35, y: 15 },
    CF_R: { x: 65, y: 15 },
  },
  '3-4-3': {
    GK: { x: 50, y: 88 },
    CB_L: { x: 28, y: 73 },
    CB_C: { x: 50, y: 76 },
    CB_R: { x: 72, y: 73 },
    LM: { x: 15, y: 46 },
    CM_L: { x: 38, y: 48 },
    CM_R: { x: 62, y: 48 },
    RM: { x: 85, y: 46 },
    LW: { x: 20, y: 20 },
    RW: { x: 80, y: 20 },
    CF: { x: 50, y: 14 },
  },
  '5-4-1': {
    GK: { x: 50, y: 88 },
    LWB: { x: 12, y: 60 },
    CB_L: { x: 30, y: 74 },
    CB_C: { x: 50, y: 76 },
    CB_R: { x: 70, y: 74 },
    RWB: { x: 88, y: 60 },
    LM: { x: 15, y: 40 },
    CM_L: { x: 35, y: 43 },
    CM_R: { x: 65, y: 43 },
    RM: { x: 85, y: 40 },
    CF: { x: 50, y: 15 },
  },
  '4-2-4': {
    GK: { x: 50, y: 88 },
    LB: { x: 15, y: 70 },
    CB_L: { x: 35, y: 73 },
    CB_R: { x: 65, y: 73 },
    RB: { x: 85, y: 70 },
    CM_L: { x: 35, y: 50 },
    CM_R: { x: 65, y: 50 },
    LW: { x: 15, y: 18 },
    CF_L: { x: 38, y: 14 },
    CF_R: { x: 62, y: 14 },
    RW: { x: 85, y: 18 },
  },
};

const SUBS = Array.from({ length: 15 }, (_, i) => `SUB_${i + 1}`);

export default function PublicProfilePage() {
  const { claimId } = useParams<{ claimId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [claim, setClaim] = useState<ClaimInfo | null>(null);
  const [squad, setSquad] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Bench side panel drawer state
  const [showSubsDrawer, setShowSubsDrawer] = useState(false);

  const handleRemovePlayer = async () => {
    if (!window.confirm("WARNING: This will permanently remove this player from the tournament, delete their squad, matches, and release their claimed nation.\n\nAre you sure you want to completely remove this player?")) {
      return;
    }

    setIsRemoving(true);
    try {
      const response = await api.delete(`/tournament/claim/${claimId}`);
      if (response.data.success) {
        alert("Player successfully removed from the tournament.");
        navigate('/');
      } else {
        alert(response.data.error || "Failed to remove player.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "An error occurred while removing the player.");
    } finally {
      setIsRemoving(false);
    }
  };

  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const nRes = await api.get('/tournament/nations');
        if (nRes.data.success) {
          let foundClaim: ClaimInfo | null = null;
          for (const nation of nRes.data.data) {
            const match = (nation.claims || []).find((c: any) => c.id === claimId);
            if (match) {
              foundClaim = {
                ...match,
                nation_name: nation.name,
                flag_url: nation.flag_url,
              };
              break;
            }
          }
          setClaim(foundClaim);
        }

        const sRes = await api.get(`/squad/${claimId}`);
        if (sRes.data.success) {
          setSquad(sRes.data.data);
        } else {
          setError('Squad configuration not found');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load public profile');
      } finally {
        setIsLoading(false);
      }
    }

    if (claimId) {
      loadProfile();
    }
  }, [claimId]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <span className="loading-label">Loading profile...</span>
      </div>
    );
  }

  if (error || !claim) {
    return (
      <div className="app-shell text-center">
        <div className="page-content" style={{ marginTop: '100px' }}>
          <h2>Profile Not Found</h2>
          <p className="text-muted">The requested tournament claimant or squad does not exist.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: '20px' }} onClick={() => navigate('/')}>
            Back Home
          </button>
        </div>
      </div>
    );
  }

  // Calculate team strengths
  const players = Object.values(squad?.positions || {}).filter(Boolean) as Player[];
  const avgOvr = players.length > 0
    ? Math.round(players.reduce((sum, p) => sum + p.overall, 0) / players.length)
    : 0;

  const currentFormation = squad?.formation || '4-3-3';
  const defaultCoords = PRESETS[currentFormation] || PRESETS['4-3-3'];
  const coords = squad?.coordinates && Object.keys(squad.coordinates).length > 0
    ? squad.coordinates
    : defaultCoords;

  const subCount = SUBS.filter((k) => squad?.positions?.[k]).length;

  return (
    <div className="app-shell">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src="/logo.png" alt="Matchup" className="nav-logo" />
          <span className="nav-wordmark">
            <span>MATCH</span><span className="up">UP</span>
          </span>
        </div>
        <div className="nav-right">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
            Dashboard
          </button>
        </div>
      </nav>

      <div className="page-content public-profile-page">
        {/* User Card */}
        <div className="profile-hero-card">
          <div className="profile-claim-flag">
            {claim.flag_url ? (
              <img src={claim.flag_url} alt={claim.nation_name} className="profile-flag-img" />
            ) : (
              <span className="flag-placeholder">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </span>
            )}
          </div>
          <div className="profile-details">
            <span className="badge badge-player">{claim.nation_name}</span>
            <h2>{claim.display_name}</h2>
            <span className="profile-username">@{claim.username}</span>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/squad-builder?claimId=${claimId}`)}
                  style={{
                    border: '1px solid var(--accent)',
                    color: 'var(--accent)',
                    background: 'transparent',
                  }}
                >
                  Edit Squad (Admin)
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleRemovePlayer}
                  disabled={isRemoving}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--danger, #ef4444)',
                    color: 'var(--danger, #ef4444)',
                  }}
                >
                  {isRemoving ? 'Removing...' : 'Remove Player'}
                </button>
              </div>
            )}
          </div>

          <div className="team-stats-grid">
            <div className="stat-card">
              <span className="stat-label">Tactics</span>
              <span className="stat-value">{currentFormation}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Avg Rating</span>
              <span className="stat-value">{avgOvr > 0 ? avgOvr : '-'}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Players</span>
              <span className="stat-value">{players.length}/26</span>
            </div>
          </div>
        </div>

        {squad ? (
          <>
            <div className="profile-tactics-layout">
            {/* Read-Only Pitch Display */}
            <div className="pitch-container read-only">
              <div className="pitch-canvas">
                <div className="pitch-line center-circle"></div>
                <div className="pitch-line center-line"></div>
                <div className="pitch-line penalty-area-top"></div>
                <div className="pitch-line penalty-area-bottom"></div>

                {Object.keys(defaultCoords).map((nodeKey) => {
                  const coord = coords[nodeKey] || defaultCoords[nodeKey] || { x: 50, y: 50 };
                  const player = squad.positions[nodeKey];

                  return (
                    <div
                      key={nodeKey}
                      style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                      className="pitch-node read-only"
                    >
                      <div className="node-card">
                        <div className="node-avatar">
                          {player?.image_url ? (
                            <img src={player.image_url} alt={player.name} className="player-face" />
                          ) : (
                            <div className="player-face-placeholder">?</div>
                          )}
                          {player && <span className="player-overall">{player.overall}</span>}
                        </div>
                        <div className="node-details">
                          <span className="node-position">{nodeKey}</span>
                          <span className="node-name">
                            {player ? player.name.split(' ').pop() : 'Empty'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Players Table (Starting XI only) and expandable bench trigger */}
            <div className="players-index-table">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>Starting XI</h3>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowSubsDrawer(true)}
                >
                  Bench({subCount})
                </button>
              </div>

              <div className="roster-grid">
                {Object.keys(defaultCoords).map((nodeKey) => {
                  const player = squad.positions[nodeKey];
                  return (
                    <div key={nodeKey} className="roster-item">
                      <span className="roster-pos-label">{nodeKey}</span>
                      <div className="roster-player-details">
                        <span className="roster-player-name">
                          {player ? player.name : 'Unassigned Position'}
                        </span>
                        <span className="roster-player-sub">
                          {player ? `${player.club || 'Free Agent'} | ${player.nationality || 'Unknown'}` : 'Reserve player'}
                        </span>
                      </div>
                      {player && (
                        <div className="roster-rating">
                          <span className="overall-score">{player.overall}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {squad.screenshot_url && (
            <div className="squad-screenshot-section" style={{ marginTop: '24px' }}>
              <h3>Squad Screenshot</h3>
              <div className="screenshot-preview-container">
                <img
                  src={squad.screenshot_url}
                  alt="Squad Screenshot"
                  className="screenshot-preview"
                  onClick={() => setIsFullscreen(true)}
                />
              </div>
            </div>
          )}
          </>
        ) : (
          <div className="no-squad-alert">
            <p>This player has not set up their squad tactics yet.</p>
          </div>
        )}

        {/* Sliding bench drawer on public profile page */}
        {showSubsDrawer && squad && (
          <div className="subs-drawer-overlay" onClick={() => setShowSubsDrawer(false)}>
            <div className="subs-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-header">
                <h3>Substitutes Bench</h3>
                <button className="close-btn" onClick={() => setShowSubsDrawer(false)}>×</button>
              </div>
              <p className="drawer-subtitle">Reserves list for representing team {claim.nation_name}.</p>

              <div className="subs-drawer-grid">
                {SUBS.map((subKey, idx) => {
                  const p = squad.positions[subKey];
                  return (
                    <div
                      key={subKey}
                      className={`subs-drawer-card ${p ? 'filled' : ''}`}
                    >
                      <div className="sub-avatar-container">
                        {p?.image_url ? (
                          <img src={p.image_url} alt={p.name} className="player-face" />
                        ) : (
                          <div className="player-face-placeholder">?</div>
                        )}
                        {p && <span className="player-overall">{p.overall}</span>}
                      </div>

                      <div className="sub-card-details">
                        <span className="sub-card-index">SUB {idx + 1}</span>
                        <span className="sub-card-name">
                          {p ? p.name : 'Empty Slot'}
                        </span>
                        <span className="sub-card-details-sub">
                          {p ? `${p.club || 'Free Agent'} | ${p.nationality || 'Unknown'}` : 'No player assigned'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Fullscreen Screenshot Overlay */}
        {isFullscreen && squad && squad.screenshot_url && (
          <div className="fullscreen-overlay" onClick={() => setIsFullscreen(false)}>
            <button className="close-fullscreen" onClick={() => setIsFullscreen(false)}>×</button>
            <img src={squad.screenshot_url} alt="Squad Screenshot Fullscreen" className="fullscreen-image" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>
    </div>
  );
}
