import { useState } from 'react';

interface MatchInfo {
  id: string;
  stage: string;
  round: number | null;
  bracket_slot: number | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_pens: number | null;
  away_pens: number | null;
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

interface KnockoutBracketProps {
  matches: MatchInfo[];
  userClaimId?: string;
  onMatchClick: (matchId: string) => void;
}

export default function KnockoutBracket({
  matches,
  userClaimId,
  onMatchClick,
}: KnockoutBracketProps) {
  const [isMini, setIsMini] = useState(true);

  // Filter and sort knockout matches
  const koMatches = matches.filter((m) => m.stage === 'knockout');

  if (koMatches.length === 0) {
    return <div className="no-bracket-data">No bracket generated yet.</div>;
  }

  // Find max round to know the size of the tree (e.g. 3 = Quarters, 2 = Semis, 1 = Final)
  const maxRound = Math.max(...koMatches.map((m) => m.round ?? 1), 1);

  // Helper to find match by round and slot
  const findMatch = (round: number, slot: number) => {
    return koMatches.find((m) => m.round === round && m.bracket_slot === slot);
  };

  // Helper to render a match card
  const renderMatchCard = (round: number, slot: number) => {
    const match = findMatch(round, slot);
    if (!match) {
      return (
        <div className="bracket-match-card empty-slot">
          <span className="muted-text">TBD</span>
        </div>
      );
    }

    if (match.is_bye) {
      const activeClaim = match.home_claim;
      const isUser = activeClaim && userClaimId === activeClaim.id;

      return (
        <div className="bracket-match-card bye-card">
          <div className={`bracket-team-row ${isUser ? 'highlight-user' : ''}`}>
            {activeClaim?.nations?.flag_url && (
              <img src={activeClaim.nations.flag_url} alt="" className="bracket-flag" />
            )}
            <span className="bracket-team-name font-bold truncate">
              {activeClaim?.nations?.name ?? 'Unknown'}
              {activeClaim?.users?.username && (
                <span className="bracket-username"> @{activeClaim.users.username}</span>
              )}
            </span>
            <span className="bye-badge">BYE</span>
          </div>
        </div>
      );
    }

    const home = match.home_claim;
    const away = match.away_claim;
    const isHomeUser = home && userClaimId === home.id;
    const isAwayUser = away && userClaimId === away.id;

    // Check winner if verified
    const isVerified = match.status === 'verified';
    const hs = match.home_score ?? 0;
    const as_ = match.away_score ?? 0;
    
    let isHomeWinner = false;
    let isAwayWinner = false;

    if (isVerified) {
      if (hs > as_) {
        isHomeWinner = true;
      } else if (as_ > hs) {
        isAwayWinner = true;
      } else if (match.home_pens != null && match.away_pens != null) {
        if (match.home_pens > match.away_pens) isHomeWinner = true;
        else isAwayWinner = true;
      }
    }

    return (
      <div
        className={`bracket-match-card clickable status-${match.status}`}
        onClick={() => onMatchClick(match.id)}
      >
        {/* Home Team */}
        <div
          className={`bracket-team-row ${isHomeUser ? 'highlight-user' : ''} ${
            isVerified && !isHomeWinner ? 'muted' : ''
          }`}
        >
          {home?.nations?.flag_url ? (
            <img src={home.nations.flag_url} alt="" className="bracket-flag" />
          ) : (
            <div className="bracket-flag-placeholder" />
          )}
          <span className="bracket-team-name truncate">
            {home?.nations?.name ?? 'TBD'}
            {home?.users?.username && (
              <span className="bracket-username"> @{home.users.username}</span>
            )}
          </span>
          <span className="bracket-score">
            {match.home_score !== null ? hs : ''}
            {isVerified && hs === as_ && match.home_pens != null && (
              <span className="bracket-pens-score">({match.home_pens})</span>
            )}
          </span>
        </div>

        {/* Divider */}
        <div className="bracket-card-divider" />

        {/* Away Team */}
        <div
          className={`bracket-team-row ${isAwayUser ? 'highlight-user' : ''} ${
            isVerified && !isAwayWinner ? 'muted' : ''
          }`}
        >
          {away?.nations?.flag_url ? (
            <img src={away.nations.flag_url} alt="" className="bracket-flag" />
          ) : (
            <div className="bracket-flag-placeholder" />
          )}
          <span className="bracket-team-name truncate">
            {away?.nations?.name ?? 'TBD'}
            {away?.users?.username && (
              <span className="bracket-username"> @{away.users.username}</span>
            )}
          </span>
          <span className="bracket-score">
            {match.away_score !== null ? as_ : ''}
            {isVerified && hs === as_ && match.away_pens != null && (
              <span className="bracket-pens-score">({match.away_pens})</span>
            )}
          </span>
        </div>

        {/* Hover overlay/status indicator */}
        <div className="bracket-card-status-indicator" />
      </div>
    );
  };

  // Render a 2-sided bracket layout
  return (
    <div className="bracket-card-wrapper">
      <div className="bracket-controls">
        <button
          onClick={() => setIsMini(!isMini)}
          className="bracket-toggle-btn"
        >
          {isMini ? (
            <>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              <span>Expand Bracket</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" />
              </svg>
              <span>Miniature View</span>
            </>
          )}
        </button>
      </div>

      <div className={`bracket-outer-wrapper ${isMini ? 'bracket-mini' : 'bracket-full'}`}>
        <div className={`bracket-tree-container ${maxRound >= 3 ? 'has-quarters' : ''}`}>
        
        {/* Left Side: Quarter Finals (Slots 1 & 3) -> Semi Final (Slot 1) */}
        {maxRound >= 3 && (
          <div className="bracket-column left-quarters">
            <div className="bracket-round-label">Quarter-Finals</div>
            <div className="bracket-matches-flex">
              <div className="bracket-match-group connect-right">
                {renderMatchCard(3, 1)}
                {renderMatchCard(3, 3)}
              </div>
            </div>
          </div>
        )}

        {maxRound >= 2 && (
          <div className="bracket-column left-semis">
            <div className="bracket-round-label">Semi-Finals</div>
            <div className="bracket-matches-flex">
              <div className="bracket-match-group connect-right-single">
                {renderMatchCard(2, 1)}
              </div>
            </div>
          </div>
        )}

        {/* Center: The Final (Round 1, Slot 1) */}
        <div className="bracket-column center-column">
          <div className="bracket-round-label">Final</div>
          <div className="bracket-matches-flex center-flex">
            <div className="final-wrapper">
              <div className="trophy-display">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--warning)" strokeWidth="2">
                  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                  <path d="M4 22h16" />
                  <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
                  <path d="M12 2a8 8 0 0 0-8 8h16a8 8 0 0 0-8-8z" />
                </svg>
              </div>
              {renderMatchCard(1, 1)}
            </div>
          </div>
        </div>

        {/* Right Side: Semi Final (Slot 2) -> Quarter Finals (Slots 2 & 4) */}
        {maxRound >= 2 && (
          <div className="bracket-column right-semis">
            <div className="bracket-round-label">Semi-Finals</div>
            <div className="bracket-matches-flex">
              <div className="bracket-match-group connect-left-single">
                {renderMatchCard(2, 2)}
              </div>
            </div>
          </div>
        )}

        {maxRound >= 3 && (
          <div className="bracket-column right-quarters">
            <div className="bracket-round-label">Quarter-Finals</div>
            <div className="bracket-matches-flex">
              <div className="bracket-match-group connect-left">
                {renderMatchCard(3, 2)}
                {renderMatchCard(3, 4)}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  </div>
  );
}
