import { useState } from 'react';

interface StandingRow {
  claim_id: string;
  position: number;
  nation_name: string;
  flag_url: string | null;
  display_name: string;
  username: string;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  Pts: number;
  matches_played: number;
}

interface GroupStandingsTableProps {
  groupName: string;
  standings: StandingRow[];
  userClaimId?: string;
  isPrequal?: boolean;
}

export default function GroupStandingsTable({
  groupName,
  standings,
  userClaimId,
  isPrequal = false,
}: GroupStandingsTableProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="standings-table-container">
      <div className="standings-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>{isPrequal ? `Pre-Qual: ${groupName}` : `Group ${groupName}`}</h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="btn btn-secondary btn-sm mobile-only-inline"
          style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '12px' }}
        >
          {isExpanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      <div className="table-responsive">
        <table className={`standings-table ${isExpanded ? 'expanded' : 'collapsed'}`}>
          <thead>
            <tr>
              <th className="col-pos">Pos</th>
              <th className="col-team">Team / Manager</th>
              <th className="col-num">P</th>
              <th className="col-num col-detail">W</th>
              <th className="col-num col-detail">D</th>
              <th className="col-num col-detail">L</th>
              <th className="col-num col-detail">GF</th>
              <th className="col-num col-detail">GA</th>
              <th className="col-num col-detail">GD</th>
              <th className="col-num col-pts">Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => {
              const isCurrentUser = userClaimId === row.claim_id;
              // In main group stage, top 2 qualify. In prequal mini-group, top 1 qualifies.
              const isQualifyingZone = isPrequal ? row.position === 1 : row.position <= 2;

              return (
                <tr
                  key={row.claim_id}
                  className={`standing-row ${isCurrentUser ? 'current-user-row' : ''} ${
                    isQualifyingZone ? 'qualifying-row' : 'eliminating-row'
                  }`}
                >
                  <td className="col-pos">
                    <span className={`pos-number ${isQualifyingZone ? 'pos-qualify' : 'pos-eliminate'}`}>
                      {row.position}
                    </span>
                  </td>
                  <td className="col-team">
                    <div className="team-cell-info">
                      {row.flag_url && (
                        <img src={row.flag_url} alt={row.nation_name} className="standing-flag" />
                      )}
                      <div className="standing-names">
                        {isPrequal ? (
                          <span className="standing-nation-name">{row.display_name}</span>
                        ) : (
                          <>
                            <span className="standing-nation-name">{row.nation_name}</span>
                            <span className="standing-manager-name">
                              {row.display_name} <span className="standing-username">@{row.username}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="col-num">{row.matches_played}</td>
                  <td className="col-num col-detail">{row.W}</td>
                  <td className="col-num col-detail">{row.D}</td>
                  <td className="col-num col-detail">{row.L}</td>
                  <td className="col-num col-detail">{row.GF}</td>
                  <td className="col-num col-detail">{row.GA}</td>
                  <td className="col-num col-detail font-mono">
                    {row.GD > 0 ? `+${row.GD}` : row.GD}
                  </td>
                  <td className="col-num col-pts font-bold">{row.Pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
