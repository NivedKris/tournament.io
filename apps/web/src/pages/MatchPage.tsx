import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useTenant } from '../components/TenantProvider';
import api from '../lib/api';
import { 
  ChevronLeft, 
  MessageSquare, 
  AlertCircle, 
  Image as ImageIcon,
  Send,
  Paperclip,
  User
} from 'lucide-react';

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
  '4-2-2-2': {
    GK: { x: 50, y: 88 },
    LB: { x: 15, y: 70 },
    CB_L: { x: 35, y: 73 },
    CB_R: { x: 65, y: 73 },
    RB: { x: 85, y: 70 },
    DM_L: { x: 35, y: 55 },
    DM_R: { x: 65, y: 55 },
    AM_L: { x: 33, y: 32 },
    AM_R: { x: 67, y: 32 },
    CF_L: { x: 35, y: 14 },
    CF_R: { x: 65, y: 14 },
  },
  '4-1-2-3': {
    GK: { x: 50, y: 88 },
    LB: { x: 15, y: 70 },
    CB_L: { x: 35, y: 73 },
    CB_R: { x: 65, y: 73 },
    RB: { x: 85, y: 70 },
    DM: { x: 50, y: 55 },
    AM_L: { x: 30, y: 36 },
    AM_R: { x: 70, y: 36 },
    LW: { x: 18, y: 18 },
    RW: { x: 82, y: 18 },
    CF: { x: 50, y: 12 },
  }
};

function PlayerAvatar({ src, name, overall, borderCol }: { src?: string; name: string; overall: number; borderCol: string }) {
  const [imgFailed, setImgFailed] = useState(false);

  const initials = name
    ? (name.trim().includes(' ')
        ? name.trim().split(/\s+/).map(n => n[0]).join('')
        : name.trim().substring(0, 2)
      ).toUpperCase()
    : '??';

  return (
    <div style={{ position: 'relative' }}>
      {src && src.trim() !== '' && !imgFailed ? (
        <img 
          src={src} 
          alt={name} 
          onError={() => setImgFailed(true)}
          style={{ 
            width: '42px', 
            height: '42px', 
            borderRadius: '50%', 
            objectFit: 'cover', 
            border: `2.5px solid ${borderCol}`, 
            background: '#0a0a0a', 
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)' 
          }}
        />
      ) : (
        <div style={{ 
          width: '42px', 
          height: '42px', 
          borderRadius: '50%', 
          background: 'rgba(255,255,255,0.08)', 
          border: `2.5px solid ${borderCol}`, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#fff', 
          fontSize: '0.8rem', 
          fontWeight: 800,
          boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
        }}>
          {initials}
        </div>
      )}
      <span style={{
        position: 'absolute',
        bottom: '-2px',
        right: '-4px',
        background: borderCol,
        color: '#fff',
        fontSize: '0.62rem',
        fontWeight: 800,
        padding: '1px 4px',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
      }}>
        {overall}
      </span>
    </div>
  );
}

function SubAvatar({ src, name }: { src?: string; name: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = name
    ? (name.trim().includes(' ')
        ? name.trim().split(/\s+/).map(n => n[0]).join('')
        : name.trim().substring(0, 2)
      ).toUpperCase()
    : '??';

  if (src && src.trim() !== '' && !imgFailed) {
    return (
      <img 
        src={src} 
        alt="" 
        onError={() => setImgFailed(true)} 
        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} 
      />
    );
  }
  return (
    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 800 }}>
      {initials}
    </div>
  );
}

