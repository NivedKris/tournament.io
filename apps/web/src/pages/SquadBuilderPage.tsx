import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

export default function SquadBuilderPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetClaimId = searchParams.get('claimId');

  const [claimId, setClaimId] = useState<string | null>(null);
  const [formation, setFormation] = useState('4-3-3');
  const [positions, setPositions] = useState<Record<string, Player | null>>({});
  const [coords, setCoords] = useState<Record<string, { x: number; y: number }>>({});

  // Swapping State
  const [swapSourceNode, setSwapSourceNode] = useState<string | null>(null);

  // Filled node action popup state
  const [nodeActionsKey, setNodeActionsKey] = useState<string | null>(null);

  // Searching State
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Player[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Saving State
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [isLocked, setIsLocked] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);

  // Screenshot Upload State
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Admin Claim Info
  const [adminClaimInfo, setAdminClaimInfo] = useState<any | null>(null);

  const pitchRef = useRef<HTMLDivElement>(null);
  const dragNodeRef = useRef<string | null>(null);

  const isEditable = !isLocked || (user?.role === 'admin' && !!adminClaimInfo);

  // Load existing claim & squad
  useEffect(() => {
    async function loadData() {
      try {
        const tRes = await api.get('/tournament/current');
        if (!tRes.data.success || !tRes.data.data) {
          navigate('/');
          return;
        }

        const nRes = await api.get('/tournament/nations');
        if (nRes.data.success) {
          const allClaims = nRes.data.data.flatMap((n: any) => 
            (n.claims || []).map((c: any) => ({
              ...c,
              nation_name: n.name,
              flag_url: n.flag_url,
            }))
          );

          let resolvedClaimId = '';
          const isAdmin = user?.role === 'admin';
          if (isAdmin && targetClaimId) {
            resolvedClaimId = targetClaimId;
            const claimInfo = allClaims.find((c: any) => c.id === targetClaimId);
            setAdminClaimInfo(claimInfo || { id: targetClaimId, display_name: 'Player', nation_name: 'Target Team' });
          } else {
            const userClaim = allClaims.find((c: any) => c.user_id === user?.id);
            if (!userClaim) {
              navigate('/');
              return;
            }
            resolvedClaimId = userClaim.id;
          }
          setClaimId(resolvedClaimId);

          const sRes = await api.get(`/squad/${resolvedClaimId}`);
          if (sRes.data.success && sRes.data.data) {
            const squad = sRes.data.data;
            setFormation(squad.formation);
            setPositions(squad.positions || {});
            setIsLocked(!!squad.locked);
            setScreenshotUrl(squad.screenshot_url || null);

            if (squad.coordinates) {
              setCoords(squad.coordinates);
            } else {
              setCoords(PRESETS[squad.formation] || PRESETS['4-3-3']);
            }
          } else {
            setCoords(PRESETS['4-3-3']);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (user) {
      loadData();
    }
  }, [user, navigate, targetClaimId]);

  // Handle formation change
  const handleFormationChange = (newForm: string) => {
    setFormation(newForm);
    setCoords(PRESETS[newForm]);

    const newPositions: Record<string, Player | null> = {};
    Object.keys(PRESETS[newForm]).forEach((posKey) => {
      newPositions[posKey] = positions[posKey] || null;
    });
    SUBS.forEach((subKey) => {
      newPositions[subKey] = positions[subKey] || null;
    });
    setPositions(newPositions);
  };

  // Assign player to active position node, with duplicate check
  const selectPlayer = (player: Player) => {
    if (!activeNode) return;

    // Check if player is already assigned somewhere else in the team
    const existingPosKey = Object.keys(positions).find(
      (key) => positions[key]?.id === player.id
    );

    setPositions((prev) => {
      const next = { ...prev };
      if (existingPosKey) {
        next[existingPosKey] = null;
      }
      next[activeNode] = player;
      return next;
    });

    setActiveNode(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // Handle slot clicking (Starting XI or Sub)
  const handleSlotClick = (nodeKey: string) => {
    if (!isEditable) return;
    if (swapSourceNode) {
      if (swapSourceNode === nodeKey) {
        setSwapSourceNode(null);
        return;
      }
      setPositions((prev) => ({
        ...prev,
        [swapSourceNode]: prev[nodeKey] || null,
        [nodeKey]: prev[swapSourceNode] || null,
      }));
      setSwapSourceNode(null);
      return;
    }

    const player = positions[nodeKey];
    if (!player) {
      setActiveNode(nodeKey);
    } else {
      setNodeActionsKey(nodeKey);
    }
  };

  // Debounced player search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await api.get(`/squad/players/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.data.success) {
          setSearchResults(response.data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Drag handlers for starting XI
  const handleTouchStart = (nodeKey: string) => {
    if (!isEditable) return;
    dragNodeRef.current = nodeKey;
  };

  const handleMouseDown = (nodeKey: string) => {
    if (!isEditable) return;
    dragNodeRef.current = nodeKey;
  };

  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (!dragNodeRef.current || !pitchRef.current) return;
      const rect = pitchRef.current.getBoundingClientRect();
      let x = ((clientX - rect.left) / rect.width) * 100;
      let y = ((clientY - rect.top) / rect.height) * 100;

      x = Math.max(5, Math.min(95, x));
      y = Math.max(5, Math.min(95, y));

      setCoords((prev) => ({
        ...prev,
        [dragNodeRef.current!]: { x, y },
      }));
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onEnd = () => {
      dragNodeRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  const handleLock = async () => {
    // 1. Verify starting XI is fully populated
    const reqPositions = PRESETS[formation] ? Object.keys(PRESETS[formation]) : [];
    const missingPositions = reqPositions.filter(pos => !positions[pos]);

    // 2. Verify all 15 substitutes are fully populated
    const missingSubs = SUBS.filter(subKey => !positions[subKey]);

    if ((missingPositions.length > 0 || missingSubs.length > 0) && !screenshotUrl) {
      let errMsg = "Cannot lock squad: Your squad is incomplete. ";
      const parts = [];
      if (missingPositions.length > 0) {
        parts.push(`missing starting positions: ${missingPositions.join(', ')}`);
      }
      if (missingSubs.length > 0) {
        parts.push(`missing substitute slots: ${missingSubs.map(s => s.replace('SUB_', 'SUB ')).join(', ')}`);
      }
      errMsg += parts.join(' and ') + ". Please fill all slots before locking.";
      setLockError(errMsg);
      alert(errMsg);
      return;
    }

    if (!window.confirm(adminClaimInfo
      ? `Are you sure you want to LOCK this squad? The player will no longer be able to make changes.`
      : "Are you sure you want to LOCK your squad? Once locked, you cannot modify, swap, or search for players, and your formation is final for this tournament."
    )) {
      return;
    }

    setIsLocking(true);
    setLockError(null);

    try {
      const response = await api.post('/squad/lock', {
        claimId: adminClaimInfo ? claimId : undefined,
        lock: true
      });
      if (response.data.success) {
        setIsLocked(true);
      } else {
        setLockError(response.data.error || 'Failed to lock squad');
      }
    } catch (err: any) {
      console.error(err);
      setLockError(err.response?.data?.error || 'Failed to lock squad');
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlock = async () => {
    if (!window.confirm("Are you sure you want to UNLOCK this squad? The player will be allowed to modify their squad again.")) {
      return;
    }

    setIsUnlocking(true);
    setLockError(null);

    try {
      const response = await api.post('/squad/lock', {
        claimId: adminClaimInfo ? claimId : undefined,
        lock: false
      });
      if (response.data.success) {
        setIsLocked(false);
      } else {
        setLockError(response.data.error || 'Failed to unlock squad');
      }
    } catch (err: any) {
      console.error(err);
      setLockError(err.response?.data?.error || 'Failed to unlock squad');
    } finally {
      setIsUnlocking(false);
    }
  };

  // Save squad action
  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      const savedPositions: Record<string, Player | null> = {};
      Object.keys(coords).forEach((key) => {
        savedPositions[key] = positions[key] || null;
      });
      SUBS.forEach((key) => {
        savedPositions[key] = positions[key] || null;
      });

      const response = await api.post('/squad', {
        formation,
        positions: savedPositions,
        coordinates: coords,
        screenshot_url: screenshotUrl,
        claimId: adminClaimInfo ? claimId : undefined,
      });

      if (response.data.success) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await api.post('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success && response.data.data?.url) {
        setScreenshotUrl(response.data.data.url);
      } else {
        alert(response.data.error || 'Upload failed');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const startingCount = Object.keys(coords).filter((k) => positions[k]).length;
  const subCount = SUBS.filter((k) => positions[k]).length;

  return (
    <div className="app-shell">
      {/* Squad Locked Banner */}
      {isLocked && (
        <div className="swap-banner-container" style={{ background: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
          <div className="swap-banner" style={{ color: '#10b981' }}>
            <span><strong>SQUAD LOCKED</strong> — {adminClaimInfo ? "This user's squad is locked." : "Your squad is registered and locked for this tournament. No further edits can be made."}</span>
          </div>
        </div>
      )}

      {/* Swap Mode Indicator Banner */}
      {swapSourceNode && (
        <div className="swap-banner-container">
          <div className="swap-banner">
            <span>Swapping <strong>{positions[swapSourceNode]?.name || swapSourceNode}</strong>. Select another slot to swap.</span>
            <button className="btn btn-secondary btn-sm" onClick={() => setSwapSourceNode(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img src="/logo.png" alt="Matchup" className="nav-logo" />
          <span className="nav-wordmark">
            <span>MATCH</span><span className="up">UP</span>
          </span>
        </div>

        <div className="nav-right">
          {saveStatus === 'success' && <span className="status-toast success">Squad Saved</span>}
          {saveStatus === 'error' && <span className="status-toast error">Save Failed</span>}
          {lockError && <span className="status-toast error">{lockError}</span>}

          {adminClaimInfo ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Squad'}
              </button>
              {isLocked ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleUnlock}
                  disabled={isUnlocking}
                >
                  {isUnlocking ? 'Unlocking...' : 'Unlock Squad'}
                </button>
              ) : (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={handleLock}
                  disabled={isLocking}
                >
                  {isLocking ? 'Locking...' : 'Lock Squad'}
                </button>
              )}
            </div>
          ) : (
            !isLocked ? (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleLock}
                  disabled={isSaving || isLocking}
                  style={{ marginRight: '8px' }}
                >
                  {isLocking ? 'Locking...' : 'Lock Squad'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSave}
                  disabled={isSaving || isLocking}
                >
                  {isSaving ? 'Saving...' : 'Save Tactics'}
                </button>
              </>
            ) : (
              <button className="btn btn-success btn-sm" disabled style={{ background: '#10b981', color: '#fff', border: 'none', opacity: 0.8, cursor: 'not-allowed' }}>
                Locked & Ready
              </button>
            )
          )}
        </div>
      </nav>

      {adminClaimInfo && (
        <div className="admin-console-card" style={{ margin: '24px 24px 0 24px', borderLeft: '4px solid var(--accent)', padding: '16px 24px' }}>
          <div className="console-header" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="badge badge-admin" style={{ marginRight: '8px', background: '#3b82f6', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>ADMIN MODE</span>
              <span style={{ color: 'var(--fg-muted)', fontSize: '0.9rem' }}>Editing squad for <strong>{adminClaimInfo.display_name}</strong> ({adminClaimInfo.nation_name})</span>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
              Exit Admin Mode
            </button>
          </div>
        </div>
      )}

      <div className="squad-builder-layout">
        {/* Sidebar Controls */}
        <div className="builder-sidebar">
          <div className="sidebar-section">
            <h3>Tactical Setup</h3>
            <p className="subtitle">Select your core formation preset, then drag players to fine-tune positioning.</p>

            <div className="form-group">
              <label>Formation ({startingCount + subCount}/26 Players)</label>
              <select
                value={formation}
                onChange={(e) => handleFormationChange(e.target.value)}
                className="form-input"
                disabled={!isEditable}
              >
                <option value="4-3-3">4-3-3 (Standard)</option>
                <option value="4-4-2">4-4-2 (Flat)</option>
                <option value="3-5-2">3-5-2 (Wingback)</option>
                <option value="4-2-3-1">4-2-3-1 (Balanced)</option>
                <option value="4-1-2-1-2">4-1-2-1-2 (Diamond)</option>
                <option value="4-5-1">4-5-1 (Flat Midfield)</option>
                <option value="4-3-2-1">4-3-2-1 (Christmas Tree)</option>
                <option value="5-3-2">5-3-2 (Defensive)</option>
                <option value="3-4-3">3-4-3 (Attacking)</option>
                <option value="5-4-1">5-4-1 (Park the Bus)</option>
                <option value="4-2-4">4-2-4 (Hyper Attacking)</option>
              </select>
            </div>
          </div>

          {/* Substitutes Section directly in the sidebar, with picture avatar card layout */}
          <div className="sidebar-section">
            <h3>Substitutes ({subCount}/15)</h3>
            <p className="subtitle" style={{ marginBottom: '12px' }}>Click slots to assign or swap.</p>

            <div className="subs-builder-grid">
              {SUBS.map((subKey, idx) => {
                const p = positions[subKey];
                const isSwapping = swapSourceNode !== null && swapSourceNode !== subKey;
                const isSource = swapSourceNode === subKey;

                return (
                  <div
                    key={subKey}
                    onClick={() => handleSlotClick(subKey)}
                    className={`sub-slot-card ${p ? 'filled' : ''} ${activeNode === subKey ? 'active' : ''} ${isSwapping ? 'pulsing-swap-target' : ''} ${isSource ? 'swap-source' : ''}`}
                  >
                    <div className="sub-slot-avatar-wrapper">
                      {p?.image_url ? (
                        <img src={p.image_url} alt={p.name} className="sub-slot-face" />
                      ) : (
                        <span className="sub-slot-face-placeholder">+</span>
                      )}
                      {p && <span className="sub-slot-ovr-badge">{p.overall}</span>}
                    </div>
                    <span className="sub-slot-index">SUB {idx + 1}</span>
                    <span className="sub-slot-name">
                      {p ? p.name.split(' ').pop() : 'Empty'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Squad Screenshot Upload / View */}
          <div className="squad-screenshot-section">
            <h3>Squad Screenshot</h3>
            {screenshotUrl ? (
              <div className="screenshot-preview-container">
                <img
                  src={screenshotUrl}
                  alt="Squad Screenshot"
                  className="screenshot-preview"
                  onClick={() => setIsFullscreen(true)}
                />
                {isEditable && (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setScreenshotUrl(null)}
                    style={{ width: '100%' }}
                  >
                    Remove Screenshot
                  </button>
                )}
              </div>
            ) : (
              <div className="screenshot-upload-dropzone">
                <p>Upload your squad screenshot</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotUpload}
                  disabled={isUploading || !isEditable}
                  id="screenshot-upload-input"
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="screenshot-upload-input"
                  className="btn btn-secondary btn-sm"
                  style={{ cursor: isUploading || !isEditable ? 'not-allowed' : 'pointer' }}
                >
                  {isUploading ? 'Uploading...' : 'Upload'}
                </label>
              </div>
            )}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', marginTop: '16px' }}
            onClick={() => navigate(claimId ? `/profile/${claimId}` : '/')}
          >
            View Public Profile
          </button>
        </div>

        {/* Pitch Area */}
        <div className="pitch-container">
          <div className="pitch-canvas" ref={pitchRef}>
            <div className="pitch-line center-circle"></div>
            <div className="pitch-line center-line"></div>
            <div className="pitch-line penalty-area-top"></div>
            <div className="pitch-line penalty-area-bottom"></div>

            {Object.keys(coords).map((nodeKey) => {
              const coord = coords[nodeKey] || { x: 50, y: 50 };
              const player = positions[nodeKey];
              const isSwapping = swapSourceNode !== null && swapSourceNode !== nodeKey;
              const isSource = swapSourceNode === nodeKey;

              return (
                <div
                  key={nodeKey}
                  style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                  className={`pitch-node ${activeNode === nodeKey ? 'active' : ''} ${isSwapping ? 'pulsing-swap-target' : ''} ${isSource ? 'swap-source' : ''}`}
                >
                  <div
                    className="drag-handle"
                    onMouseDown={() => handleMouseDown(nodeKey)}
                    onTouchStart={() => handleTouchStart(nodeKey)}
                  />
                  <div
                    className="node-card"
                    onClick={() => {
                      if (!dragNodeRef.current) {
                        handleSlotClick(nodeKey);
                      }
                    }}
                  >
                    <div className="node-avatar">
                      {player?.image_url ? (
                        <img src={player.image_url} alt={player.name} className="player-face" />
                      ) : (
                        <span className="player-face-placeholder">+</span>
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

        {/* Action popover for tapping/clicking assigned nodes */}
        {nodeActionsKey && (
          <div className="action-popover-overlay" onClick={() => setNodeActionsKey(null)}>
            <div className="action-popover" onClick={(e) => e.stopPropagation()}>
              <div className="popover-header">
                <h4>Manage {nodeActionsKey}</h4>
                <button className="close-btn" onClick={() => setNodeActionsKey(null)}>×</button>
              </div>
              <p className="popover-player-name">{positions[nodeActionsKey]?.name}</p>

              <div className="popover-buttons">
                <button className="btn btn-primary" onClick={() => {
                  setActiveNode(nodeActionsKey);
                  setNodeActionsKey(null);
                }}>
                  Change Player
                </button>
                <button className="btn btn-secondary" onClick={() => {
                  setSwapSourceNode(nodeActionsKey);
                  setNodeActionsKey(null);
                }}>
                  Swap Position
                </button>
                <button className="btn btn-danger" onClick={() => {
                  setPositions((prev) => ({ ...prev, [nodeActionsKey]: null }));
                  setNodeActionsKey(null);
                }}>
                  Remove Player
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Player Search Modal/Drawer */}
        {activeNode && (
          <div className="search-drawer-overlay" onClick={() => setActiveNode(null)}>
            <div className="search-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="drawer-header">
                <h3>Assign Player — {activeNode}</h3>
                <button className="close-btn" onClick={() => setActiveNode(null)}>×</button>
              </div>

              <input
                type="text"
                placeholder="Search eFootball player database..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input drawer-search"
                autoFocus
              />

              <div className="drawer-results">
                {isSearching ? (
                  <div className="searching-spinner">Searching players...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((player) => (
                    <div
                      key={player.id}
                      onClick={() => selectPlayer(player)}
                      className="player-search-item"
                    >
                      <img
                        src={player.image_url || '/logo.png'}
                        alt={player.name}
                        className="search-player-img"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      <div className="search-player-info">
                        <span className="search-player-name">{player.name}</span>
                        <span className="search-player-sub">
                          {player.club || 'Free Agent'} | {player.nationality || 'Unknown'}
                        </span>
                      </div>
                      <div className="search-player-rating">
                        <span className="badge badge-player">{player.positions[0]}</span>
                        <span className="overall-score">{player.overall}</span>
                      </div>
                    </div>
                  ))
                ) : searchQuery.trim().length >= 2 ? (
                  <div className="no-results">No players found matching your search.</div>
                ) : (
                  <div className="search-prompt">Type at least 2 characters to search eFootball players.</div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Fullscreen Screenshot Overlay */}
        {isFullscreen && screenshotUrl && (
          <div className="fullscreen-overlay" onClick={() => setIsFullscreen(false)}>
            <button className="close-fullscreen" onClick={() => setIsFullscreen(false)}>×</button>
            <img src={screenshotUrl} alt="Squad Screenshot Fullscreen" className="fullscreen-image" onClick={(e) => e.stopPropagation()} />
          </div>
        )}
      </div>
    </div>
  );
}
