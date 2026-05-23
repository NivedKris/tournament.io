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
  home_claim: ClaimInfo | null;
  away_claim: ClaimInfo | null;
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

  // Admin form state
  const [adminHomeScore, setAdminHomeScore] = useState('');
  const [adminAwayScore, setAdminAwayScore] = useState('');
  const [adminHomePens, setAdminHomePens] = useState('');
  const [adminAwayPens, setAdminAwayPens] = useState('');

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

  // Chat polling (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      loadMessages();
    }, 3000);
    return () => clearInterval(interval);
  }, [matchId]);

  // Scroll to bottom on new messages or tab switch
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

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

    const payload: any = { home_score: hs, away_score: as_ };

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
      const res = await api.post(`/matches/${matchId}/messages`, {
        body: chatInput.trim(),
      });
      if (res.data.success) {
        setMessages((prev) => [...prev, res.data.data]);
        setChatInput('');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
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

    const payload: any = { home_score: hs, away_score: as_ };
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
                    onClick={() => alert('Dispute feature will be implemented in Phase 4.')}
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
              </div>
            )}

            {/* Admin Override Section */}
            {isAdmin && (
              <div className="admin-actions-section mt-8 pt-6 border-t">
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

            {/* Send box */}
            <form onSubmit={handleSendMessage} className="chat-input-bar">
              <input
                type="text"
                placeholder="Type a message..."
                className="form-input chat-input-field"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={1000}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm chat-send-btn">
                Send
              </button>
            </form>

          </div>
        )}

      </div>
    </div>
  );
}
