// ─── User & Auth ────────────────────────────────────────────────────────────

export type UserRole = 'player' | 'admin';

export interface User {
  id: string;
  google_id: string;
  display_name: string;
  username: string;
  role: UserRole;
  is_suspended: boolean;
  created_at: string;
}

// ─── Tournament ──────────────────────────────────────────────────────────────

export type TournamentMode = 'world_cup' | 'ucl';
export type TournamentStatus =
  | 'registration'
  | 'pre_qual'
  | 'group_stage'
  | 'knockout'
  | 'completed';

export interface Tournament {
  id: string;
  name: string;
  mode: TournamentMode;
  status: TournamentStatus;
  created_at: string;
}

// ─── Nations / Clubs ─────────────────────────────────────────────────────────

export interface Nation {
  id: string;
  name: string;
  flag_url: string | null;
  mode: TournamentMode;
}

// ─── Nation Claims ───────────────────────────────────────────────────────────

export type ClaimStatus = 'pending' | 'pending_prequal' | 'qualified' | 'eliminated';

export interface NationClaim {
  id: string;
  tournament_id: string;
  nation_id: string;
  user_id: string;
  status: ClaimStatus;
}

// ─── Players (eFootball player DB) ──────────────────────────────────────────

export interface Player {
  id: string;
  name: string;
  aliases: string[];
  positions: string[];
  overall: number | null;
  club: string | null;
  nationality: string | null;
}

// ─── Squad ───────────────────────────────────────────────────────────────────

export interface Squad {
  id: string;
  user_id: string;
  tournament_id: string;
  claim_id: string;
  formation: string;
  positions: Record<string, string>; // position label → player UUID
  updated_at: string;
}

// ─── Matches ─────────────────────────────────────────────────────────────────

export type MatchStatus =
  | 'scheduled'
  | 'active'
  | 'pending_verification'
  | 'verified'
  | 'disputed';

export interface Match {
  id: string;
  tournament_id: string;
  home_claim_id: string;
  away_claim_id: string;
  stage: string;
  group_name: string | null;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  is_prequal: boolean;
  scheduled_at: string | null;
  verified_at: string | null;
}

// ─── Match Events ─────────────────────────────────────────────────────────────

export type MatchEventType = 'goal' | 'assist';

export interface MatchEvent {
  id: string;
  match_id: string;
  type: MatchEventType;
  player_id: string;
  claim_id: string;
  minute: number | null;
  created_at: string;
}

// ─── Result Submissions ───────────────────────────────────────────────────────

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface ResultSubmission {
  id: string;
  match_id: string;
  submitted_by: string;
  screenshot_url: string | null;
  ai_package: AiPackage;
  status: SubmissionStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AiPackage {
  home_score: number;
  away_score: number;
  events: Array<{
    type: MatchEventType;
    player_id: string;
    minute: number | null;
  }>;
}

// ─── Disputes ────────────────────────────────────────────────────────────────

export type DisputeStatus = 'open' | 'resolved';
export type DisputeResolution = 'accepted' | 'overridden' | 'suspended';

export interface Dispute {
  id: string;
  match_id: string;
  raised_by: string;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  match_id: string;
  dispute_id: string | null;
  sender_id: string;
  body: string;
  created_at: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationType =
  | 'match_reminder'
  | 'result_verified'
  | 'result_rejected'
  | 'dispute_update'
  | 'tournament_announcement'
  | 'suspension_notice'
  | 'winner_announcement';

export interface Notification {
  id: string;
  user_id: string | null; // null = broadcast
  type: NotificationType;
  body: string;
  is_read: boolean;
  created_at: string;
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

export type RewardType = 'winner' | 'golden_boot' | 'golden_ball' | 'best_defence' | 'other';

export interface Reward {
  id: string;
  tournament_id: string;
  type: RewardType;
  label: string;
  description: string;
  winner_claim: string | null;
  created_at: string;
}

// ─── API Response Helpers ─────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
