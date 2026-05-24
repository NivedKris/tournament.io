import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { useTenant } from '../components/TenantProvider';
import NationPicker from '../components/NationPicker';
import GroupStandingsTable from '../components/GroupStandingsTable';
import KnockoutBracket from '../components/KnockoutBracket';
import MatchDetailModal from '../components/MatchDetailModal';
import TournamentStatsTab from '../components/TournamentStatsTab';
import CelebrationCanvas from '../components/CelebrationCanvas';
import AdminNotificationDrawer from '../components/AdminNotificationDrawer';
import InvitationsTab from '../components/InvitationsTab';

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
  const { tenant } = useTenant();
  const navigate = useNavigate();

  if (user?.role === 'super_admin') {
    return <Navigate to="/super-admin" replace />;
  }

  const isTenantAdmin = user?.role === 'admin' && user?.tenant_id === tenant?.id;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [nations, setNations] = useState<Nation[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [standingsData, setStandingsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [showClaimPicker, setShowClaimPicker] = useState(!isTenantAdmin);
  const [activeTab, setActiveTab] = useState<TabType>('fixtures');
  const [fixtureFilter, setFixtureFilter] = useState<'all' | 'my'>('all');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  // Admin states
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<'world_cup' | 'ucl'>('world_cup');
  const [isAdminActionLoading, setIsAdminActionLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Reward states
  const [reward, setReward] = useState<any | null>(null);
  const [showRewardsPanel, setShowRewardsPanel] = useState(false);
  const [showInvitesPanel, setShowInvitesPanel] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [rewardName, setRewardName] = useState('');
  const [rewardImageUrl, setRewardImageUrl] = useState('');
  const [rewardCtaLink, setRewardCtaLink] = useState('');
  const [rewardCtaText, setRewardCtaText] = useState('');
  const [rewardIsSaving, setRewardIsSaving] = useState(false);
  const [rewardUploadError, setRewardUploadError] = useState<string | null>(null);
  const [rewardSaveSuccess, setRewardSaveSuccess] = useState(false);
  const [introState, setIntroState] = useState<'splash' | 'playing' | 'done'>(() => {
    const key = user?.id ? `has_watched_intro_tournament_${user.id}` : 'has_watched_intro_tournament';
    return sessionStorage.getItem(key) === 'true' ? 'done' : 'splash';
  });

  useEffect(() => {
    if (user?.id) {
      const key = `has_watched_intro_tournament_${user.id}`;
      const watched = sessionStorage.getItem(key) === 'true';
      setIntroState(watched ? 'done' : 'splash');
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'super_admin') return;

    // Strict lock for players: if their tenant does not match the active page's tenant, redirect them!
    // For admins: only auto-redirect if they land on the base domain ('default' slug), otherwise show cross-tenant warning banner
    const isPlayerIncorrect = user.role === 'player' && user.tenant_id && user.tenant_id !== tenant?.id;
    const isAdminOnDefault = user.role === 'admin' && tenant?.slug === 'default' && user.tenant_id && user.tenant_id !== tenant.id;

    if (isPlayerIncorrect || isAdminOnDefault) {
      api.get(`/tenant/resolve-id/${user.tenant_id}`)
        .then(res => {
          if (res.data?.success && res.data?.data?.slug) {
            const slug = res.data.data.slug;
            localStorage.setItem('oauth_tenant_slug', slug);
            window.location.href = `/?tenant=${slug}`;
          }
        })
        .catch(err => console.error('Failed to auto-redirect tenant:', err));
    }
  }, [user, tenant]);

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

      // Fetch tournament reward
      try {
        const rRes = await api.get('/reward');
        if (rRes.data.success) {
          setReward(rRes.data.data);
          if (rRes.data.data) {
            setRewardName(rRes.data.data.name || '');
            setRewardImageUrl(rRes.data.data.image_url || '');
            setRewardCtaLink(rRes.data.data.cta_link || '');
            setRewardCtaText(rRes.data.data.cta_text || '');
          } else {
            setRewardName('');
            setRewardImageUrl('');
            setRewardCtaLink('');
            setRewardCtaText('');
          }
        }
      } catch (rErr) {
        console.error('Failed to load reward details:', rErr);
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

  // Handle Admin Save Reward
  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardName.trim()) return;

    setRewardIsSaving(true);
    setRewardSaveSuccess(false);
    setAdminError(null);
    try {
      const response = await api.post('/reward', {
        name: rewardName.trim(),
        image_url: rewardImageUrl || null,
        cta_link: rewardCtaLink || null,
        cta_text: rewardCtaText || null,
      });

      if (response.data.success) {
        setReward(response.data.data);
        setRewardSaveSuccess(true);
        setTimeout(() => setRewardSaveSuccess(false), 3000);
      } else {
        setAdminError(response.data.error || 'Failed to save reward');
      }
    } catch (err: any) {
      setAdminError(err.response?.data?.error || 'Failed to save reward');
    } finally {
      setRewardIsSaving(false);
    }
  };

  // Handle uploading reward image
  const handleRewardImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setRewardUploadError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setRewardImageUrl(res.data.data.url);
      } else {
        setRewardUploadError(res.data.error || 'Failed to upload image');
      }
    } catch (err: any) {
      setRewardUploadError(err.response?.data?.error || 'Failed to upload image');
    }
  };

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

  // Reset Tournament
  const handleResetTournament = async () => {
    const confirmReset = window.confirm(
      "WARNING: This will permanently delete the current tournament, all players' claims, matches, squads, messages, disputes, and rewards. This action CANNOT be undone.\n\nAre you sure you want to completely reset the tournament and start from scratch?"
    );
    if (!confirmReset) return;

    setIsAdminActionLoading(true);
    setAdminError(null);
    try {
      const res = await api.post('/tournament/admin/reset');
      if (res.data.success) {
        const key = user?.id ? `has_watched_intro_tournament_${user.id}` : 'has_watched_intro_tournament';
        sessionStorage.removeItem(key);
        // Reset states
        setShowClaimPicker(true);
        setIntroState('splash');
        // Force reload home page data
        await loadData();
      }
    } catch (err: any) {
      setAdminError(err.response?.data?.error || 'Failed to reset tournament');
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

  // Find champion name and claim if tournament is complete
  const finalMatch = matches.find((m) => m.stage === 'knockout' && m.round === 1);
  let championClaim: any = null;
  if (tournament?.status === 'completed' && finalMatch && finalMatch.status === 'verified') {
    const hs = finalMatch.home_score ?? 0;
    const as_ = finalMatch.away_score ?? 0;
    const winner = hs > as_ ? 'home' : (as_ > hs ? 'away' : ((finalMatch.home_pens ?? 0) >= (finalMatch.away_pens ?? 0) ? 'home' : 'away'));
    championClaim = winner === 'home' ? finalMatch.home_claim : finalMatch.away_claim;
  }

  return (
    <div className="app-shell">
      {tournament?.status === 'registration' && showClaimPicker && !claimedNation && introState !== 'done' && (
        <TournamentIntroVideo
          mode={tournament.mode}
          onFinish={() => {
            setIntroState('done');
            const key = user?.id ? `has_watched_intro_tournament_${user.id}` : 'has_watched_intro_tournament';
            sessionStorage.setItem(key, 'true');
          }}
        />
      )}

      {tournament?.status === 'completed' && <CelebrationCanvas />}

      {tournament?.status === 'completed' && championClaim && (
        <div
          className="floating-celebration-banner"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: '-250px',
            zIndex: 99999,
            pointerEvents: 'none',
            background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(10, 10, 10, 0.98) 100%)',
            border: '2px solid #F5C842',
            borderRadius: '24px',
            padding: '28px 48px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 25px 90px rgba(255, 215, 0, 0.3), 0 0 50px rgba(255, 215, 0, 0.15)',
            backdropFilter: 'blur(20px)',
            animation: 'celebrationFlyUp 9s cubic-bezier(0.25, 1, 0.5, 1) forwards',
            width: 'max-content',
            minWidth: '350px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '-8px', filter: 'drop-shadow(0 12px 24px rgba(245, 200, 66, 0.45))' }}>
            <svg viewBox="0 0 100 120" width="80" height="96" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="uclGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFF" stopOpacity="0.9" />
                  <stop offset="25%" stopColor="#F9F5E8" />
                  <stop offset="50%" stopColor="#DFB236" />
                  <stop offset="75%" stopColor="#BC9122" />
                  <stop offset="100%" stopColor="#8A640F" />
                </linearGradient>
                <linearGradient id="uclReflectGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FFF" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
                  <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
                </linearGradient>
              </defs>
              <path d="M 32 35 C 10 32, 6 75, 33 80 C 31 75, 23 70, 32 45" stroke="url(#uclGoldGrad)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <path d="M 68 35 C 90 32, 94 75, 67 80 C 69 75, 77 70, 68 45" stroke="url(#uclGoldGrad)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              <ellipse cx="50" cy="30" rx="18" ry="4" fill="url(#uclGoldGrad)" />
              <path d="M 32 30 C 32 65, 36 82, 50 88 C 64 82, 68 65, 68 30 Z" fill="url(#uclGoldGrad)" />
              <path d="M 32 30 C 32 65, 36 82, 50 88 C 64 82, 68 65, 68 30 Z" fill="url(#uclReflectGrad)" style={{ mixBlendMode: 'overlay' }} />
              <path d="M 44 88 L 42 100 L 58 100 L 56 88 Z" fill="url(#uclGoldGrad)" />
              <ellipse cx="50" cy="100" rx="12" ry="3" fill="url(#uclGoldGrad)" />
              <rect x="36" y="100" width="28" height="6" rx="2" fill="url(#uclGoldGrad)" />
              <rect x="32" y="106" width="36" height="4" rx="1" fill="#111" stroke="url(#uclGoldGrad)" strokeWidth="1" />
              <path d="M 32 32 L 33.5 34 L 35.5 34.5 L 33.5 35 L 32 37 L 30.5 35 L 28.5 34.5 L 30.5 34 Z" fill="#FFF" opacity="0.9" />
              <path d="M 68 48 L 69 50 L 71 50.5 L 69 51 L 68 53 L 67 51 L 65 50.5 L 67 50 Z" fill="#FFF" opacity="0.8" />
              <path d="M 48 65 L 49.5 67 L 51.5 67.5 L 49.5 68 L 48 70 L 46.5 68 L 44.5 67.5 L 46.5 67 Z" fill="#FFF" opacity="0.95" />
            </svg>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            {championClaim.nations?.flag_url && (
              <img
                src={championClaim.nations.flag_url}
                alt=""
                style={{
                  width: '90px',
                  height: '60px',
                  borderRadius: '8px',
                  objectFit: 'cover',
                  border: '2px solid rgba(255,255,255,0.15)',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.6)',
                }}
              />
            )}
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: '#F5C842', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.25em', textTransform: 'uppercase' }}>
                TOURNAMENT CHAMPION
              </div>
              <div style={{ color: '#fff', fontSize: '2.2rem', fontWeight: '950', letterSpacing: '-0.04em', marginTop: '2px', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                {championClaim.nations?.name}
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.75)', fontWeight: '600', marginTop: '6px', fontSize: '0.95rem' }}>
                Manager: <span style={{ color: '#fff', fontWeight: '700' }}>{championClaim.users?.display_name || championClaim.users?.username}</span> (@{championClaim.users?.username})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Celebration Styles */}
      <style>{`
        @keyframes goldGlowPulse {
          from { box-shadow: 0 8px 32px rgba(255, 215, 0, 0.05), inset 0 0 0px rgba(255, 215, 0, 0.05); }
          to { box-shadow: 0 8px 40px rgba(255, 215, 0, 0.15), inset 0 0 15px rgba(255, 215, 0, 0.12); }
        }
        @keyframes trophyBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(6deg); }
        }
        @keyframes celebrationFlyUp {
          0% {
            bottom: -250px;
            transform: translateX(-50%) scale(0.8);
            opacity: 0;
          }
          10% {
            bottom: 40%;
            transform: translateX(-50%) scale(1.08);
            opacity: 1;
          }
          15% {
            bottom: 40%;
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          75% {
            bottom: 48%;
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          85% {
            bottom: 50%;
            transform: translateX(-50%) scale(1);
            opacity: 1;
          }
          100% {
            bottom: 120vh;
            transform: translateX(-50%) scale(0.9);
            opacity: 0;
          }
        }
        .reward-thumb-container:hover .reward-thumb-img {
          transform: scale(1.12);
        }
        .btn-reward-cta:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          border-color: rgba(255, 255, 255, 0.18) !important;
        }
        .tournament-reward-banner:hover {
          background: rgba(255, 255, 255, 0.035) !important;
          border-color: rgba(255, 255, 255, 0.15) !important;
        }
      `}</style>

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand">
          <img
            src={tenant?.logo_url || "/logo.png"}
            alt={tenant?.name || "Matchup"}
            className="nav-logo"
            style={{
              height: '36px',
              width: 'auto',
              maxHeight: '36px',
              objectFit: 'contain',
              filter: tenant && tenant.slug !== 'default' ? 'none' : 'invert(1)'
            }}
          />
          <span className="nav-wordmark">
            {tenant && tenant.slug !== 'default' ? (
              <span style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--primary-color)' }}>{tenant.name}</span>
            ) : (
              <><span>MATCH</span><span className="up">UP</span></>
            )}
          </span>
        </div>

        <div className="nav-right">
          <div className="nav-user-info">
            <span className="nav-display-name">{user?.display_name}</span>
            <span className="nav-username">@{user?.username}</span>
          </div>
          {isTenantAdmin && user?.role === 'admin' && <span className="badge badge-admin">Admin</span>}
          <button id="signout-btn" className="btn btn-secondary btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div className="page-content">
        {user?.role === 'admin' && user?.tenant_id !== tenant?.id && (
          <div style={{
            background: 'rgba(10, 132, 255, 0.1)',
            border: '1px solid rgba(10, 132, 255, 0.2)',
            borderRadius: '16px',
            padding: '16px 24px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '18px' }}>🌐</span>
              <p style={{ margin: 0, fontSize: '14px', color: '#e5e5ea', fontWeight: 500 }}>
                You are logged in as the coordinator of another league.
              </p>
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await api.get(`/tenant/resolve-id/${user.tenant_id}`);
                  if (res.data?.success && res.data?.data?.slug) {
                    const slug = res.data.data.slug;
                    localStorage.setItem('oauth_tenant_slug', slug);
                    window.location.href = `/?tenant=${slug}`;
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              style={{
                background: 'rgba(10, 132, 255, 0.2)',
                border: '1px solid rgba(10, 132, 255, 0.4)',
                borderRadius: '8px',
                color: '#007aff',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backdropFilter: 'blur(5px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#007aff';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(10, 132, 255, 0.2)';
                e.currentTarget.style.color = '#007aff';
              }}
            >
              Go to My League Dashboard
            </button>
          </div>
        )}

        {/* No Tournament State */}
        {!tournament ? (
          <div className="no-tournament-container">
            <div className="home-hero">
              <h1>No Active Tournament</h1>
              <p>Matchup is currently waiting for the admin to kick off the next tournament.</p>
            </div>

            {/* Launch Form */}
            {isTenantAdmin && (
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

              {reward && (
                <div
                  className="tournament-reward-banner animate-slide-down"
                  style={{
                    marginTop: '16px',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1.5px dashed rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255, 255, 255, 0.85)',
                        flexShrink: 0,
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 12 20 22 4 22 4 12" />
                        <rect x="2" y="7" width="20" height="5" />
                        <line x1="12" y1="22" x2="12" y2="7" />
                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                      </svg>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1px' }}>
                        Tournament Reward
                      </span>
                      <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: '600', color: 'rgba(255, 255, 255, 0.9)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {reward.name}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {reward.image_url && (
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                          flexShrink: 0,
                        }}
                        className="reward-thumb-container"
                        onClick={() => window.open(reward.image_url, '_blank')}
                        title="View Full Reward Image"
                      >
                        <img
                          src={reward.image_url}
                          alt="Reward"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s' }}
                          className="reward-thumb-img"
                        />
                      </div>
                    )}

                    {reward.cta_link && (
                      <a
                        href={reward.cta_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: '600',
                          color: '#fff',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          textDecoration: 'none',
                          transition: 'all 0.2s',
                        }}
                        className="btn-reward-cta"
                      >
                        {reward.cta_text || 'View details'}
                      </a>
                    )}
                  </div>
                </div>
              )}

              {tournament.status === 'completed' && championClaim && (
                <div
                  className="champion-celebration-card"
                  style={{
                    background: 'rgba(255, 215, 0, 0.05)',
                    border: '1.5px solid rgba(255, 215, 0, 0.35)',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    marginTop: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '20px',
                    flexWrap: 'wrap',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(255, 215, 0, 0.08)',
                    backdropFilter: 'blur(10px)',
                    animation: 'goldGlowPulse 3s infinite alternate',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '-50%',
                      left: '-50%',
                      width: '200%',
                      height: '200%',
                      background: 'radial-gradient(circle, rgba(255,215,0,0.1) 0%, rgba(255,215,0,0) 60%)',
                      pointerEvents: 'none',
                      zIndex: 0,
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(255, 215, 0, 0.12)',
                        border: '2px solid #F5C842',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
                        animation: 'trophyBounce 2.5s infinite ease-in-out',
                      }}
                    >
                      <svg viewBox="0 0 100 120" width="32" height="38" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 4px 10px rgba(245, 200, 66, 0.35))' }}>
                        <defs>
                          <linearGradient id="uclGoldGradSmall" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FFF" stopOpacity="0.9" />
                            <stop offset="25%" stopColor="#F9F5E8" />
                            <stop offset="50%" stopColor="#DFB236" />
                            <stop offset="75%" stopColor="#BC9122" />
                            <stop offset="100%" stopColor="#8A640F" />
                          </linearGradient>
                          <linearGradient id="uclReflectGradSmall" x1="100%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#FFF" stopOpacity="0.3" />
                            <stop offset="50%" stopColor="#FFF" stopOpacity="0" />
                            <stop offset="100%" stopColor="#000" stopOpacity="0.4" />
                          </linearGradient>
                        </defs>
                        <path d="M 32 35 C 10 32, 6 75, 33 80 C 31 75, 23 70, 32 45" stroke="url(#uclGoldGradSmall)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                        <path d="M 68 35 C 90 32, 94 75, 67 80 C 69 75, 77 70, 68 45" stroke="url(#uclGoldGradSmall)" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                        <ellipse cx="50" cy="30" rx="18" ry="4" fill="url(#uclGoldGradSmall)" />
                        <path d="M 32 30 C 32 65, 36 82, 50 88 C 64 82, 68 65, 68 30 Z" fill="url(#uclGoldGradSmall)" />
                        <path d="M 32 30 C 32 65, 36 82, 50 88 C 64 82, 68 65, 68 30 Z" fill="url(#uclReflectGradSmall)" style={{ mixBlendMode: 'overlay' }} />
                        <path d="M 44 88 L 42 100 L 58 100 L 56 88 Z" fill="url(#uclGoldGradSmall)" />
                        <ellipse cx="50" cy="100" rx="12" ry="3" fill="url(#uclGoldGradSmall)" />
                        <rect x="36" y="100" width="28" height="6" rx="2" fill="url(#uclGoldGradSmall)" />
                        <rect x="32" y="106" width="36" height="4" rx="1" fill="#111" stroke="url(#uclGoldGradSmall)" strokeWidth="1" />
                        <path d="M 32 32 L 33.5 34 L 35.5 34.5 L 33.5 35 L 32 37 L 30.5 35 L 28.5 34.5 L 30.5 34 Z" fill="#FFF" opacity="0.9" />
                        <path d="M 68 48 L 69 50 L 71 50.5 L 69 51 L 68 53 L 67 51 L 65 50.5 L 67 50 Z" fill="#FFF" opacity="0.8" />
                        <path d="M 48 65 L 49.5 67 L 51.5 67.5 L 49.5 68 L 48 70 L 46.5 69 L 44.5 67.5 L 46.5 67 Z" fill="#FFF" opacity="0.95" />
                      </svg>
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          color: '#F5C842',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          display: 'block',
                          marginBottom: '2px',
                        }}
                      >
                        Tournament Champion
                      </span>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: '1.4rem',
                          fontWeight: '800',
                          color: '#fff',
                          letterSpacing: '-0.02em',
                          lineHeight: 1.2,
                          textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                        }}
                      >
                        {championClaim.users?.display_name || championClaim.users?.username}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        {championClaim.nations?.flag_url && (
                          <img
                            src={championClaim.nations.flag_url}
                            alt=""
                            style={{ width: '18px', height: '12px', borderRadius: '1px', objectFit: 'cover' }}
                          />
                        )}
                        <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.85rem', fontWeight: '500' }}>
                          {championClaim.nations?.name}
                        </span>
                        <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.8rem' }}>•</span>
                        <span style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '0.8rem' }}>
                          @{championClaim.users?.username}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={() => navigate('/profile/' + championClaim.id)}
                    style={{
                      zIndex: 1,
                      background: 'linear-gradient(135deg, #F5C842 0%, #D4AF37 100%)',
                      border: 'none',
                      color: '#111',
                      fontWeight: '700',
                      boxShadow: '0 4px 15px rgba(255, 215, 0, 0.2)',
                      padding: '8px 16px',
                      fontSize: '0.85rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                    }}
                  >
                    View Champion Profile
                  </button>
                </div>
              )}
            </div>

            {/* Admin Console Card */}
            {isTenantAdmin && (
              <div className="admin-console-card">
                <div className="console-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3>Admin Operations</h3>
                    <span className="console-subtitle">Tournament Management Panel</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setShowNotificationDrawer(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      Notifications
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowRewardsPanel(!showRewardsPanel);
                        setShowInvitesPanel(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: showRewardsPanel ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 12 20 22 4 22 4 12" />
                        <rect x="2" y="7" width="20" height="5" />
                        <line x1="12" y1="22" x2="12" y2="7" />
                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                      </svg>
                      {showRewardsPanel ? 'Close Rewards' : 'Manage Rewards'}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setShowInvitesPanel(!showInvitesPanel);
                        setShowRewardsPanel(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: showInvitesPanel ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        borderRadius: '8px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="8.5" cy="7" r="4" />
                        <line x1="20" y1="8" x2="20" y2="14" />
                        <line x1="23" y1="11" x2="17" y2="11" />
                      </svg>
                      {showInvitesPanel ? 'Close Invites' : 'Manage Invites'}
                    </button>
                  </div>
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

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleResetTournament}
                    disabled={isAdminActionLoading}
                    style={{
                      borderColor: 'rgba(239, 68, 68, 0.25)',
                      color: '#ef4444',
                      background: 'rgba(239, 68, 68, 0.04)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.04)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)';
                    }}
                  >
                    Reset Tournament
                  </button>
                </div>

                {/* Admin Rewards Panel */}
                {showRewardsPanel && (
                  <div className="admin-rewards-panel mt-6 pt-6 border-t animate-slide-down" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#F5C842" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 12 20 22 4 22 4 12" />
                        <rect x="2" y="7" width="20" height="5" />
                        <line x1="12" y1="22" x2="12" y2="7" />
                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                      </svg>
                      Configure Tournament Rewards
                    </h4>

                    {rewardSaveSuccess && (
                      <div className="form-success mb-4" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
                        Reward configurations updated successfully!
                      </div>
                    )}

                    <form onSubmit={handleSaveReward} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255,255,255,0.45)' }}>Reward Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Cash Prize: $150 + Winner Role"
                          value={rewardName}
                          onChange={(e) => setRewardName(e.target.value)}
                          className="form-input"
                          required
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255,255,255,0.45)' }}>Reward Image (Optional)</label>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <input
                            type="file"
                            accept="image/*"
                            id="reward-file-input"
                            onChange={handleRewardImageUpload}
                            style={{ display: 'none' }}
                          />
                          <label
                            htmlFor="reward-file-input"
                            style={{
                              padding: '8px 14px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              color: '#fff',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="17 8 12 3 7 8" />
                              <line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Upload Image
                          </label>

                          {rewardImageUrl && (
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <img
                                src={rewardImageUrl}
                                alt="Reward Preview"
                                style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }}
                              />
                              <button
                                type="button"
                                onClick={() => setRewardImageUrl('')}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                        {rewardUploadError && (
                          <span style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '2px' }}>{rewardUploadError}</span>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255,255,255,0.45)' }}>CTA Link URL (Optional)</label>
                          <input
                            type="url"
                            placeholder="https://example.com"
                            value={rewardCtaLink}
                            onChange={(e) => setRewardCtaLink(e.target.value)}
                            className="form-input"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
                          />
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255,255,255,0.45)' }}>CTA Button Text (Optional)</label>
                          <input
                            type="text"
                            placeholder="e.g. Learn More"
                            value={rewardCtaText}
                            onChange={(e) => setRewardCtaText(e.target.value)}
                            className="form-input"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={rewardIsSaving}
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '8px', alignSelf: 'flex-start' }}
                      >
                        {rewardIsSaving ? 'Saving Reward...' : 'Save Reward Details'}
                      </button>
                    </form>
                  </div>
                )}

                {/* Admin Invitations Panel */}
                {showInvitesPanel && (
                  <div className="admin-invitations-panel mt-6 pt-6 border-t animate-slide-down" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <InvitationsTab />
                  </div>
                )}

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

                {tournament.status === 'completed' && (
                  <div className="new-tournament-launcher mt-6 pt-6 border-t animate-slide-down" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>
                      Start Next Tournament
                    </h4>

                    <form onSubmit={handleCreateTournament} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255,255,255,0.45)' }}>Tournament Name</label>
                        <input
                          type="text"
                          placeholder="e.g. FIFA World Cup 2026"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="form-input"
                          required
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'rgba(255,255,255,0.45)' }}>Tournament Mode</label>
                        <select
                          value={newMode}
                          onChange={(e) => setNewMode(e.target.value as any)}
                          className="form-input"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem' }}
                        >
                          <option value="world_cup" style={{ background: '#18181b', color: '#fff' }}>FIFA World Cup Mode</option>
                          <option value="ucl" style={{ background: '#18181b', color: '#fff' }}>UEFA Champions League Mode</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={isAdminActionLoading}
                        style={{ marginTop: '4px' }}
                      >
                        {isAdminActionLoading ? 'Initializing...' : 'Launch Tournament'}
                      </button>
                    </form>
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
              <div className={`claim-picker-section ${introState === 'done' ? 'fade-in-content' : ''}`}>
                {introState === 'done' && (
                  <>
                    {isTenantAdmin && (
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
                  </>
                )}
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
          isAdmin={isTenantAdmin}
          onClose={() => setSelectedMatchId(null)}
          onRefresh={loadData}
        />
      )}

      {/* Admin Notification Drawer */}
      <AdminNotificationDrawer
        isOpen={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        tournamentStatus={tournament?.status}
      />

    </div>
  );
}

