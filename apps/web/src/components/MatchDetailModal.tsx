import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

interface UserInfo {
  id: string;
  username: string;
  display_name: string;
}

interface NationInfo {
  id: string;
  name: string;
  flag_url: string | null;
}

interface ClaimInfo {
  id: string;
  status: string;
  nation_id: string;
  user_id: string;
  nations: NationInfo | null;
  users: UserInfo | null;
}

interface MatchDetails {
  id: string;
  tournament_id: string;
  home_claim_id: string;
  away_claim_id: string;
  stage: string;
  group_name: string | null;
  round: number | null;
  bracket_slot: number | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
  submitted_by: string | null;
  is_prequal: boolean;
  is_bye: boolean;
  verified_at: string | null;
  screenshot_url: string | null;
  events?: Array<{
    id: string;
    claim_id: string;
    player_id: number;
    event_type: 'goal' | 'assist';
    player?: any;
    claim?: any;
  }>;
  home_claim: ClaimInfo | null;
  away_claim: ClaimInfo | null;
  dispute?: any;
}

interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  attachment_url?: string;
  created_at: string;
  users: UserInfo | null;
}

interface MatchDetailModalProps {
  matchId: string;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function MatchDetailModal({
  matchId,
  currentUserId,
  isAdmin,
  onClose,
  onRefresh,
}: MatchDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'match' | 'chat'>('match');
  const [match, setMatch] = useState<MatchDetails | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Submit score form state
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [homePens, setHomePens] = useState('');
  const [awayPens, setAwayPens] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submit score additions
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  // Each entry = one goal. assister_id is optional.
  const [events, setEvents] = useState<Array<{ claim_id: string; scorer_id: number; assister_id: number | null }>>([]);
  
  const [homeSquadPlayers, setHomeSquadPlayers] = useState<any[]>([]);
  const [awaySquadPlayers, setAwaySquadPlayers] = useState<any[]>([]);

  // Admin events state
  const [adminEvents, setAdminEvents] = useState<Array<{ claim_id: string; scorer_id: number; assister_id: number | null }>>([]);

  // File upload helper
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success && res.data.data?.url) {
        setScreenshotUrl(res.data.data.url);
      } else {
        setError(res.data.error || 'Failed to upload screenshot');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to upload screenshot');
    } finally {
      setIsUploading(false);
    }
  };

  // Admin form state
  const [adminHomeScore, setAdminHomeScore] = useState('');
  const [adminAwayScore, setAdminAwayScore] = useState('');
  const [adminHomePens, setAdminHomePens] = useState('');
  const [adminAwayPens, setAdminAwayPens] = useState('');

  // Dispute form state
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeComment, setDisputeComment] = useState('');
  const [resolutionComment, setResolutionComment] = useState('');

  // Chat file upload states
  const [chatAttachmentUrl, setChatAttachmentUrl] = useState('');
  const [isUploadingChat, setIsUploadingChat] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load match details
  const loadMatchDetails = async () => {
    try {
      const res = await api.get(`/matches/${matchId}`);
      if (res.data.success) {
        setMatch(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load match details:', err);
      setError(err.response?.data?.error || 'Failed to load match');
    }
  };

  // Load chat messages
  const loadMessages = async () => {
    try {
      const res = await api.get(`/matches/${matchId}/messages`);
      if (res.data.success) {
        setMessages(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadMatchDetails(), loadMessages()]).finally(() => {
      setIsLoading(false);
    });
  }, [matchId]);

  // Chat polling (every 6 seconds, only when activeTab is chat)
  useEffect(() => {
    if (activeTab !== 'chat') return;
    const interval = setInterval(() => {
      loadMessages();
    }, 6000);
    return () => clearInterval(interval);
  }, [matchId, activeTab]);

  // Scroll to bottom on new messages or tab switch
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Load squad players for scorers/assisters listing
  useEffect(() => {
    if (match) {
      if (match.home_claim_id) {
        api.get(`/squad/${match.home_claim_id}`).then((res) => {
          if (res.data.success && res.data.data) {
            const pos = res.data.data.positions || {};
            const list = Object.values(pos).filter(Boolean);
            setHomeSquadPlayers(list);
          }
        });
      }
      if (match.away_claim_id) {
        api.get(`/squad/${match.away_claim_id}`).then((res) => {
          if (res.data.success && res.data.data) {
            const pos = res.data.data.positions || {};
            const list = Object.values(pos).filter(Boolean);
            setAwaySquadPlayers(list);
          }
        });
      }
    }
  }, [match]);

  // Pre-populate admin override fields when match loads
  useEffect(() => {
    if (match) {
      setAdminHomeScore(match.home_score !== null ? match.home_score.toString() : '');
      setAdminAwayScore(match.away_score !== null ? match.away_score.toString() : '');
      setAdminHomePens(match.home_pens !== null ? match.home_pens.toString() : '');
      setAdminAwayPens(match.away_pens !== null ? match.away_pens.toString() : '');
      if (match.events) {
        const parsed: Array<{ claim_id: string; scorer_id: number; assister_id: number | null }> = [];
        const teams = Array.from(new Set(match.events.map(e => e.claim_id)));

        for (const teamId of teams) {
          const teamGoals = match.events.filter(e => e.claim_id === teamId && e.event_type === 'goal');
          const teamAssists = match.events.filter(e => e.claim_id === teamId && e.event_type === 'assist');

          const maxCount = Math.max(teamGoals.length, teamAssists.length);
          for (let i = 0; i < maxCount; i++) {
            const goal = teamGoals[i];
            const assist = teamAssists[i];
            parsed.push({
              claim_id: teamId,
              scorer_id: goal ? goal.player_id : 0,
              assister_id: assist ? assist.player_id : null,
            });
          }
        }
        setAdminEvents(parsed);
      }
    }
  }, [match]);

  if (isLoading || !match) {
    return (
      <div className="modal-backdrop">
        <div className="modal-content loading-modal">
          <div className="loading-spinner"></div>
          <span>Loading match details...</span>
        </div>
      </div>
    );
  }

  const isUserParticipant =
    match.home_claim?.user_id === currentUserId ||
    match.away_claim?.user_id === currentUserId;

  const showSubmitForm =
    match.status === 'scheduled' && isUserParticipant && !match.is_bye;

  const showConfirmationBox =
    match.status === 'pending_verification' &&
    isUserParticipant &&
    match.submitted_by !== currentUserId;

  const showWaitingBox =
    match.status === 'pending_verification' &&
    isUserParticipant &&
    match.submitted_by === currentUserId;

  // Handle Score Submission
  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const hs = parseInt(homeScore);
    const as_ = parseInt(awayScore);

    if (isNaN(hs) || isNaN(as_)) {
      setError('Scores must be integers.');
      setIsSubmitting(false);
      return;
    }

    if (!screenshotUrl) {
      setError('A result screenshot is required as proof.');
      setIsSubmitting(false);
      return;
    }

    // Flatten combined goal rows into flat goal + assist events for the API
    const flatEvents: Array<{ claim_id: string; player_id: number; event_type: 'goal' | 'assist' }> = [];
    for (const ev of events) {
      if (!ev.claim_id || !ev.scorer_id) continue;
      flatEvents.push({ claim_id: ev.claim_id, player_id: ev.scorer_id, event_type: 'goal' });
      if (ev.assister_id) {
        flatEvents.push({ claim_id: ev.claim_id, player_id: ev.assister_id, event_type: 'assist' });
      }
    }

    const payload: any = {
      home_score: hs,
      away_score: as_,
      screenshot_url: screenshotUrl,
      events: flatEvents,
    };

    // Shootout required if score is equal and stage is pre_qual or knockout
    const isPrequalOrKnockout = match.stage === 'pre_qual' || match.stage === 'knockout';
    if (hs === as_ && isPrequalOrKnockout) {
      const hp = parseInt(homePens);
      const ap = parseInt(awayPens);

      if (isNaN(hp) || isNaN(ap)) {
        setError('Penalties score is required for tied matches.');
        setIsSubmitting(false);
        return;
      }
      if (hp === ap) {
        setError('Penalty shootout must have a clear winner.');
        setIsSubmitting(false);
        return;
      }
      payload.home_pens = hp;
      payload.away_pens = ap;
    }

    try {
      const res = await api.post(`/matches/${matchId}/submit-score`, payload);
      if (res.data.success) {
        await loadMatchDetails();
        onRefresh();
      } else {
        setError(res.data.error || 'Failed to submit score');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit score');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Score Confirmation
  const handleConfirmScore = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post(`/matches/${matchId}/confirm-score`);
      if (res.data.success) {
        await loadMatchDetails();
        onRefresh();
      } else {
        setError(res.data.error || 'Failed to confirm score');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to confirm score');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Chat message sending
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    try {
      const payload: any = { body: chatInput.trim() };
      if (chatAttachmentUrl) {
        payload.attachment_url = chatAttachmentUrl;
      }
      const res = await api.post(`/matches/${matchId}/messages`, payload);
      if (res.data.success) {
        setMessages((prev) => [...prev, res.data.data]);
        setChatInput('');
        setChatAttachmentUrl('');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  // Handle uploading image inside chat
  const handleChatFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingChat(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success && res.data.data?.url) {
        setChatAttachmentUrl(res.data.data.url);
      } else {
        setError(res.data.error || 'Failed to upload attachment');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to upload attachment');
    } finally {
      setIsUploadingChat(false);
    }
  };

  // Admin Force Verify
  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const hs = parseInt(adminHomeScore);
    const as_ = parseInt(adminAwayScore);

    if (isNaN(hs) || isNaN(as_)) {
      setError('Admin verification scores must be integers.');
      return;
    }

    const flatEvents: Array<{ claim_id: string; player_id: number; event_type: 'goal' | 'assist' }> = [];
    for (const ev of adminEvents) {
      if (!ev.claim_id) continue;
      if (ev.scorer_id) {
        flatEvents.push({
          claim_id: ev.claim_id,
          player_id: ev.scorer_id,
          event_type: 'goal'
        });
      }
      if (ev.assister_id) {
        flatEvents.push({
          claim_id: ev.claim_id,
          player_id: ev.assister_id,
          event_type: 'assist'
        });
      }
    }
    const payload: any = { home_score: hs, away_score: as_, events: flatEvents };
    if (hs === as_ && (match.stage === 'pre_qual' || match.stage === 'knockout')) {
      const hp = parseInt(adminHomePens);
      const ap = parseInt(adminAwayPens);
      if (isNaN(hp) || isNaN(ap) || hp === ap) {
        setError('Valid distinct penalty scores are required for draws in this stage.');
        return;
      }
      payload.home_pens = hp;
      payload.away_pens = ap;
    }

    try {
      const res = await api.post(`/matches/admin/${matchId}/verify`, payload);
      if (res.data.success) {
        await loadMatchDetails();
        onRefresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to force verify');
    }
  };

  // Admin Reset
  const handleAdminReset = async () => {
    if (!confirm('Are you sure you want to reset this match to scheduled state? Scores will be cleared.')) return;
    setError(null);
    try {
      const res = await api.post(`/matches/admin/${matchId}/reset`);
      if (res.data.success) {
        setHomeScore('');
        setAwayScore('');
        setHomePens('');
        setAwayPens('');
        await loadMatchDetails();
        onRefresh();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset match');
    }
  };

  // Dispute score submission
  const handleDisputeScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeComment.trim()) {
      setError('Please enter a comment explaining the reason for the dispute.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post(`/matches/${matchId}/dispute`, {
        comment: disputeComment.trim()
      });
      if (res.data.success) {
        setShowDisputeForm(false);
        setDisputeComment('');
        await loadMatchDetails();
        onRefresh();
      } else {
        setError(res.data.error || 'Failed to submit dispute');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit dispute');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Withdraw active dispute
  const handleWithdrawDispute = async () => {
    if (!confirm('Are you sure you want to withdraw this dispute and verify the opponent\'s submitted score?')) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post(`/matches/${matchId}/withdraw-dispute`);
      if (res.data.success) {
        await loadMatchDetails();
        onRefresh();
      } else {
        setError(res.data.error || 'Failed to withdraw dispute');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to withdraw dispute');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Resolve Dispute
  const handleAdminResolveDispute = async (action: 'confirm' | 'reset' | 'override') => {
    if (action === 'reset') {
      if (!confirm('Are you sure you want to reset this match to scheduled state? All scores and events will be deleted.')) return;
    } else if (action === 'confirm') {
      if (!confirm('Are you sure you want to confirm the originally submitted score and events?')) return;
    }

    setError(null);
    setIsSubmitting(true);

    const payload: any = { action, comment: resolutionComment.trim() };

    if (action === 'override') {
      const hs = parseInt(adminHomeScore);
      const as_ = parseInt(adminAwayScore);
      if (isNaN(hs) || isNaN(as_)) {
        setError('Override scores must be valid integers.');
        setIsSubmitting(false);
        return;
      }
      payload.home_score = hs;
      payload.away_score = as_;

      if (hs === as_ && (match.stage === 'pre_qual' || match.stage === 'knockout')) {
        const hp = parseInt(adminHomePens);
        const ap = parseInt(adminAwayPens);
        if (isNaN(hp) || isNaN(ap) || hp === ap) {
          setError('Valid distinct penalty scores are required for draws in this stage.');
          setIsSubmitting(false);
          return;
        }
        payload.home_pens = hp;
        payload.away_pens = ap;
      }

      const flatEvents: Array<{ claim_id: string; player_id: number; event_type: 'goal' | 'assist' }> = [];
      for (const ev of adminEvents) {
        if (!ev.claim_id) continue;
        if (ev.scorer_id) {
          flatEvents.push({
            claim_id: ev.claim_id,
            player_id: ev.scorer_id,
            event_type: 'goal'
          });
        }
        if (ev.assister_id) {
          flatEvents.push({
            claim_id: ev.claim_id,
            player_id: ev.assister_id,
            event_type: 'assist'
          });
        }
      }
      payload.events = flatEvents;
    }

    try {
      const res = await api.post(`/matches/admin/${matchId}/resolve-dispute`, payload);
      if (res.data.success) {
        setResolutionComment('');
        await loadMatchDetails();
        onRefresh();
      } else {
        setError(res.data.error || 'Failed to resolve dispute');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resolve dispute');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStageLabel = () => {
    if (match.stage === 'pre_qual') return 'Pre-Qualification';
    if (match.stage === 'group') return `Group Stage - Group ${match.group_name}`;
    if (match.stage === 'knockout') {
      if (match.round === 1) return 'Final';
      if (match.round === 2) return 'Semi-Final';
      if (match.round === 3) return 'Quarter-Final';
      return `Knockout - Round of ${Math.pow(2, match.round || 1)}`;
    }
    return match.stage;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content match-detail-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div className="match-stage-badge">{getStageLabel()}</div>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Tab Selection */}
        <div className="modal-tabs">
          <button
            className={`modal-tab-btn ${activeTab === 'match' ? 'active' : ''}`}
            onClick={() => setActiveTab('match')}
          >
            Match Details
          </button>
          {(isUserParticipant || isAdmin) && (
            <button
              className={`modal-tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Match Chat
            </button>
          )}
        </div>

        {/* Error Banner */}
        {error && <div className="modal-error-banner">{error}</div>}

        {/* Tab: Match Details */}
        {activeTab === 'match' && (
          <div className="modal-tab-content">
            
            {match.status === 'disputed' && (
              <div className="info-banner-section dispute-banner" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                <h5 style={{ color: '#ef4444', fontWeight: '700', fontSize: '1rem', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span> Match Under Dispute
                </h5>
                <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: '1.4', color: 'rgba(255,255,255,0.75)' }}>
                  A dispute was raised by <strong>{match.dispute?.raised_by_user?.display_name || match.dispute?.raised_by_user?.username || 'the opponent'}</strong>:
                </p>
                <p style={{ margin: '8px 0 0 0', padding: '10px 12px', background: 'rgba(0,0,0,0.2)', borderLeft: '3px solid #ef4444', borderRadius: '4px', fontStyle: 'italic', fontSize: '0.85rem', color: '#fff' }}>
                  "{match.dispute?.comment || 'No reason provided.'}"
                </p>
                <p style={{ margin: '10px 0 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>
                  Please coordinate in the <strong>Match Chat</strong> tab to upload evidence. An admin will arbitrate shortly.
                </p>
                
                {/* Withdraw dispute option for the raiser */}
                {match.dispute?.raised_by === currentUserId && (
                  <button
                    className="btn btn-secondary btn-sm mt-3"
                    style={{ marginTop: '12px', borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: '0.78rem', padding: '6px 12px', cursor: 'pointer' }}
                    onClick={handleWithdrawDispute}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Withdrawing...' : 'Withdraw Dispute & Confirm Original Score'}
                  </button>
                )}
              </div>
            )}

            {/* Scoreboard Graphic */}
            <div className="scoreboard-container">
              {/* Home Team */}
              <div className="scoreboard-team home-team">
                {match.home_claim?.nations?.flag_url ? (
                  <img
                    src={match.home_claim.nations.flag_url}
                    alt=""
                    className="scoreboard-flag"
                  />
                ) : (
                  <div className="scoreboard-flag-placeholder">?</div>
                )}
                <span className="scoreboard-team-name font-bold">
                  {match.home_claim?.nations?.name ?? 'TBD'}
                </span>
                <span className="scoreboard-manager-name">
                  @{match.home_claim?.users?.username ?? 'tbd'}
                </span>
              </div>

              {/* Score Display */}
              <div className="scoreboard-score-area">
                {match.status === 'scheduled' ? (
                  <span className="vs-label">VS</span>
                ) : (
                  <div className="scores-display-column">
                    <span className="scores-text font-mono">
                      {match.home_score} – {match.away_score}
                    </span>
                    {match.home_pens !== null && match.away_pens !== null && (
                      <span className="pens-text font-mono">
                        ({match.home_pens} – {match.away_pens} pens)
                      </span>
                    )}
                  </div>
                )}
                <span className={`status-badge-inline status-${match.status}`}>
                  {match.status.replace('_', ' ')}
                </span>
              </div>

              {/* Away Team */}
              <div className="scoreboard-team away-team">
                {match.away_claim?.nations?.flag_url ? (
                  <img
                    src={match.away_claim.nations.flag_url}
                    alt=""
                    className="scoreboard-flag"
                  />
                ) : (
                  <div className="scoreboard-flag-placeholder">?</div>
                )}
                <span className="scoreboard-team-name font-bold">
                  {match.away_claim?.nations?.name ?? 'TBD'}
                </span>
                <span className="scoreboard-manager-name">
                  @{match.away_claim?.users?.username ?? 'tbd'}
                </span>
              </div>
            </div>

            {/* Screenshot proof and events display for pending/verified matches */}
            {(match.screenshot_url || (match.events && match.events.length > 0)) && (
              <div className="action-form-section" style={{ marginTop: '16px' }}>
                <h5>Match Submission Details</h5>
                {match.screenshot_url && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '6px' }}>Uploaded Screenshot Proof:</p>
                    <a href={match.screenshot_url} target="_blank" rel="noopener noreferrer">
                      <img src={match.screenshot_url} alt="Proof" style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'zoom-in' }} />
                    </a>
                  </div>
                )}
                {match.events && match.events.length > 0 && (() => {
                  const pairedEvents: Array<{
                    id: string;
                    goal: any;
                    assist: any | null;
                  }> = [];

                  // Group by claim_id to align scorer and assister from the same team
                  const teamIds = Array.from(new Set(match.events.map((e: any) => e.claim_id)));

                  for (const teamId of teamIds) {
                    const teamGoals = match.events.filter((e: any) => e.claim_id === teamId && e.event_type === 'goal');
                    const teamAssists = match.events.filter((e: any) => e.claim_id === teamId && e.event_type === 'assist');
                    const maxCount = Math.max(teamGoals.length, teamAssists.length);
                    for (let i = 0; i < maxCount; i++) {
                      const goal = teamGoals[i];
                      const assist = teamAssists[i];
                      pairedEvents.push({
                        id: goal?.id || assist?.id || `${teamId}-${i}`,
                        goal: goal || null,
                        assist: assist || null,
                      });
                    }
                  }

                  return (
                    <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '10px' }}>Match Events</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {pairedEvents.map(({ id, goal, assist }) => {
                          if (goal) {
                            return (
                              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                                <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '600' }}>{goal.player?.name || 'Unknown'}</span>
                                {assist && (
                                  <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: '0.8rem', fontWeight: '500' }}>
                                    ({assist.player?.name || 'Unknown'})
                                  </span>
                                )}
                              </div>
                            );
                          } else {
                            return (
                              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(129,140,248,0.7)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z"/><path d="M12 3c-1.5 2-2.5 5-2.5 9s1 7 2.5 9"/><path d="M12 3c1.5 2 2.5 5 2.5 9s-1 7-2.5 9"/><path d="M3 12h18"/></svg>
                                <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '600' }}>{assist.player?.name || 'Unknown'}</span>
                              </div>
                            );
                          }
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Submit Score Form */}
            {showSubmitForm && (
              <div className="action-form-section">
                <h5>Submit Match Score</h5>
                <form onSubmit={handleSubmitScore} className="submit-score-form">
                  <div className="score-inputs-row">
                    <div className="form-group flex-1">
                      <label>
                        {match.home_claim?.nations?.name ?? 'Home'} Score
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-input text-center font-mono font-bold"
                        value={homeScore}
                        onChange={(e) => setHomeScore(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="form-group flex-1">
                      <label>
                        {match.away_claim?.nations?.name ?? 'Away'} Score
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="form-input text-center font-mono font-bold"
                        value={awayScore}
                        onChange={(e) => setAwayScore(e.target.value)}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  {/* Draw - Penalties input */}
                  {homeScore !== '' &&
                    awayScore !== '' &&
                    homeScore === awayScore &&
                    (match.stage === 'pre_qual' || match.stage === 'knockout') && (
                      <div className="penalties-input-section animate-slide-down">
                        <p className="hint-text text-warning font-semibold">
                          ⚡ Draws not allowed in this stage. Enter penalty shootout score:
                        </p>
                        <div className="score-inputs-row">
                          <div className="form-group flex-1">
                            <label>Home Penalties Scored</label>
                            <input
                              type="number"
                              min="0"
                              className="form-input text-center font-mono font-bold"
                              value={homePens}
                              onChange={(e) => setHomePens(e.target.value)}
                              required
                              disabled={isSubmitting}
                            />
                          </div>
                          <div className="form-group flex-1">
                            <label>Away Penalties Scored</label>
                            <input
                              type="number"
                              min="0"
                              className="form-input text-center font-mono font-bold"
                              value={awayPens}
                              onChange={(e) => setAwayPens(e.target.value)}
                              required
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Result Screenshot Proof */}
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.82rem', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                      Screenshot Proof <span style={{ color: '#ef4444' }}>*</span>
                    </label>

                    {/* Hidden native input */}
                    <input
                      id="screenshot-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={isSubmitting || isUploading}
                      style={{ display: 'none' }}
                    />

                    {/* Custom styled drop zone */}
                    <label
                      htmlFor="screenshot-upload"
                      className={`file-upload-zone${screenshotUrl ? ' file-upload-zone--done' : ''}${isUploading ? ' file-upload-zone--loading' : ''}`}
                    >
                      {isUploading ? (
                        <>
                          <div className="file-upload-zone__icon">
                            <div className="loading-spinner" style={{ width: '18px', height: '18px' }} />
                          </div>
                          <span className="file-upload-zone__text">Uploading…</span>
                        </>
                      ) : screenshotUrl ? (
                        <>
                          <div className="file-upload-zone__preview">
                            <img src={screenshotUrl} alt="Proof preview" />
                          </div>
                          <div className="file-upload-zone__meta">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            <span style={{ color: '#34d399', fontSize: '0.82rem', fontWeight: '600' }}>Uploaded — tap to replace</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="file-upload-zone__icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                              <circle cx="9" cy="9" r="2" />
                              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                            </svg>
                          </div>
                          <span className="file-upload-zone__text">Attach screenshot proof</span>
                          <span className="file-upload-zone__hint">JPG, PNG or WebP · max 5 MB</span>
                        </>
                      )}
                    </label>
                  </div>

                  {/* Match Events (Goals) */}
                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.82rem', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                      Goals
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {events.map((event, index) => {
                        const squadPlayers = event.claim_id === match.home_claim_id ? homeSquadPlayers : awaySquadPlayers;
                        return (
                          <div key={index} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Row 1: Team picker + remove */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <select
                                value={event.claim_id}
                                onChange={(e) => {
                                  const updated = [...events];
                                  updated[index] = { ...updated[index], claim_id: e.target.value, scorer_id: 0, assister_id: null };
                                  setEvents(updated);
                                }}
                                className="form-input"
                                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.875rem' }}
                              >
                                <option value="">Select team</option>
                                {match.home_claim && <option value={match.home_claim_id}>{match.home_claim.nations?.name}</option>}
                                {match.away_claim && <option value={match.away_claim_id}>{match.away_claim.nations?.name}</option>}
                              </select>
                              <button
                                type="button"
                                onClick={() => setEvents(events.filter((_, i) => i !== index))}
                                style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                              </button>
                            </div>

                            {/* Row 2: Scorer + Assister selects */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div>
                                <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Scorer</p>
                                <select
                                  value={event.scorer_id || ''}
                                  onChange={(e) => {
                                    const updated = [...events];
                                    updated[index] = { ...updated[index], scorer_id: parseInt(e.target.value) || 0 };
                                    setEvents(updated);
                                  }}
                                  className="form-input"
                                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.875rem' }}
                                  disabled={!event.claim_id}
                                >
                                  <option value="">Select scorer</option>
                                  {squadPlayers.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.overall})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Assist <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: '400' }}>(optional)</span></p>
                                <select
                                  value={event.assister_id || ''}
                                  onChange={(e) => {
                                    const updated = [...events];
                                    updated[index] = { ...updated[index], assister_id: parseInt(e.target.value) || null };
                                    setEvents(updated);
                                  }}
                                  className="form-input"
                                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.875rem' }}
                                  disabled={!event.claim_id}
                                >
                                  <option value="">None</option>
                                  {squadPlayers.filter((p: any) => p.id !== event.scorer_id).map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.overall})</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEvents([...events, { claim_id: '', scorer_id: 0, assister_id: null }])}
                      style={{ marginTop: '8px', width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px dashed rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' }}
                      onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; }}
                      onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'; }}
                    >
                      + Add Goal
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-full mt-4"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Score'}
                  </button>
                </form>
              </div>
            )}

            {/* Waiting for confirmation */}
            {showWaitingBox && (
              <div className="info-banner-section waiting-banner">
                <h5>Score Submitted</h5>
                <p>
                  You submitted the score: <strong>{match.home_score} – {match.away_score}</strong>.
                  Waiting for your opponent to confirm or raise a dispute.
                </p>
              </div>
            )}

            {/* Confirm Score Actions */}
            {showConfirmationBox && (
              <div className="action-form-section confirmation-section">
                <h5>Verify Score</h5>
                {showDisputeForm ? (
                  <form onSubmit={handleDisputeScore} className="mt-4">
                    <p className="subtitle">
                      Explain the reason for disputing the submitted score of <strong>{match.home_score} – {match.away_score}</strong>:
                    </p>
                    <div className="form-group mt-2">
                      <textarea
                        className="form-input"
                        style={{ width: '100%', minHeight: '80px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '10px', borderRadius: '6px', fontSize: '0.875rem', resize: 'vertical' }}
                        placeholder="e.g. The opponent submitted an incorrect score, or uploaded the wrong screenshot..."
                        value={disputeComment}
                        onChange={(e) => setDisputeComment(e.target.value)}
                        required
                        maxLength={500}
                      />
                    </div>
                    <div className="drawer-actions mt-4">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setShowDisputeForm(false); setDisputeComment(''); }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-danger btn-sm"
                        style={{ background: '#ef4444', borderColor: '#ef4444', color: '#fff' }}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Submitting Dispute...' : 'File Dispute'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <p className="subtitle">
                      Opponent submitted score: <strong>{match.home_score} – {match.away_score}</strong>
                      {match.home_pens !== null && (
                        <span> ({match.home_pens} – {match.away_pens} pens)</span>
                      )}
                      . Please verify if this matches your played game result.
                    </p>
                    <div className="drawer-actions mt-4">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowDisputeForm(true)}
                        disabled={isSubmitting}
                      >
                        Dispute Score
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={handleConfirmScore}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 'Confirming...' : 'Confirm Score'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Admin Override & Arbitration Section */}
            {isAdmin && (
              <div className="admin-actions-section mt-8 pt-6 border-t" style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {match.status === 'disputed' ? (
                  <>
                    <h5 style={{ color: '#fbbf24', fontWeight: '700', fontSize: '1rem', marginBottom: '8px' }}>Admin Dispute Arbitration</h5>
                    <p className="subtitle" style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: '16px' }}>
                      Review evidence, discuss with participants in chat, and resolve the dispute.
                    </p>

                    <div className="form-group mb-4" style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px', color: 'rgba(255,255,255,0.8)' }}>
                        Resolution Comments (Will be logged on the dispute record)
                      </label>
                      <textarea
                        className="form-input"
                        style={{ width: '100%', minHeight: '60px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px', borderRadius: '6px', fontSize: '0.85rem' }}
                        placeholder="e.g. Discussed in chat, corrected home score, or confirmed submitted score..."
                        value={resolutionComment}
                        onChange={(e) => setResolutionComment(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className="drawer-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm flex-1"
                          onClick={() => handleAdminResolveDispute('confirm')}
                          disabled={isSubmitting}
                        >
                          Confirm Submitted Score
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm flex-1"
                          style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444', background: 'transparent' }}
                          onClick={() => handleAdminResolveDispute('reset')}
                          disabled={isSubmitting}
                        >
                          Reset Match (Wipe & Replay)
                        </button>
                      </div>

                      <div style={{ border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', padding: '14px', background: 'rgba(255,255,255,0.01)', marginTop: '6px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fbbf24', display: 'block', marginBottom: '12px' }}>
                          Option 3: Override Score & Player Stats
                        </span>

                        <div className="score-inputs-row">
                          <div className="form-group flex-1">
                            <label>Override Home Score</label>
                            <input
                              type="number"
                              min="0"
                              className="form-input text-center font-mono"
                              placeholder="0"
                              value={adminHomeScore}
                              onChange={(e) => setAdminHomeScore(e.target.value)}
                            />
                          </div>
                          <div className="form-group flex-1">
                            <label>Override Away Score</label>
                            <input
                              type="number"
                              min="0"
                              className="form-input text-center font-mono"
                              placeholder="0"
                              value={adminAwayScore}
                              onChange={(e) => setAdminAwayScore(e.target.value)}
                            />
                          </div>
                        </div>

                        {adminHomeScore !== '' &&
                          adminAwayScore !== '' &&
                          adminHomeScore === adminAwayScore &&
                          (match.stage === 'pre_qual' || match.stage === 'knockout') && (
                            <div className="score-inputs-row mt-2" style={{ marginTop: '8px' }}>
                              <div className="form-group flex-1">
                                <label>Home Pens</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-input text-center font-mono"
                                  value={adminHomePens}
                                  onChange={(e) => setAdminHomePens(e.target.value)}
                                />
                              </div>
                              <div className="form-group flex-1">
                                <label>Away Pens</label>
                                <input
                                  type="number"
                                  min="0"
                                  className="form-input text-center font-mono"
                                  value={adminAwayPens}
                                  onChange={(e) => setAdminAwayPens(e.target.value)}
                                />
                              </div>
                            </div>
                          )}

                               <div className="form-group mt-4" style={{ marginTop: '12px' }}>
                          <label className="block text-sm font-semibold mb-2" style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
                            Goals & Assists
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {adminEvents.map((event, index) => {
                              const squadPlayers = event.claim_id === match.home_claim_id ? homeSquadPlayers : awaySquadPlayers;
                              return (
                                <div key={index} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {/* Row 1: Team picker + remove */}
                                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <select
                                      value={event.claim_id}
                                      onChange={(e) => {
                                        const updated = [...adminEvents];
                                        updated[index] = { ...updated[index], claim_id: e.target.value, scorer_id: 0, assister_id: null };
                                        setAdminEvents(updated);
                                      }}
                                      className="form-input"
                                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.875rem' }}
                                    >
                                      <option value="">Select team</option>
                                      {match.home_claim && <option value={match.home_claim_id}>{match.home_claim.nations?.name} (Home)</option>}
                                      {match.away_claim && <option value={match.away_claim_id}>{match.away_claim.nations?.name} (Away)</option>}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => setAdminEvents(adminEvents.filter((_, i) => i !== index))}
                                      style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                    </button>
                                  </div>

                                  {/* Row 2: Scorer + Assister selects */}
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                      <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Scorer</p>
                                      <select
                                        value={event.scorer_id || ''}
                                        onChange={(e) => {
                                          const updated = [...adminEvents];
                                          updated[index] = { ...updated[index], scorer_id: parseInt(e.target.value) || 0 };
                                          setAdminEvents(updated);
                                        }}
                                        className="form-input"
                                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.875rem' }}
                                        disabled={!event.claim_id}
                                      >
                                        <option value="">Select scorer</option>
                                        {squadPlayers.map((p: any) => (
                                          <option key={p.id} value={p.id}>{p.name} ({p.overall})</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div>
                                      <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Assist <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: '400' }}>(optional)</span></p>
                                      <select
                                        value={event.assister_id || ''}
                                        onChange={(e) => {
                                          const updated = [...adminEvents];
                                          updated[index] = { ...updated[index], assister_id: parseInt(e.target.value) || null };
                                          setAdminEvents(updated);
                                        }}
                                        className="form-input"
                                        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.875rem' }}
                                        disabled={!event.claim_id}
                                      >
                                        <option value="">None</option>
                                        {squadPlayers.filter((p: any) => p.id !== event.scorer_id).map((p: any) => (
                                          <option key={p.id} value={p.id}>{p.name} ({p.overall})</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => setAdminEvents([...adminEvents, { claim_id: '', scorer_id: 0, assister_id: null }])}
                            style={{ marginTop: '8px', width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px dashed rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' }}
                            onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; }}
                            onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'; }}
                          >
                            + Add Goal Override
                          </button>
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary w-full mt-4"
                          style={{ marginTop: '16px', width: '100%', background: '#fbbf24', borderColor: '#fbbf24', color: '#000' }}
                          onClick={() => handleAdminResolveDispute('override')}
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? 'Submitting Override...' : 'Apply Score Override & Resolve'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h5 className="text-warning">Admin Override Panel</h5>
                    
                    <form onSubmit={handleAdminVerify} className="submit-score-form mt-4">
                      <div className="score-inputs-row">
                        <div className="form-group flex-1">
                          <label>Force Home Score</label>
                          <input
                            type="number"
                            min="0"
                            className="form-input text-center font-mono"
                            placeholder={match.home_score?.toString() || '0'}
                            value={adminHomeScore}
                            onChange={(e) => setAdminHomeScore(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group flex-1">
                          <label>Force Away Score</label>
                          <input
                            type="number"
                            min="0"
                            className="form-input text-center font-mono"
                            placeholder={match.away_score?.toString() || '0'}
                            value={adminAwayScore}
                            onChange={(e) => setAdminAwayScore(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      {adminHomeScore !== '' &&
                        adminAwayScore !== '' &&
                        adminHomeScore === adminAwayScore &&
                        (match.stage === 'pre_qual' || match.stage === 'knockout') && (
                          <div className="score-inputs-row mt-2">
                            <div className="form-group flex-1">
                              <label>Home Pens</label>
                              <input
                                type="number"
                                min="0"
                                className="form-input text-center font-mono"
                                value={adminHomePens}
                                onChange={(e) => setAdminHomePens(e.target.value)}
                                required
                              />
                            </div>
                            <div className="form-group flex-1">
                              <label>Away Pens</label>
                              <input
                                type="number"
                                min="0"
                                className="form-input text-center font-mono"
                                value={adminAwayPens}
                                onChange={(e) => setAdminAwayPens(e.target.value)}
                                required
                              />
                            </div>
                          </div>
                        )}

                      {/* Admin Match Events */}
                      <div className="form-group mt-4" style={{ marginTop: '16px' }}>
                        <label className="block text-sm font-semibold mb-2" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '600', color: '#fbbf24' }}>
                          Force Registered Goals & Assists
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {adminEvents.map((event, index) => {
                            const squadPlayers = event.claim_id === match.home_claim_id ? homeSquadPlayers : awaySquadPlayers;
                            return (
                              <div key={index} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {/* Row 1: Team picker + remove */}
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <select
                                    value={event.claim_id}
                                    onChange={(e) => {
                                      const updated = [...adminEvents];
                                      updated[index] = { ...updated[index], claim_id: e.target.value, scorer_id: 0, assister_id: null };
                                      setAdminEvents(updated);
                                    }}
                                    className="form-input"
                                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.875rem' }}
                                  >
                                    <option value="">Select team</option>
                                    {match.home_claim && <option value={match.home_claim_id}>{match.home_claim.nations?.name} (Home)</option>}
                                    {match.away_claim && <option value={match.away_claim_id}>{match.away_claim.nations?.name} (Away)</option>}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => setAdminEvents(adminEvents.filter((_, i) => i !== index))}
                                    style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                  </button>
                                </div>

                                {/* Row 2: Scorer + Assister selects */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  <div>
                                    <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Scorer</p>
                                    <select
                                      value={event.scorer_id || ''}
                                      onChange={(e) => {
                                        const updated = [...adminEvents];
                                        updated[index] = { ...updated[index], scorer_id: parseInt(e.target.value) || 0 };
                                        setAdminEvents(updated);
                                      }}
                                      className="form-input"
                                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.875rem' }}
                                      disabled={!event.claim_id}
                                    >
                                      <option value="">Select scorer</option>
                                      {squadPlayers.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.overall})</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <p style={{ margin: '0 0 4px', fontSize: '0.72rem', fontWeight: '600', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Assist <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: '400' }}>(optional)</span></p>
                                    <select
                                      value={event.assister_id || ''}
                                      onChange={(e) => {
                                        const updated = [...adminEvents];
                                        updated[index] = { ...updated[index], assister_id: parseInt(e.target.value) || null };
                                        setAdminEvents(updated);
                                      }}
                                      className="form-input"
                                      style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 10px', borderRadius: '8px', fontSize: '0.875rem' }}
                                      disabled={!event.claim_id}
                                    >
                                      <option value="">None</option>
                                      {squadPlayers.filter((p: any) => p.id !== event.scorer_id).map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.overall})</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => setAdminEvents([...adminEvents, { claim_id: '', scorer_id: 0, assister_id: null }])}
                          style={{ marginTop: '8px', width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px dashed rgba(255,255,255,0.12)', background: 'transparent', color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' }}
                          onMouseOver={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.7)'; }}
                          onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'; }}
                        >
                          + Add Goal Override
                        </button>
                      </div>

                      <div className="flex gap-4 mt-4">
                        <button
                          type="button"
                          className="btn btn-secondary flex-1"
                          onClick={handleAdminReset}
                        >
                          Reset Match State
                        </button>
                        <button type="submit" className="btn btn-primary flex-1">
                          Force Verify Match
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            )}

          </div>
        )}

        {/* Tab: Match Chat */}
        {activeTab === 'chat' && (
          <div className="modal-tab-content chat-tab-content">
            
            {/* Messages Area */}
            <div className="chat-messages-container">
              {messages.length === 0 ? (
                <div className="empty-chat-state">
                  <span className="muted-text">Coordinate your game schedule and verify scores here. Only match participants and admin can see this chat.</span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === currentUserId;
                  const senderName = msg.users?.display_name || 'Anonymous';
                  return (
                    <div
                      key={msg.id}
                      className={`chat-message-bubble-wrapper ${
                        isOwn ? 'own-bubble' : 'other-bubble'
                      }`}
                    >
                      <div className="chat-message-bubble">
                        {!isOwn && (
                          <span className="chat-sender-label">{senderName}</span>
                        )}
                        <p className="chat-message-body">{msg.body}</p>
                        {msg.attachment_url && (
                          <div className="chat-message-attachment" style={{ marginTop: '6px', marginBottom: '4px' }}>
                            <img
                              src={msg.attachment_url}
                              alt="Attachment"
                              style={{ maxWidth: '180px', maxHeight: '180px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'block' }}
                              onClick={() => window.open(msg.attachment_url, '_blank')}
                            />
                          </div>
                        )}
                        <span className="chat-timestamp">
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Attachment preview if uploaded */}
            {chatAttachmentUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
                <span style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontSize: '0.65rem', fontWeight: '700', letterSpacing: '0.05em' }}>Attachment:</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px', color: '#10b981' }}>{chatAttachmentUrl.split('/').pop()}</span>
                <button
                  type="button"
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 4px', fontSize: '0.9rem' }}
                  onClick={() => setChatAttachmentUrl('')}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Send box */}
            <form onSubmit={handleSendMessage} className="chat-input-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {match?.status === 'disputed' && (
                <div className="chat-file-upload-wrapper" style={{ position: 'relative' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: isUploadingChat ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      color: chatAttachmentUrl ? '#10b981' : 'rgba(255, 255, 255, 0.6)'
                    }}
                    title="Upload proof/image"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleChatFileChange}
                      disabled={isUploadingChat}
                    />
                    {isUploadingChat ? (
                      <span className="spinner-loader" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    ) : (
                      <span style={{ fontSize: '1rem', fontWeight: '700' }}>📎</span>
                    )}
                  </label>
                </div>
              )}
              <input
                type="text"
                placeholder="Type a message..."
                className="form-input chat-input-field"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={1000}
                required={!chatAttachmentUrl}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary btn-sm chat-send-btn" disabled={isUploadingChat}>
                Send
              </button>
            </form>

          </div>
        )}

      </div>
    </div>
  );
}
