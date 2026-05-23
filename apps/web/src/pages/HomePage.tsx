import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import NationPicker from '../components/NationPicker';
import GroupStandingsTable from '../components/GroupStandingsTable';
import KnockoutBracket from '../components/KnockoutBracket';
import MatchDetailModal from '../components/MatchDetailModal';
import TournamentStatsTab from '../components/TournamentStatsTab';

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

interface Match {
  id: string;
  stage: 'pre_qual' | 'group' | 'knockout';
  group_name: string | null;
  round: number | null;
  bracket_slot: number | null;
  status: 'scheduled' | 'pending_verification' | 'verified' | 'disputed';
  home_score: number | null;
  away_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  is_prequal: boolean;
  is_bye: boolean;
  home_claim: {
    id: string;
    user_id: string;
    nations: { name: string; flag_url: string | null } | null;
    users: { display_name: string; username: string } | null;
  } | null;
  away_claim: {
    id: string;
    user_id: string;
    nations: { name: string; flag_url: string | null } | null;
    users: { display_name: string; username: string } | null;
  } | null;
}

type TabType = 'fixtures' | 'standings' | 'bracket' | 'stats';

export default function HomePage() {
  const { user, signOut } = useAuthStore();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [nations, setNations] = useState<Nation[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [standingsData, setStandingsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showClaimPicker, setShowClaimPicker] = useState(user?.role !== 'admin');
  const [activeTab, setActiveTab] = useState<TabType>('fixtures');
  const [fixtureFilter, setFixtureFilter] = useState<'all' | 'my'>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // Admin states
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<'world_cup' | 'ucl'>('world_cup');
  const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      // 1. Fetch current active tournament
      const tRes = await api.get('/tournament/current');
      let currentT: Tournament | null = null;
      if (tRes.data.success) {
        currentT = tRes.data.data;
        setTournament(currentT);
      }

      // 2. Fetch nations and claims
      const nRes = await api.get('/tournament/nations');
      if (nRes.data.success) {
        setNations(nRes.data.data);
      }

      if (currentT) {
        // 3. Fetch fixtures/matches
        const mRes = await api.get('/matches');
        if (mRes.data.success) {
          setMatches(mRes.data.data);
        }

        // 4. Fetch standings data if past registration
        if (currentT.status !== 'registration') {
          const sRes = await api.get('/tournament/standings');
          if (sRes.data.success) {
            setStandingsData(sRes.data.data);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load homepage data:', err);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadData().finally(() => {
      setIsLoading(false);
    });
  }, []);

  // Update claim picker when user role loads
  useEffect(() => {
    if (user) {
      setShowClaimPicker(user.role !== 'admin');
    }
  }, [user]);

  // Set default tabs based on stage
  useEffect(() => {
    if (tournament) {
      if (tournament.status === 'group_stage') {
        setActiveTab('standings');
      } else if (tournament.status === 'knockout') {
        setActiveTab('bracket');
      } else {
        setActiveTab('fixtures');
      }
    }
  }, [tournament?.status]);

  // Handle Admin Launch Tournament
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsAdminActionLoading(true);
    setAdminError(null);
    try {
      const response = await api.post('/tournament/admin/create', {
        name: newName.trim(),
        mode: newMode,
      });

      if (response.data.success) {
        setNewName('');
        await loadData();
      } else {
        setAdminError(response.data.error || 'Failed to create tournament');
      }
    } catch (err: any) {
      setAdminError(err.response?.data?.error || 'Failed to create tournament');
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  // Start Pre-Qual Draw
  const handleStartPrequals = async () => {
    setIsAdminActionLoading(true);
    setAdminError(null);
    try {
      const res = await api.post('/tournament/admin/draw-prequals');
      if (res.data.success) {
        await loadData();
      }
    } catch (err: any) {
      setAdminError(err.response?.data?.error || 'Failed to draw pre-quals');
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  // Start Group Draw
  const handleDrawGroups = async () => {
    setIsAdminActionLoading(true);
    setAdminError(null);
    try {
      const res = await api.post('/tournament/admin/draw-groups');
      if (res.data.success) {
        await loadData();
      }
    } catch (err: any) {
      setAdminError(err.response?.data?.error || 'Failed to draw groups');
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  // Generate Knockouts
  const handleStartKnockouts = async () => {
    setIsAdminActionLoading(true);
    setAdminError(null);
    try {
      const res = await api.post('/tournament/admin/start-knockouts');
      if (res.data.success) {
        await loadData();
      }
    } catch (err: any) {
      setAdminError(err.response?.data?.error || 'Failed to start knockouts');
    } finally {
      setIsAdminActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <span className="loading-label">Loading tournament dashboard...</span>
      </div>
    );
  }

  // Find user's own claim
  const userClaim = nations
    .flatMap((n) => n.claims || [])
    .find((c) => c.user_id === user?.id);

  const claimedNation = userClaim
    ? nations.find((n) => n.claims.some((c) => c.user_id === user?.id))
    : null;

  // Calculate live qualification status based on current standings
  const getLiveUserStatus = () => {
    if (!userClaim || !standingsData || !tournament) {
      return userClaim?.status ?? 'pending';
    }

    const tStatus = tournament.status;
    
    // Live status only applies during active group stage or pre-qual
    if (tStatus === 'group_stage') {
      if (standingsData.groups) {
        for (const g of standingsData.groups) {
          const userRow = g.standings.find((s: any) => s.claim_id === userClaim.id);
          if (userRow) {
            // Top 2 qualify
            return userRow.position <= 2 ? 'qualified' : 'eliminated';
          }
        }
      }
    } else if (tStatus === 'pre_qual') {
      if (standingsData.prequal_groups) {
        for (const g of standingsData.prequal_groups) {
          const userRow = g.standings.find((s: any) => s.claim_id === userClaim.id);
          if (userRow) {
            // Top 1 qualifies in prequal mini-group
            return userRow.position === 1 ? 'qualified' : 'eliminated';
          }
        }
      }
    }

    return userClaim.status;
  };

  const liveStatus = getLiveUserStatus();

  // Filter fixtures list
  const filteredMatches = matches.filter((m) => {
    if (m.is_bye) return false; // don't show byes in simple lists
    if (fixtureFilter === 'my') {
      return (
        m.home_claim?.user_id === user?.id || m.away_claim?.user_id === user?.id
      );
    }
    return true;
  });

  const getStageHeaderLabel = (status: string) => {
    switch (status) {
      case 'registration':
        return '🔴 Registration Open — Claim your club';
      case 'pre_qual':
        return '🟡 Pre-Qualification in Progress';
      case 'group_stage':
        return '🔵 Group Stage Underway';
      case 'knockout':
        return '🟣 Knockout Stage';
      case 'completed':
        return '🏆 Tournament Complete';
      default:
        return status;
    }
  };

  // Find champion name if tournament is complete
  const finalMatch = matches.find((m) => m.stage === 'knockout' && m.round === 1);
  let championName = '';
  if (tournament?.status === 'completed' && finalMatch && finalMatch.status === 'verified') {
    const hs = finalMatch.home_score ?? 0;
    const as_ = finalMatch.away_score ?? 0;
    if (hs > as_) {
      championName = finalMatch.home_claim?.nations?.name ?? '';
    } else if (as_ > hs) {
      championName = finalMatch.away_claim?.nations?.name ?? '';
    } else if (finalMatch.home_pens != null && finalMatch.away_pens != null) {
      championName = finalMatch.home_pens > finalMatch.away_pens
        ? (finalMatch.home_claim?.nations?.name ?? '')
        : (finalMatch.away_claim?.nations?.name ?? '');
    }
  }

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

      {/* Main Container */}
      <div className="page-content">
        
        {/* No Tournament State */}
        {!tournament ? (
          <div className="no-tournament-container">
            <div className="home-hero">
              <h1>No Active Tournament</h1>
              <p>Matchup is currently waiting for the admin to kick off the next tournament.</p>
            </div>

            {/* Launch Form */}
            {user?.role === 'admin' && (
              <div className="admin-setup-card">
                <h3>KICK OFF A TOURNAMENT</h3>
                <p className="subtitle">Initialize the catalog of nations/clubs and open registrations.</p>
                
                <form onSubmit={handleCreateTournament} className="profile-form">
                  <div className="form-group">
                    <label>Tournament Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Champions League 2026"
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

                  {adminError && <div className="form-error">{adminError}</div>}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isAdminActionLoading}
                  >
                    {isAdminActionLoading ? 'Initializing...' : 'Launch Tournament'}
                  </button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="active-tournament-dashboard">
            
            {/* Phase Banner */}
            <div className="dashboard-header-card">
              <span className={`tournament-phase-banner banner-${tournament.status}`}>
                {getStageHeaderLabel(tournament.status)}
              </span>
              <div className="header-title-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {tournament.mode === 'world_cup' ? (
                    <img
                      src="https://cdn-icons-png.flaticon.com/512/3217/3217784.png"
                      alt="World Cup"
                      style={{ width: '32px', height: '32px', objectFit: 'contain' }}
                    />
                  ) : (
                    <img
                      src="https://cdn-icons-png.flaticon.com/512/2629/2629303.png"
                      alt="Champions League"
                      style={{ width: '32px', height: '32px', objectFit: 'contain', filter: 'invert(1)' }}
                    />
                  )}
                  <h1>{tournament.name}</h1>
                </div>
                <span className="mode-badge">
                  {tournament.mode === 'ucl' ? 'Champions League' : 'World Cup'}
                </span>
              </div>

              {championName && (
                <div className="champion-banner">
                  <span className="trophy-emoji">🏆</span>
                  <h2>{championName.toUpperCase()} IS THE CHAMPION!</h2>
                </div>
              )}
            </div>

            {/* Admin Console Card */}
            {user?.role === 'admin' && (
              <div className="admin-console-card">
                <div className="console-header">
                  <h3>Admin Operations</h3>
                  <span className="console-subtitle">Tournament Management Panel</span>
                </div>

                {adminError && <div className="form-error mb-4">{adminError}</div>}

                <div className="console-stats">
                  <div className="console-stat-item">
                    <span className="c-stat-label">Total Claims</span>
                    <span className="c-stat-val">
                      {nations.reduce((acc, n) => acc + (n.claims?.length || 0), 0)}
                    </span>
                  </div>
                  <div className="console-stat-item">
                    <span className="c-stat-label">Clubs Occupied</span>
                    <span className="c-stat-val">
                      {nations.filter((n) => (n.claims?.length || 0) > 0).length}
                    </span>
                  </div>
                  <div className="console-stat-item">
                    <span className="c-stat-label">Matches Played</span>
                    <span className="c-stat-val">
                      {matches.filter((m) => m.status === 'verified').length} / {matches.length}
                    </span>
                  </div>
                </div>

                <div className="console-actions">
                  {/* Registration Phase Operations */}
                  {tournament.status === 'registration' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleStartPrequals}
                      disabled={isAdminActionLoading}
                    >
                      {isAdminActionLoading ? 'Starting...' : 'Start Pre-Qual Phase'}
                    </button>
                  )}

                  {/* Pre-Qual Phase Operations */}
                  {tournament.status === 'pre_qual' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleDrawGroups}
                      disabled={
                        isAdminActionLoading ||
                        matches.some((m) => m.stage === 'pre_qual' && m.status !== 'verified')
                      }
                      title={
                        matches.some((m) => m.stage === 'pre_qual' && m.status !== 'verified')
                          ? 'Wait for all pre-qual matches to complete'
                          : 'Draw groups'
                      }
                    >
                      Draw Group Stage
                    </button>
                  )}

                  {/* Group Stage Operations */}
                  {tournament.status === 'group_stage' && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleStartKnockouts}
                      disabled={
                        isAdminActionLoading ||
                        matches.some((m) => m.stage === 'group' && m.status !== 'verified')
                      }
                      title={
                        matches.some((m) => m.stage === 'group' && m.status !== 'verified')
                          ? 'Wait for all group matches to complete'
                          : 'Draw knockout bracket'
                      }
                    >
                      Draw Knockout Bracket
                    </button>
                  )}

                  {!claimedNation && !showClaimPicker && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowClaimPicker(true)}
                    >
                      Join Tournament as Player
                    </button>
                  )}
                </div>

                {/* Central Disputes Inbox */}
                {matches.some((m) => m.status === 'disputed') && (
                  <div className="admin-disputes-inbox mt-6 pt-6 border-t" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '1.1rem' }}>⚠️</span> Open Disputes ({matches.filter((m) => m.status === 'disputed').length})
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {matches.filter((m) => m.status === 'disputed').map((m) => (
                        <div
                          key={m.id}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                          onClick={() => setSelectedMatchId(m.id)}
                          className="disputed-inbox-item"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '700' }}>
                              {m.stage === 'pre_qual' ? 'Pre-Qual' : m.stage === 'group' ? `Group ${m.group_name}` : 'Knockout'}
                            </span>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                              {m.home_claim?.nations?.name || 'TBD'} vs {m.away_claim?.nations?.name || 'TBD'}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            Arbitrate →
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User claim tactics profile row */}
            {claimedNation && (
              <div className="user-tactics-dashboard animate-slide-down">
                <div className="claim-profile-row">
                  {claimedNation.flag_url ? (
                    <img src={claimedNation.flag_url} alt="" className="claim-flag" />
                  ) : (
                    <div className="flag-placeholder" />
                  )}
                  <div className="claim-text-details">
                    <span>Your Represented Club</span>
                    <h2>{claimedNation.name}</h2>
                    <span className="status-label">
                      Current Status: <strong className={`status-${liveStatus}`}>{liveStatus.replace('_', ' ')}</strong>
                    </span>
                  </div>

                  <button
                    className="btn btn-primary ml-auto"
                    onClick={() => navigate('/squad-builder')}
                  >
                    Squad Builder & Tactics
                  </button>
                </div>
              </div>
            )}

            {/* Nation picker drawer */}
            {tournament.status === 'registration' && showClaimPicker && !claimedNation && (
              <div className="claim-picker-section">
                {user?.role === 'admin' && (
                  <button
                    className="btn btn-secondary btn-sm mb-4"
                    onClick={() => setShowClaimPicker(false)}
                  >
                    ← Back to Admin Console
                  </button>
                )}
                <NationPicker
                  nations={nations}
                  onClaimSuccess={() => {
                    setShowClaimPicker(false);
                    loadData();
                  }}
                />
              </div>
            )}

            {/* Tabbed view for Matches, Standings, Bracket */}
            {tournament.status !== 'registration' && (
              <div className="tournament-tabs-section mt-6">
                <div className="dashboard-tabs">
                  <button
                    className={`tab-link ${activeTab === 'fixtures' ? 'active' : ''}`}
                    onClick={() => setActiveTab('fixtures')}
                  >
                    Fixtures
                  </button>
                  
                  {standingsData && (
                    <button
                      className={`tab-link ${activeTab === 'standings' ? 'active' : ''}`}
                      onClick={() => setActiveTab('standings')}
                    >
                      Standings
                    </button>
                  )}

                  {matches.some((m) => m.stage === 'knockout') && (
                    <button
                      className={`tab-link ${activeTab === 'bracket' ? 'active' : ''}`}
                      onClick={() => setActiveTab('bracket')}
                    >
                      Knockout Bracket
                    </button>
                  )}

                  <button
                    className={`tab-link ${activeTab === 'stats' ? 'active' : ''}`}
                    onClick={() => setActiveTab('stats')}
                  >
                    Tournament Stats
                  </button>
                </div>

                {/* Tab Panel: Fixtures */}
                {activeTab === 'fixtures' && (
                  <div className="tab-pane-content">
                    <div className="fixtures-filters-row mb-4">
                      <button
                        className={`filter-chip ${fixtureFilter === 'all' ? 'active' : ''}`}
                        onClick={() => setFixtureFilter('all')}
                      >
                        All Fixtures
                      </button>
                      {claimedNation && (
                        <button
                          className={`filter-chip ${fixtureFilter === 'my' ? 'active' : ''}`}
                          onClick={() => setFixtureFilter('my')}
                        >
                          My Matches
                        </button>
                      )}
                    </div>

                    <div className="fixtures-list-grid">
                      {filteredMatches.map((m) => {
                        const isVerified = m.status === 'verified';
                        const scoreText = isVerified
                          ? `${m.home_score} – ${m.away_score}`
                          : 'VS';
                        
                        return (
                          <div
                            key={m.id}
                            className={`fixture-list-card clickable status-${m.status}`}
                            onClick={() => setSelectedMatchId(m.id)}
                          >
                            <span className="fixture-stage-label font-mono">
                              {m.stage === 'pre_qual' ? 'Pre-Qual' : m.stage === 'group' ? `Group ${m.group_name}` : `Round of ${m.round}`}
                            </span>
                            
                            <div className="fixture-main-row">
                              <div className="fixture-team home">
                                <span className="team-name truncate">{m.home_claim?.nations?.name ?? 'TBD'}</span>
                                {m.home_claim?.nations?.flag_url && (
                                  <img src={m.home_claim.nations.flag_url} alt="" className="fixture-flag" />
                                )}
                              </div>

                              <div className="fixture-score font-mono font-bold">
                                {scoreText}
                              </div>

                              <div className="fixture-team away">
                                {m.away_claim?.nations?.flag_url && (
                                  <img src={m.away_claim.nations.flag_url} alt="" className="fixture-flag" />
                                )}
                                <span className="team-name truncate">{m.away_claim?.nations?.name ?? 'TBD'}</span>
                              </div>
                            </div>

                            <span className="fixture-status-badge">
                              {m.status.replace('_', ' ')}
                            </span>
                          </div>
                        );
                      })}

                      {filteredMatches.length === 0 && (
                        <div className="no-fixtures-state">
                          <span>No matches scheduled in this view.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tab Panel: Standings */}
                {activeTab === 'standings' && standingsData && (
                  <div className="tab-pane-content standings-flex-grid">
                    {/* Render Group Standings */}
                    {standingsData.groups?.map((g: any) => (
                      <GroupStandingsTable
                        key={g.group}
                        groupName={g.group}
                        standings={g.standings}
                        userClaimId={userClaim?.id}
                      />
                    ))}

                    {/* Render Pre-Qual Standings (if any) */}
                    {standingsData.prequal_groups?.map((g: any) => (
                      <GroupStandingsTable
                        key={g.nation}
                        groupName={g.nation}
                        standings={g.standings}
                        userClaimId={userClaim?.id}
                        isPrequal={true}
                      />
                    ))}
                  </div>
                )}

                {/* Tab Panel: Bracket */}
                {activeTab === 'bracket' && (
                  <div className="tab-pane-content">
                    <KnockoutBracket
                      matches={matches}
                      userClaimId={userClaim?.id}
                      onMatchClick={(id) => setSelectedMatchId(id)}
                    />
                  </div>
                )}

                {/* Tab Panel: Stats */}
                {activeTab === 'stats' && (
                  <div className="tab-pane-content">
                    <TournamentStatsTab />
                  </div>
                )}

              </div>
            )}

            {/* Participants Grid (Always show below main content during registration/pre_qual) */}
            {tournament.status === 'registration' && (
              <div className="participants-section mt-8">
                <h3>Registered Managers</h3>
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
                            <img src={participant.flagUrl} alt="" />
                          ) : (
                            <div className="flag-placeholder" />
                          )}
                        </div>
                        <div className="participant-info">
                          <span className="p-display-name">{participant.display_name}</span>
                          <span className="p-username">@{participant.username}</span>
                          <span className="p-nation">{participant.nationName}</span>
                        </div>
                        <span className={`badge badge-player status-${participant.status}`}>
                          {participant.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}

                  {nations.flatMap((n) => n.claims || []).length === 0 && (
                    <div className="no-participants">No managers have registered yet.</div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* Match Detail / Submit / Verification Modal */}
      {selectedMatchId && (
        <MatchDetailModal
          matchId={selectedMatchId}
          currentUserId={user?.id || ''}
          isAdmin={user?.role === 'admin'}
          onClose={() => setSelectedMatchId(null)}
          onRefresh={loadData}
        />
      )}

    </div>
  );
}
