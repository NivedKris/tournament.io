import { useState, useEffect } from 'react';
import api from '../lib/api';

interface PlayerInfo {
  id: number;
  name: string;
  image_url: string | null;
  overall: number;
}

interface ClaimInfo {
  id: string;
  nations: { id: string; name: string; flag_url: string | null };
  users: { id: string; username: string; display_name: string };
}

interface StatRow {
  player: PlayerInfo;
  claim: ClaimInfo;
  count: number;
}

interface GoalkeeperRow {
  player: PlayerInfo;
  claim: ClaimInfo;
  cleanSheets: number;
  goalsConceded: number;
  matchesPlayed: number;
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconBoot({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20h20" />
      <path d="M6 20V10l4-6h4l2 4-3 2v10" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function IconAssist({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z" />
      <path d="M12 3c-1.5 2-2.5 5-2.5 9s1 7 2.5 9" />
      <path d="M12 3c1.5 2 2.5 5 2.5 9s-1 7-2.5 9" />
      <path d="M3 12h18" />
    </svg>
  );
}

function IconGlove({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 11V6a2 2 0 0 0-4 0v5" />
      <path d="M14 10V4a2 2 0 0 0-4 0v6" />
      <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
      <path d="M6 14a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4v-2.5" />
      <path d="M18 11a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8v-5" />
    </svg>
  );
}

function IconWaveform({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12h2" />
      <path d="M6 8v8" />
      <path d="M10 6v12" />
      <path d="M14 4v16" />
      <path d="M18 8v8" />
      <path d="M22 12h-2" />
    </svg>
  );
}


// ─── Rank Medal Colors ────────────────────────────────────────────────────────

function rankColor(idx: number) {
  if (idx === 0) return { text: '#F5C842', label: 'Gold' };
  if (idx === 1) return { text: '#C0C0C0', label: 'Silver' };
  if (idx === 2) return { text: '#CD7F32', label: 'Bronze' };
  return { text: 'rgba(255,255,255,0.25)', label: '' };
}

// ─── Player Row ────────────────────────────────────────────────────────────────

function PlayerRow({
  idx,
  name,
  imageUrl,
  overall,
  nationName,
  statLabel,
  statValue,
  accentColor,
  statSecondary,
}: {
  idx: number;
  name: string;
  imageUrl: string | null;
  overall: number;
  nationName: string;
  statLabel: string;
  statValue: string | number;
  accentColor: string;
  statSecondary?: string;
}) {
  const { text: rankTextColor } = rankColor(idx);
  const isTop3 = idx < 3;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        borderRadius: '10px',
        background: isTop3 ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: `1px solid ${isTop3 ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
        transition: 'background 0.15s ease',
      }}
    >
      {/* Rank */}
      <span
        style={{
          fontFamily: 'var(--font)',
          fontWeight: '700',
          fontSize: '0.72rem',
          letterSpacing: '0.02em',
          color: rankTextColor,
          width: '22px',
          flexShrink: 0,
          textAlign: 'center',
        }}
      >
        {idx + 1}
      </span>

      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={imageUrl || ''}
          alt=""
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            objectFit: 'cover',
            background: 'rgba(255,255,255,0.06)',
            display: 'block',
          }}
          onError={(e) => {
            const el = e.target as HTMLImageElement;
            el.style.display = 'none';
            const parent = el.parentElement;
            if (parent && !parent.querySelector('.avatar-fallback')) {
              const fb = document.createElement('div');
              fb.className = 'avatar-fallback';
              fb.style.cssText =
                'width:36px;height:36px;borderRadius:50%;background:rgba(255,255,255,0.06);display:flex;alignItems:center;justifyContent:center;fontSize:13px;fontWeight:600;color:rgba(255,255,255,0.4);';
              fb.textContent = name.charAt(0).toUpperCase();
              parent.appendChild(fb);
            }
          }}
        />
        <span
          style={{
            position: 'absolute',
            bottom: '-3px',
            right: '-3px',
            background: '#111',
            color: 'rgba(255,255,255,0.55)',
            fontSize: '0.58rem',
            fontWeight: '700',
            padding: '1px 4px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.12)',
            letterSpacing: '0.02em',
          }}
        >
          {overall}
        </span>
      </div>

      {/* Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
        <span
          style={{
            color: '#fff',
            fontSize: '0.875rem',
            fontWeight: '600',
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </span>
        <span
          style={{
            color: 'rgba(255,255,255,0.38)',
            fontSize: '0.72rem',
            fontWeight: '500',
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {nationName}
        </span>
      </div>

      {/* Stat */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
        <span
          style={{
            fontWeight: '700',
            fontSize: '1rem',
            color: accentColor,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          {statValue}
          <span style={{ fontSize: '0.65rem', fontWeight: '500', marginLeft: '3px', opacity: 0.7 }}>
            {statLabel}
          </span>
        </span>
        {statSecondary && (
          <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '0.68rem', fontWeight: '500' }}>
            {statSecondary}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard Panel ────────────────────────────────────────────────────────

function LeaderboardPanel({
  title,
  subtitle,
  icon,
  accentColor,
  children,
  isEmpty,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentColor: string;
  children: React.ReactNode;
  isEmpty: boolean;
  emptyMessage: string;
}) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      {/* Panel Header */}
      <div
        style={{
          padding: '16px 16px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background: `${accentColor}18`,
            border: `1px solid ${accentColor}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <p style={{ margin: 0, color: '#fff', fontSize: '0.9rem', fontWeight: '600', letterSpacing: '-0.01em' }}>
            {title}
          </p>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', fontWeight: '500', marginTop: '1px' }}>
            {subtitle}
          </p>
        </div>
      </div>

      {/* Panel Body */}
      <div style={{ padding: '10px 8px' }}>
        {isEmpty ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.2)',
              fontSize: '0.82rem',
              fontWeight: '500',
              letterSpacing: '0.01em',
            }}
          >
            {emptyMessage}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TournamentStatsTab() {
  const [stats, setStats] = useState<{
    topScorers: StatRow[];
    topPlaymakers: StatRow[];
    topGoalkeepers: GoalkeeperRow[];
    aiSummary: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await api.get('/tournament/stats');
        if (res.data.success) {
          setStats(res.data.data);
        } else {
          setError(res.data.error || 'Failed to load stats');
        }
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.error || 'Failed to fetch tournament statistics.');
      } finally {
        setIsLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '64px 0', gap: '12px' }}>
        <div className="loading-spinner" />
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.875rem', fontWeight: '500' }}>
          Compiling match statistics…
        </span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="modal-error-banner" style={{ margin: '20px 0', padding: '16px', borderRadius: '10px' }}>
        {error || 'No statistics available.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── AI Match Report ──────────────────────────────────────────────── */}
      <div
        style={{
          borderRadius: '14px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.025)',
          overflow: 'hidden',
        }}
      >
        {/* Header bar */}
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconWaveform size={15} color="rgba(255,255,255,0.65)" />
          </div>
          <div style={{ flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontSize: '0.8rem',
                fontWeight: '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              Match Intelligence
            </p>
          </div>
          {/* Live pulse dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#34d399',
                boxShadow: '0 0 0 0 rgba(52,211,153,0.4)',
                animation: 'livePulse 2s ease-in-out infinite',
                display: 'block',
              }}
            />
            <span
              style={{
                color: '#34d399',
                fontSize: '0.68rem',
                fontWeight: '600',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Live
            </span>
          </div>
        </div>

        {/* Summary body */}
        <div style={{ padding: '16px 20px 18px' }}>
          <p
            style={{
              margin: 0,
              color: 'rgba(255,255,255,0.75)',
              fontSize: '0.92rem',
              lineHeight: '1.65',
              fontWeight: '400',
              letterSpacing: '0.005em',
            }}
          >
            {stats.aiSummary}
          </p>
        </div>
      </div>

      {/* ── Leaderboard Grid ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Golden Boot */}
        <LeaderboardPanel
          title="Golden Boot"
          subtitle="Top goal scorers"
          accentColor="#F5C842"
          icon={<IconBoot size={15} color="#F5C842" />}
          isEmpty={stats.topScorers.length === 0}
          emptyMessage="No goals recorded yet"
        >
          {stats.topScorers.slice(0, 10).map((row, idx) => (
            <PlayerRow
              key={row.player.id}
              idx={idx}
              name={row.player.name}
              imageUrl={row.player.image_url}
              overall={row.player.overall}
              nationName={row.claim.nations?.name ?? '—'}
              statLabel="G"
              statValue={row.count}
              accentColor="#F5C842"
            />
          ))}
        </LeaderboardPanel>

        {/* Top Assists */}
        <LeaderboardPanel
          title="Top Assists"
          subtitle="Leading playmakers"
          accentColor="#818cf8"
          icon={<IconAssist size={15} color="#818cf8" />}
          isEmpty={stats.topPlaymakers.length === 0}
          emptyMessage="No assists recorded yet"
        >
          {stats.topPlaymakers.slice(0, 10).map((row, idx) => (
            <PlayerRow
              key={row.player.id}
              idx={idx}
              name={row.player.name}
              imageUrl={row.player.image_url}
              overall={row.player.overall}
              nationName={row.claim.nations?.name ?? '—'}
              statLabel="A"
              statValue={row.count}
              accentColor="#818cf8"
            />
          ))}
        </LeaderboardPanel>

        {/* Golden Glove */}
        <LeaderboardPanel
          title="Golden Glove"
          subtitle="Clean sheets · Goals conceded"
          accentColor="#34d399"
          icon={<IconGlove size={15} color="#34d399" />}
          isEmpty={stats.topGoalkeepers.length === 0}
          emptyMessage="No goalkeeper data yet"
        >
          {stats.topGoalkeepers.slice(0, 10).map((row, idx) => (
            <PlayerRow
              key={row.player.id}
              idx={idx}
              name={row.player.name}
              imageUrl={row.player.image_url}
              overall={row.player.overall}
              nationName={`${row.claim.nations?.name ?? '—'} · ${row.matchesPlayed} played`}
              statLabel="CS"
              statValue={row.cleanSheets}
              accentColor="#34d399"
              statSecondary={`${row.goalsConceded} conceded`}
            />
          ))}
        </LeaderboardPanel>
      </div>

      {/* ── Inline keyframes for live pulse ────────────────────────────── */}
      <style>{`
        @keyframes livePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); }
          50%       { box-shadow: 0 0 0 5px rgba(52,211,153,0); }
        }
      `}</style>
    </div>
  );
}