interface TournamentIntroVideoProps {
  mode: 'world_cup' | 'ucl' | string;
  onFinish: () => void;
}

function TournamentIntroVideo({ mode, onFinish }: TournamentIntroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [playError, setPlayError] = useState(false);

  const videoUrl = mode === 'ucl' ? '/ucl.mp4' : '/wc.mp4';

  // Try to autoplay on mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const startPlayback = async () => {
      try {
        video.muted = false;
        setIsMuted(false);
        await video.play();
      } catch (err) {
        console.warn("Autoplay unmuted blocked by browser, showing play prompt", err);
        setPlayError(true);
      }
    };

    startPlayback();
  }, []);

  // Handle skip with sound fade and class fade
  const handleSkip = () => {
    if (isFadingOut) return;
    setIsFadingOut(true);

    const video = videoRef.current;
    if (video) {
      // Fade out volume smoothly
      let currentVolume = video.volume;
      const fadeAudio = setInterval(() => {
        if (video && currentVolume > 0.05) {
          currentVolume -= 0.05;
          video.volume = Math.max(0, currentVolume);
        } else {
          clearInterval(fadeAudio);
        }
      }, 50);
    }

    // Wait for the CSS opacity transition to finish (1.5s)
    setTimeout(() => {
      onFinish();
    }, 1500);
  };

  // Toggle Mute / Unmute
  const toggleMute = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // prevent triggering double tap on fast click
    }
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };

  // Double tap handler for mobile
  const lastTapRef = useRef<number>(0);
  const handleTouchEnd = (e: React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      e.preventDefault();
      handleSkip();
    } else {
      // Single tap toggles mute/unmute
      toggleMute();
    }
    lastTapRef.current = now;
  };

  // Single click toggles mute, double click skips
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.detail === 2) {
      // Double click
      handleSkip();
    } else if (e.detail === 1) {
      // Single click
      toggleMute();
    }
  };

  return (
    <div
      className={`cinematic-intro-overlay ${isFadingOut ? 'fade-out' : ''}`}
      onClick={handleOverlayClick}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: 'pointer' }}
    >
      <video
        ref={videoRef}
        className="cinematic-video"
        src={videoUrl}
        playsInline
        onEnded={handleSkip}
      />

      {playError && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 100001 }}>
          <button
            type="button"
            className={`cinematic-play-btn ${mode === 'ucl' ? 'ucl-accent' : 'wc-accent'}`}
            onClick={(e) => {
              e.stopPropagation();
              const video = videoRef.current;
              if (video) {
                video.muted = false;
                setIsMuted(false);
                video.play().then(() => {
                  setPlayError(false);
                }).catch(err => console.error("Manual play failed", err));
              }
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ transform: 'translateX(1px)' }}>
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Enter Tournament
          </button>
        </div>
      )}

      <div className="cinematic-hud">
        {/* Playback status buttons */}
        <button
          type="button"
          className="cinematic-btn-hud"
          onClick={toggleMute}
        >
          {isMuted ? (
            <>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: 'translateY(1px)' }}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
              Unmute
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: 'translateY(1px)' }}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              Mute
            </>
          )}
        </button>

        {/* Action hints */}
        <div className="cinematic-hint-hud">
          <span>Double-tap to skip</span>
        </div>
      </div>
    </div>
  );
}
