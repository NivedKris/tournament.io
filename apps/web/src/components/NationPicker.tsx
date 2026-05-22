import { useState } from 'react';
import api from '../lib/api';

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

interface NationPickerProps {
  nations: Nation[];
  onClaimSuccess: () => void;
}

export default function NationPicker({ nations, onClaimSuccess }: NationPickerProps) {
  const [search, setSearch] = useState('');
  const [selectedNation, setSelectedNation] = useState<Nation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredNations = nations.filter((n) =>
    n.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleClaim = async () => {
    if (!selectedNation) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.post('/tournament/claim', {
        nation_id: selectedNation.id,
      });

      if (response.data.success) {
        onClaimSuccess();
      } else {
        setError(response.data.error || 'Failed to submit claim');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="nation-picker-container">
      <div className="picker-header">
        <h2>Choose Your Team</h2>
        <p className="subtitle">Select the nation or club you want to represent in this tournament.</p>
        
        <input
          type="text"
          placeholder="Search teams..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="nations-grid">
        {filteredNations.map((nation) => {
          const isSelected = selectedNation?.id === nation.id;
          const claimsCount = nation.claims?.length || 0;

          return (
            <div
              key={nation.id}
              onClick={() => setSelectedNation(nation)}
              className={`nation-card ${isSelected ? 'selected' : ''}`}
            >
              <div className="flag-wrapper">
                {nation.flag_url ? (
                  <img
                    src={nation.flag_url}
                    alt={nation.name}
                    className="flag-img"
                    onError={(e) => {
                      // Fallback if flag cdn fails
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flag-placeholder">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="nation-info">
                <span className="nation-name">{nation.name}</span>
                {claimsCount > 0 ? (
                  <span className="claimants-badge">
                    {claimsCount} {claimsCount === 1 ? 'Claim' : 'Claims'}
                  </span>
                ) : (
                  <span className="available-badge">Available</span>
                )}
              </div>

              {claimsCount > 0 && (
                <div className="claimants-list">
                  {nation.claims.map((c) => (
                    <span key={c.id} className="claimant-name">
                      @{c.username}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Drawer/Modal */}
      {selectedNation && (
        <div className="claim-confirmation-drawer">
          <div className="drawer-content">
            <div className="drawer-text">
              <span>Representing</span>
              <h3>{selectedNation.name}</h3>
            </div>
            
            <div className="drawer-actions">
              {error && <span className="drawer-error">{error}</span>}
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedNation(null)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleClaim}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Claiming...' : 'Confirm Claim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