export default function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const { tenant } = useTenant();

  const currentUserId = user?.id || '';
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [activeTab, setActiveTab] = useState<'match' | 'lineups' | 'chat'>('match');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
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
  const [events, setEvents] = useState<Array<{ claim_id: string; scorer_id: number; assister_id: number | null }>>([]);

  const [homeSquadPlayers, setHomeSquadPlayers] = useState<any[]>([]);
  const [awaySquadPlayers, setAwaySquadPlayers] = useState<any[]>([]);

  // Squad formations for Lineups tab
  const [homeSquad, setHomeSquad] = useState<any | null>(null);
  const [awaySquad, setAwaySquad] = useState<any | null>(null);

  // Admin events state
  const [adminEvents, setAdminEvents] = useState<Array<{ claim_id: string; scorer_id: number; assister_id: number | null }>>([]);

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

  // Load squad details and players for listing and lineups
  useEffect(() => {
    if (match) {
      if (match.home_claim_id) {
        api.get(`/squad/${match.home_claim_id}`).then((res) => {
          if (res.data.success && res.data.data) {
            setHomeSquad(res.data.data);
            const pos = res.data.data.positions || {};
            const list = Object.values(pos).filter(Boolean);
            setHomeSquadPlayers(list);
          }
        });
      }
      if (match.away_claim_id) {
        api.get(`/squad/${match.away_claim_id}`).then((res) => {
          if (res.data.success && res.data.data) {
            setAwaySquad(res.data.data);
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

    const isPrequalOrKnockout = match?.stage === 'pre_qual' || match?.stage === 'knockout';
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
        flatEvents.push({ claim_id: ev.claim_id, player_id: ev.scorer_id, event_type: 'goal' });
      }
      if (ev.assister_id) {
        flatEvents.push({ claim_id: ev.claim_id, player_id: ev.assister_id, event_type: 'assist' });
      }
    }
    const payload: any = { home_score: hs, away_score: as_, events: flatEvents };
    if (hs === as_ && (match?.stage === 'pre_qual' || match?.stage === 'knockout')) {
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

      if (hs === as_ && (match?.stage === 'pre_qual' || match?.stage === 'knockout')) {
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
          flatEvents.push({ claim_id: ev.claim_id, player_id: ev.scorer_id, event_type: 'goal' });
        }
        if (ev.assister_id) {
          flatEvents.push({ claim_id: ev.claim_id, player_id: ev.assister_id, event_type: 'assist' });
        }
      }
      payload.events = flatEvents;
    }

    try {
      const res = await api.post(`/matches/admin/${matchId}/resolve-dispute`, payload);
      if (res.data.success) {
        setResolutionComment('');
        await loadMatchDetails();
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
    if (!match) return '';
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

  if (isLoading || !match) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <span className="loading-label">Loading match details...</span>
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

  // Coordinate Conversion helper for Lineups tab
  const getHomeCoords = (posKey: string) => {
    if (homeSquad?.coordinates?.[posKey]) {
      return homeSquad.coordinates[posKey];
    }
    const form = homeSquad?.formation || '4-3-3';
    return PRESETS[form]?.[posKey] || { x: 50, y: 50 };
  };

  const getAwayCoords = (posKey: string) => {
    if (awaySquad?.coordinates?.[posKey]) {
      return awaySquad.coordinates[posKey];
    }
    const form = awaySquad?.formation || '4-3-3';
    return PRESETS[form]?.[posKey] || { x: 50, y: 50 };
  };

  const getHomePlayerStyles = (posKey: string) => {
    const coords = getHomeCoords(posKey);
    if (isMobile) {
      return {
        left: `${6 + coords.x * 0.88}%`,
        top: `${2.5 + (100 - coords.y) * 0.48}%`
      };
    }
    return {
      left: `${6 + (100 - coords.y) * 0.39}%`,
      top: `${5 + coords.x * 0.9}%`
    };
  };

  const getAwayPlayerStyles = (posKey: string) => {
    const coords = getAwayCoords(posKey);
    if (isMobile) {
      return {
        left: `${6 + coords.x * 0.88}%`,
        top: `${97.5 - (100 - coords.y) * 0.48}%`
      };
    }
    return {
      left: `${94 - (100 - coords.y) * 0.39}%`,
      top: `${5 + coords.x * 0.9}%`
    };
  };

  const homeFormation = homeSquad?.formation || '4-3-3';
  const homePositionsList = Object.keys(PRESETS[homeFormation] || PRESETS['4-3-3']);

  const awayFormation = awaySquad?.formation || '4-3-3';
  const awayPositionsList = Object.keys(PRESETS[awayFormation] || PRESETS['4-3-3']);

  // Extract substitutes
  const homeSubsList = Object.entries(homeSquad?.positions || {})
    .filter(([key, val]) => key.startsWith('SUB_') && val)
    .sort((a, b) => parseInt(a[0].replace('SUB_', '')) - parseInt(b[0].replace('SUB_', '')))
    .map(([_, val]) => val);

  const awaySubsList = Object.entries(awaySquad?.positions || {})
    .filter(([key, val]) => key.startsWith('SUB_') && val)
    .sort((a, b) => parseInt(a[0].replace('SUB_', '')) - parseInt(b[0].replace('SUB_', '')))
    .map(([_, val]) => val);

  return (
    <div className="app-shell">
      {/* Navbar */}
      <nav className="navbar">
        <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
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
          {isAdmin && <span className="badge badge-admin">Admin</span>}
          <button id="signout-btn" className="btn btn-secondary btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div className="page-content" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 16px' }}>
        
        {/* Back Link */}
        <button 
          onClick={() => navigate('/')} 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            marginBottom: '20px',
            padding: 0,
            transition: 'color 0.15s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'}
        >
          <ChevronLeft size={16} /> Back to Dashboard
        </button>

        {/* Error Banner */}
        {error && (
          <div 
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#f87171',
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Scoreboard Card */}
        <div 
          style={{
            background: 'rgba(30, 41, 59, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '24px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <span style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              fontSize: '0.78rem',
              fontWeight: 700,
              padding: '4px 12px',
              borderRadius: '100px',
              letterSpacing: '0.03em',
              textTransform: 'uppercase'
            }}>
              {getStageLabel()}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            {/* Home Team */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flex: 1 }}>
              {match.home_claim?.nations?.flag_url ? (
                <img 
                  src={match.home_claim.nations.flag_url} 
                  alt="" 
                  className="team-logo"
                  style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'contain', background: 'rgba(0, 0, 0, 0.25)', padding: '4px', boxShadow: '0 4px 15px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              ) : (
                <div className="team-logo" style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: 'rgba(255,255,255,0.4)', border: '1.5px dashed rgba(255,255,255,0.1)' }}>?</div>
              )}
              <span className="team-name">
                {match.home_claim?.nations?.name ?? 'TBD'}
              </span>
              <span className="team-username" style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                @{match.home_claim?.users?.username ?? 'tbd'}
              </span>
            </div>

            {/* Score Center */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: 'fit-content' }}>
              {match.status === 'scheduled' ? (
                <span className="score-text-vs" style={{ fontSize: '1.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>VS</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span className="score-text">
                    {match.home_score} – {match.away_score}
                  </span>
                  {match.home_pens !== null && match.away_pens !== null && (
                    <span style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 600, fontFamily: 'monospace' }}>
                      ({match.home_pens} – {match.away_pens} pens)
                    </span>
                  )}
                </div>
              )}
              <span style={{
                background: match.status === 'verified' ? 'rgba(52, 211, 153, 0.12)' : (match.status === 'disputed' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(251, 191, 36, 0.12)'),
                color: match.status === 'verified' ? '#34d399' : (match.status === 'disputed' ? '#f87171' : '#fbbf24'),
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                border: match.status === 'verified' ? '1px solid rgba(52, 211, 153, 0.2)' : (match.status === 'disputed' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(251, 191, 36, 0.2)')
              }}>
                {match.status.replace('_', ' ')}
              </span>
            </div>

            {/* Away Team */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', flex: 1 }}>
              {match.away_claim?.nations?.flag_url ? (
                <img 
                  src={match.away_claim.nations.flag_url} 
                  alt="" 
                  className="team-logo"
                  style={{ width: '52px', height: '52px', borderRadius: '12px', objectFit: 'contain', background: 'rgba(0, 0, 0, 0.25)', padding: '4px', boxShadow: '0 4px 15px rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              ) : (
                <div className="team-logo" style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: 'rgba(255,255,255,0.4)', border: '1.5px dashed rgba(255,255,255,0.1)' }}>?</div>
              )}
              <span className="team-name">
                {match.away_claim?.nations?.name ?? 'TBD'}
              </span>
              <span className="team-username" style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                @{match.away_claim?.users?.username ?? 'tbd'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '24px', paddingBottom: '1px' }}>
          <button
            onClick={() => setActiveTab('match')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'match' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'match' ? '#fff' : 'rgba(255,255,255,0.5)',
              fontSize: '0.95rem',
              fontWeight: 700,
              padding: '12px 18px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Match Details
          </button>
          <button
            onClick={() => setActiveTab('lineups')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'lineups' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'lineups' ? '#fff' : 'rgba(255,255,255,0.5)',
              fontSize: '0.95rem',
              fontWeight: 700,
              padding: '12px 18px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Lineups & Formations
          </button>
          {(isUserParticipant || isAdmin) && (
            <button
              onClick={() => setActiveTab('chat')}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === 'chat' ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === 'chat' ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: '0.95rem',
                fontWeight: 700,
                padding: '12px 18px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Match Chat
            </button>
          )}
        </div>

        {/* Tab 1: Match Details */}
        {activeTab === 'match' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {match.status === 'disputed' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', padding: '16px', borderRadius: '12px' }}>
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

            {/* Screenshot proof and events display */}
            {(match.screenshot_url || (match.events && match.events.length > 0)) && (
              <div style={{ background: 'rgba(30, 41, 59, 0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
                <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, margin: '0 0 16px 0' }}>Match Submission Details</h4>
                {match.screenshot_url && (
                  <div style={{ marginBottom: '20px' }}>
                    <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '8px' }}>Uploaded Screenshot Proof:</p>
                    <a href={match.screenshot_url} target="_blank" rel="noopener noreferrer">
                      <img src={match.screenshot_url} alt="Proof" style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'zoom-in' }} />
                    </a>
                  </div>
                )}
                {match.events && match.events.length > 0 && (() => {
                  const goals = match.events.filter((e: any) => e.event_type === 'goal');
                  const assists = match.events.filter((e: any) => e.event_type === 'assist');
                  return (
                    <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '12px' }}>Match Events</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {goals.map((e: any, i: number) => {
                          const assist = assists[i];
                          return (
                            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                              <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>{e.player?.name || 'Unknown'}</span>
                              {assist && (
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', fontWeight: '500' }}>
                                  ({assist.player?.name || 'Unknown'})
                                </span>
                              )}
                              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontWeight: '500', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{e.claim?.nations?.name}</span>
                            </div>
                          );
                        })}
                        {assists.slice(goals.length).map((e: any) => (
                          <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(129,140,248,0.7)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z"/><path d="M12 3c-1.5 2-2.5 5-2.5 9s1 7 2.5 9"/><path d="M12 3c1.5 2 2.5 5 2.5 9s-1 7-2.5 9"/><path d="M3 12h18"/></svg>
                            <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: '600' }}>{e.player?.name || 'Unknown'}</span>
                            <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', fontWeight: '500', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{e.claim?.nations?.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Submit Score Box */}
            {showSubmitForm && (
              <div style={{ background: 'rgba(30, 41, 59, 0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
                <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: 700, margin: '0 0 16px 0' }}>Submit Match Score</h4>
                <form onSubmit={handleSubmitScore} className="submit-score-form">
                  <div className="score-inputs-row">
                    <div className="form-group flex-1">
                      <label>{match.home_claim?.nations?.name ?? 'Home'} Score</label>
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
                      <label>{match.away_claim?.nations?.name ?? 'Away'} Score</label>
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

                  {homeScore !== '' && awayScore !== '' && homeScore === awayScore && (match.stage === 'pre_qual' || match.stage === 'knockout') && (
                    <div className="penalties-input-section animate-slide-down" style={{ marginTop: '12px' }}>
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

                  {/* Screenshot Proof */}
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.82rem', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                      Screenshot Proof <span style={{ color: '#ef4444' }}>*</span>
                    </label>

                    <input
                      id="screenshot-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={isSubmitting || isUploading}
                      style={{ display: 'none' }}
                    />

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
                            <ImageIcon size={20} />
                          </div>
                          <span className="file-upload-zone__text">Attach screenshot proof</span>
                          <span className="file-upload-zone__hint">JPG, PNG or WebP · max 5 MB</span>
                        </>
                      )}
                    </label>
                  </div>

                  {/* Scorer Goals */}
                  <div className="form-group" style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.82rem', fontWeight: '600', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                      Goals
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {events.map((event, index) => {
                        const squadPlayers = event.claim_id === match.home_claim_id ? homeSquadPlayers : awaySquadPlayers;
                        return (
                          <div key={index} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    style={{ marginTop: '16px' }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Score'}
                  </button>
                </form>
              </div>
            )}

            {/* Waiting box */}
            {showWaitingBox && (
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '16px', borderRadius: '12px' }}>
                <h5 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700 }}>Score Submitted</h5>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)' }}>
                  You submitted the score: <strong>{match.home_score} – {match.away_score}</strong>.
                  Waiting for your opponent to confirm or raise a dispute.
                </p>
              </div>
            )}

            {/* Confirm Score Actions */}
            {showConfirmationBox && (
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#fcd34d', padding: '16px', borderRadius: '12px' }}>
                <h5 style={{ margin: '0 0 6px 0', fontSize: '1rem', fontWeight: 700 }}>Verify Score</h5>
                {showDisputeForm ? (
                  <form onSubmit={handleDisputeScore} className="mt-4">
                    <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
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
                    <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
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
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)' }}>
                      Opponent submitted score: <strong>{match.home_score} – {match.away_score}</strong>
                      {match.home_pens !== null && (
                        <span> ({match.home_pens} – {match.away_pens} pens)</span>
                      )}
                      . Please verify if this matches your played game result.
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
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

            {/* Admin Override & Arbitration */}
            {isAdmin && (
              <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                {match.status === 'disputed' ? (
                  <div style={{ background: 'rgba(251, 191, 36, 0.03)', border: '1px solid rgba(251, 191, 36, 0.12)', borderRadius: '16px', padding: '20px' }}>
                    <h5 style={{ color: '#fbbf24', fontWeight: '700', fontSize: '1rem', marginBottom: '8px' }}>Admin Dispute Arbitration</h5>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: '16px', margin: 0 }}>
                      Review evidence, discuss with participants in chat, and resolve the dispute.
                    </p>

                    <div className="form-group" style={{ margin: '16px 0' }}>
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
                      <div style={{ display: 'flex', gap: '10px' }}>
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

                        {adminHomeScore !== '' && adminAwayScore !== '' && adminHomeScore === adminAwayScore && (match.stage === 'pre_qual' || match.stage === 'knockout') && (
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
                          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
                            Goals & Assists
                          </label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {adminEvents.map((event, index) => {
                              const squadPlayers = event.claim_id === match.home_claim_id ? homeSquadPlayers : awaySquadPlayers;
                              return (
                                <div key={index} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  </div>
                ) : (
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '20px' }}>
                    <h5 style={{ color: '#fbbf24', fontWeight: 700, margin: '0 0 16px 0' }}>Admin Override Panel</h5>
                    
                    <form onSubmit={handleAdminVerify} className="submit-score-form">
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

                      {adminHomeScore !== '' && adminAwayScore !== '' && adminHomeScore === adminAwayScore && (match.stage === 'pre_qual' || match.stage === 'knockout') && (
                        <div className="score-inputs-row mt-2" style={{ marginTop: '8px' }}>
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

                      {/* Admin Events */}
                      <div className="form-group mt-4" style={{ marginTop: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '600', color: '#fbbf24' }}>
                          Force Registered Goals & Assists
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {adminEvents.map((event, index) => {
                            const squadPlayers = event.claim_id === match.home_claim_id ? homeSquadPlayers : awaySquadPlayers;
                            return (
                              <div key={index} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

                      <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
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
          </div>
        )}

        {/* Tab 2: Lineups */}
        {activeTab === 'lineups' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Header info */}
             <div className="tactical-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <span className="tactical-team-name">{match.home_claim?.nations?.name}</span>
                <span className="tactical-formation-badge">{homeFormation}</span>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', margin: '0 8px' }}>Predicted Lineups</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexDirection: 'row-reverse' }}>
                <span className="tactical-team-name" style={{ textAlign: 'right' }}>{match.away_claim?.nations?.name}</span>
                <span className="tactical-formation-badge">{awayFormation}</span>
              </div>
            </div>

            {/* Tactical Football Field */}
            <div className="tactical-field-outer">
              <div 
                className="tactical-field-inner"
                style={{
                  position: 'relative',
                  background: 'radial-gradient(circle, #1b3d22 0%, #0d1e11 100%)',
                  overflow: 'hidden',
                  boxShadow: 'inset 0 0 60px rgba(0,0,0,0.5)'
                }}
              >
              {/* Pitch Markings */}
              {isMobile ? (
                <>
                  {/* Center Line */}
                  <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1.5px', background: 'rgba(255,255,255,0.12)', transform: 'translateY(-50%)' }} />
                  {/* Center Circle */}
                  <div style={{ position: 'absolute', left: '50%', top: '50%', width: '100px', height: '100px', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />
                  <div style={{ position: 'absolute', left: '50%', top: '50%', width: '6px', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />

                  {/* Top Penalty Area (Home) */}
                  <div style={{ position: 'absolute', top: 0, left: '22%', right: '22%', height: '13%', border: '1.5px solid rgba(255,255,255,0.12)', borderTop: 'none' }} />
                  <div style={{ position: 'absolute', top: 0, left: '35%', right: '35%', height: '5%', border: '1.5px solid rgba(255,255,255,0.12)', borderTop: 'none' }} />
                  <div style={{ position: 'absolute', top: '9%', left: '50%', width: '4px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />
                  {/* Penalty Arc Top */}
                  <div style={{ position: 'absolute', top: '8%', left: '40%', right: '40%', height: '8%', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '50%', borderTop: 'none', transform: 'scaleY(0.7)' }} />

                  {/* Bottom Penalty Area (Away) */}
                  <div style={{ position: 'absolute', bottom: 0, left: '22%', right: '22%', height: '13%', border: '1.5px solid rgba(255,255,255,0.12)', borderBottom: 'none' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: '35%', right: '35%', height: '5%', border: '1.5px solid rgba(255,255,255,0.12)', borderBottom: 'none' }} />
                  <div style={{ position: 'absolute', bottom: '9%', left: '50%', width: '4px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', transform: 'translate(-50%, 50%)' }} />
                  {/* Penalty Arc Bottom */}
                  <div style={{ position: 'absolute', bottom: '8%', left: '40%', right: '40%', height: '8%', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '50%', borderBottom: 'none', transform: 'scaleY(0.7)' }} />
                </>
              ) : (
                <>
                  {/* Center Line */}
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1.5px', background: 'rgba(255,255,255,0.12)', transform: 'translateX(-50%)' }} />
                  {/* Center Circle */}
                  <div style={{ position: 'absolute', left: '50%', top: '50%', width: '100px', height: '100px', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />
                  <div style={{ position: 'absolute', left: '50%', top: '50%', width: '6px', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />

                  {/* Left Penalty Area */}
                  <div style={{ position: 'absolute', left: 0, top: '22%', bottom: '22%', width: '13%', border: '1.5px solid rgba(255,255,255,0.12)', borderLeft: 'none' }} />
                  <div style={{ position: 'absolute', left: 0, top: '35%', bottom: '35%', width: '5%', border: '1.5px solid rgba(255,255,255,0.12)', borderLeft: 'none' }} />
                  <div style={{ position: 'absolute', left: '9%', top: '50%', width: '4px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />
                  {/* Penalty Arc Left */}
                  <div style={{ position: 'absolute', left: '8%', top: '40%', bottom: '40%', width: '8%', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '50%', borderLeft: 'none', transform: 'scaleX(0.7)' }} />

                  {/* Right Penalty Area */}
                  <div style={{ position: 'absolute', right: 0, top: '22%', bottom: '22%', width: '13%', border: '1.5px solid rgba(255,255,255,0.12)', borderRight: 'none' }} />
                  <div style={{ position: 'absolute', right: 0, top: '35%', bottom: '35%', width: '5%', border: '1.5px solid rgba(255,255,255,0.12)', borderRight: 'none' }} />
                  <div style={{ position: 'absolute', right: '9%', top: '50%', width: '4px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', transform: 'translate(50%, -50%)' }} />
                  {/* Penalty Arc Right */}
                  <div style={{ position: 'absolute', right: '8%', top: '40%', bottom: '40%', width: '8%', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '50%', borderRight: 'none', transform: 'scaleX(0.7)' }} />
                </>
              )}

              {/* Corner Arcs */}
              <div style={{ position: 'absolute', left: '-10px', top: '-10px', width: '20px', height: '20px', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', left: '-10px', bottom: '-10px', width: '20px', height: '20px', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '20px', height: '20px', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', right: '-10px', bottom: '-10px', width: '20px', height: '20px', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '50%' }} />

              {/* Home Squad Lineup (Left Half) */}
              {homePositionsList.map((posKey) => {
                const player = homeSquad?.positions?.[posKey];
                const styles = getHomePlayerStyles(posKey);

                return (
                  <div 
                    key={`home-${posKey}`}
                    className="player-node"
                    style={{
                      position: 'absolute',
                      left: styles.left,
                      top: styles.top,
                      transform: 'translate(-50%, -50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      zIndex: 10
                    }}
                  >
                    {player ? (
                      <>
                        <PlayerAvatar src={player.image_url} name={player.name} overall={player.overall} borderCol="#3b82f6" />
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.72rem', textShadow: '0 2px 4px rgba(0,0,0,0.85)', background: 'rgba(10,15,30,0.75)', padding: '2px 6px', borderRadius: '6px', whiteSpace: 'nowrap', maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {player.name.split(' ').pop()}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', marginTop: '-2px' }}>{posKey.split('_')[0]}</span>
                      </>
                    ) : (
                      <>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', fontWeight: 700, background: 'rgba(0,0,0,0.1)' }}>
                          {posKey.split('_')[0]}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Away Squad Lineup (Right Half) */}
              {awayPositionsList.map((posKey) => {
                const player = awaySquad?.positions?.[posKey];
                const styles = getAwayPlayerStyles(posKey);

                return (
                  <div 
                    key={`away-${posKey}`}
                    className="player-node"
                    style={{
                      position: 'absolute',
                      left: styles.left,
                      top: styles.top,
                      transform: 'translate(-50%, -50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      zIndex: 10
                    }}
                  >
                    {player ? (
                      <>
                        <PlayerAvatar src={player.image_url} name={player.name} overall={player.overall} borderCol="#f43f5e" />
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.72rem', textShadow: '0 2px 4px rgba(0,0,0,0.85)', background: 'rgba(10,15,30,0.75)', padding: '2px 6px', borderRadius: '6px', whiteSpace: 'nowrap', maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid rgba(255,255,255,0.06)' }}>
                          {player.name.split(' ').pop()}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', marginTop: '-2px' }}>{posKey.split('_')[0]}</span>
                      </>
                    ) : (
                      <>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '0.68rem', fontWeight: 700, background: 'rgba(0,0,0,0.1)' }}>
                          {posKey.split('_')[0]}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Coach Footer Panel - Rendered under the Pitch to avoid overlaps */}
              </div>

              <div 
                style={{
                  background: 'linear-gradient(to top, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 30, 0.95) 100%)',
                  padding: '12px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Coach</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                      {match.home_claim?.users?.display_name || match.home_claim?.users?.username || 'TBD'}
                    </span>
                  </div>
                </div>

                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'rgba(255,255,255,0.2)' }}>Tactical Sheet</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: 'row-reverse', textAlign: 'right' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Coach</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                      {match.away_claim?.users?.display_name || match.away_claim?.users?.username || 'TBD'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          {/* Substitutes Grid Section */}
            <div className="substitutes-grid" style={{ marginTop: '8px' }}>
              
              {/* Home Substitutes */}
              <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px' }}>
                <h5 style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 800, margin: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                  {match.home_claim?.nations?.name} Substitutes
                </h5>
                {homeSubsList.length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.38)' }}>No substitutes configured.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {homeSubsList.map((p: any) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.015)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <SubAvatar src={p.image_url} name={p.name} />
                        <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600 }}>{p.name}</span>
                        <span style={{ marginLeft: 'auto', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                          {p.overall} OVR
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Away Substitutes */}
              <div style={{ background: 'rgba(30, 41, 59, 0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '16px' }}>
                <h5 style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 800, margin: '0 0 12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                  {match.away_claim?.nations?.name} Substitutes
                </h5>
                {awaySubsList.length === 0 ? (
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.38)' }}>No substitutes configured.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {awaySubsList.map((p: any) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.015)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <SubAvatar src={p.image_url} name={p.name} />
                        <span style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600 }}>{p.name}</span>
                        <span style={{ marginLeft: 'auto', background: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', fontSize: '0.72rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px' }}>
                          {p.overall} OVR
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* Tab 3: Match Chat */}
        {activeTab === 'chat' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '560px', background: 'rgba(30, 41, 59, 0.15)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', overflow: 'hidden' }}>
            
            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 24px' }}>
                  <MessageSquare size={36} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: '12px' }} />
                  <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.4)', lineHeight: '1.5' }}>
                    Coordinate your game schedule and verify scores here. Only match participants and admins can see this chat.
                  </span>
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
                              style={{ maxWidth: '240px', maxHeight: '240px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'block' }}
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

            {/* Attachment preview */}
            {chatAttachmentUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' }}>
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

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'rgba(15, 23, 42, 0.4)', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              {match.status === 'disputed' && (
                <div style={{ position: 'relative' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
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
                      <Paperclip size={16} />
                    )}
                  </label>
                </div>
              )}
              <input
                type="text"
                placeholder="Type a message..."
                className="form-input"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={1000}
                required={!chatAttachmentUrl}
                style={{ flex: 1, margin: 0 }}
              />
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ height: '38px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={isUploadingChat}
              >
                Send <Send size={14} />
              </button>
            </form>

          </div>
        )}

      </div>
    </div>
  );
}
