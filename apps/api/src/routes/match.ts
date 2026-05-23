import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { verifySession, requireActive, requireRole } from '../middleware/auth';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getActiveTournament() {
  const { data } = await supabaseAdmin
    .from('tournaments').select('*').neq('status', 'completed')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}

function getMatchWinner(match: any): 'home' | 'away' {
  const hs = match.home_score ?? 0;
  const as_ = match.away_score ?? 0;
  if (hs > as_) return 'home';
  if (as_ > hs) return 'away';
  if (match.home_pens != null && match.away_pens != null) {
    return (match.home_pens ?? 0) >= (match.away_pens ?? 0) ? 'home' : 'away';
  }
  return 'home';
}

/** Full match select with claim/user/nation info */
const MATCH_SELECT = `
  *,
  home_claim:nation_claims!matches_home_claim_id_fkey(
    id, status, nation_id, user_id,
    nations(id, name, flag_url),
    users(id, username, display_name)
  ),
  away_claim:nation_claims!matches_away_claim_id_fkey(
    id, status, nation_id, user_id,
    nations(id, name, flag_url),
    users(id, username, display_name)
  )
`;

/** Check if userId is a participant of the match (home or away claim owner) */
function isParticipant(match: any, userId: string): boolean {
  return match.home_claim?.user_id === userId || match.away_claim?.user_id === userId;
}

/** After verifying a match, apply all post-match consequences */
async function resolveAfterVerified(matchId: string) {
  const { data: match } = await supabaseAdmin
    .from('matches').select(MATCH_SELECT).eq('id', matchId).single();
  if (!match) return;

  const winner = getMatchWinner(match);
  const winner_claim_id = winner === 'home' ? match.home_claim_id : match.away_claim_id;
  const loser_claim_id  = winner === 'home' ? match.away_claim_id : match.home_claim_id;

  if (match.stage === 'pre_qual') {
    // Find all pre-qual matches for the same nation (both home and away are from same nation)
    const nationId = match.home_claim?.nation_id;
    const { data: nationClaims } = await supabaseAdmin
      .from('nation_claims').select('id')
      .eq('tournament_id', match.tournament_id).eq('nation_id', nationId);
    const nationClaimIds = (nationClaims || []).map((c: any) => c.id);

    const { data: allNationPrequals } = await supabaseAdmin
      .from('matches').select('*')
      .eq('tournament_id', match.tournament_id).eq('stage', 'pre_qual')
      .in('home_claim_id', nationClaimIds).in('away_claim_id', nationClaimIds);

    const allDone = (allNationPrequals || []).every((m: any) => m.status === 'verified');
    if (allDone) {
      // Calculate mini-group standings, top 1 qualifies
      const standings: Record<string, { id: string; pts: number; gd: number; gf: number }> = {};
      for (const id of nationClaimIds) standings[id] = { id, pts: 0, gd: 0, gf: 0 };
      for (const m of (allNationPrequals || [])) {
        const hs = m.home_score ?? 0; const as_ = m.away_score ?? 0;
        const w = getMatchWinner(m);
        if (standings[m.home_claim_id]) { standings[m.home_claim_id].gf += hs; standings[m.home_claim_id].gd += hs - as_; }
        if (standings[m.away_claim_id]) { standings[m.away_claim_id].gf += as_; standings[m.away_claim_id].gd += as_ - hs; }
        if (w === 'home' && standings[m.home_claim_id]) { standings[m.home_claim_id].pts += 3; }
        else if (w === 'away' && standings[m.away_claim_id]) { standings[m.away_claim_id].pts += 3; }
        else {
          if (standings[m.home_claim_id]) standings[m.home_claim_id].pts++;
          if (standings[m.away_claim_id]) standings[m.away_claim_id].pts++;
        }
      }
      const sorted = Object.values(standings).sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.id.localeCompare(b.id);
      });
      const qualifiedId = sorted[0].id;
      const eliminatedIds = sorted.slice(1).map(s => s.id);
      await supabaseAdmin.from('nation_claims').update({ status: 'qualified' }).eq('id', qualifiedId);
      if (eliminatedIds.length > 0) {
        await supabaseAdmin.from('nation_claims').update({ status: 'eliminated' }).in('id', eliminatedIds);
      }
    }
  } else if (match.stage === 'knockout') {
    // Eliminate loser (unless it's a BYE)
    if (!match.is_bye) {
      await supabaseAdmin.from('nation_claims').update({ status: 'eliminated' }).eq('id', loser_claim_id);
    }

    // Is this the final?
    if (match.round === 1) {
      await supabaseAdmin.from('tournaments').update({ status: 'completed' }).eq('id', match.tournament_id);
    } else {
      // Auto-generate next round match if both sibling matches are verified
      await tryAutoAdvanceKnockout(match, winner_claim_id);
    }
  }
  // For group stage: standings are computed on-the-fly, no claim status change needed
}

async function tryAutoAdvanceKnockout(match: any, winner_claim_id: string) {
  const { round, bracket_slot, tournament_id } = match;
  const next_round = round - 1;
  const next_slot = Math.ceil(bracket_slot / 2);

  // Sibling slot: odd slot pairs with odd+1, even slot pairs with even-1
  const sibling_slot = bracket_slot % 2 === 1 ? bracket_slot + 1 : bracket_slot - 1;

  const { data: siblingMatch } = await supabaseAdmin.from('matches').select('*')
    .eq('tournament_id', tournament_id).eq('stage', 'knockout')
    .eq('round', round).eq('bracket_slot', sibling_slot).maybeSingle();

  if (!siblingMatch || siblingMatch.status !== 'verified') return; // wait for sibling

  const siblingWinner = getMatchWinner(siblingMatch) === 'home'
    ? siblingMatch.home_claim_id : siblingMatch.away_claim_id;

  // Lower bracket_slot (odd) = home in next match
  const oddSlotWinner  = bracket_slot % 2 === 1 ? winner_claim_id : siblingWinner;
  const evenSlotWinner = bracket_slot % 2 === 1 ? siblingWinner   : winner_claim_id;

  // Check next round match doesn't already exist
  const { data: existing } = await supabaseAdmin.from('matches').select('id')
    .eq('tournament_id', tournament_id).eq('stage', 'knockout')
    .eq('round', next_round).eq('bracket_slot', next_slot).maybeSingle();
  if (existing) return;

  await supabaseAdmin.from('matches').insert({
    tournament_id,
    home_claim_id: oddSlotWinner,
    away_claim_id: evenSlotWinner,
    stage: 'knockout', round: next_round, bracket_slot: next_slot,
    status: 'scheduled', is_bye: false, is_prequal: false,
  });
}

// ─── GET /matches ─────────────────────────────────────────────────────────────

router.get('/', verifySession, requireActive, async (req: Request, res: Response) => {
  try {
    const tournament = await getActiveTournament();
    if (!tournament) return res.json({ success: true, data: [] });

    let query = supabaseAdmin.from('matches').select(MATCH_SELECT)
      .eq('tournament_id', tournament.id).order('created_at', { ascending: true });

    if (req.query.stage) query = query.eq('stage', req.query.stage as string);

    const { data: matches, error } = await query;
    if (error) return res.status(500).json({ success: false, error: 'Failed to fetch matches' });

    let result = matches || [];

    if (req.query.my === 'true') {
      const uid = req.user!.id;
      result = result.filter((m: any) => isParticipant(m, uid));
    }

    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /matches/:id ─────────────────────────────────────────────────────────

router.get('/:id', verifySession, requireActive, async (req: Request, res: Response) => {
  const { data: match, error } = await supabaseAdmin.from('matches').select(MATCH_SELECT).eq('id', req.params.id).maybeSingle();
  if (error || !match) return res.status(404).json({ success: false, error: 'Match not found' });

  // Fetch events for this match
  const { data: events } = await supabaseAdmin
    .from('match_events')
    .select('*, player:players(*)')
    .eq('match_id', match.id);

  return res.json({ success: true, data: { ...match, events: events || [] } });
});

// ─── POST /matches/:id/submit-score ──────────────────────────────────────────

router.post('/:id/submit-score', verifySession, requireActive, async (req: Request, res: Response) => {
  try {
    const { data: match, error } = await supabaseAdmin.from('matches').select(MATCH_SELECT).eq('id', req.params.id).maybeSingle();
    if (error || !match) return res.status(404).json({ success: false, error: 'Match not found' });

    const uid = req.user!.id;
    if (!isParticipant(match, uid)) return res.status(403).json({ success: false, error: 'You are not a participant in this match' });
    if (match.status !== 'scheduled') return res.status(400).json({ success: false, error: `Match is already ${match.status}. Cannot submit score.` });
    if (match.is_bye) return res.status(400).json({ success: false, error: 'BYE matches cannot have scores submitted.' });

    const { home_score, away_score, home_pens, away_pens, screenshot_url, events } = req.body as {
      home_score?: number;
      away_score?: number;
      home_pens?: number;
      away_pens?: number;
      screenshot_url?: string;
      events?: Array<{
        claim_id: string;
        player_id: number;
        event_type: 'goal' | 'assist';
      }>;
    };

    if (home_score == null || away_score == null) return res.status(400).json({ success: false, error: 'home_score and away_score are required' });
    if (!Number.isInteger(home_score) || !Number.isInteger(away_score)) return res.status(400).json({ success: false, error: 'Scores must be whole numbers' });
    if (home_score < 0 || away_score < 0) return res.status(400).json({ success: false, error: 'Scores must be 0 or greater' });

    if (!screenshot_url) {
      return res.status(400).json({ success: false, error: 'Result screenshot attachment is required' });
    }

    const isDraw = home_score === away_score;
    const needsPenalties = isDraw && (match.stage === 'pre_qual' || match.stage === 'knockout');

    if (needsPenalties) {
      if (home_pens == null || away_pens == null) {
        return res.status(400).json({ success: false, error: `This match (${match.stage}) cannot end in a draw. Please provide a penalty shootout result.` });
      }
      if (!Number.isInteger(home_pens) || !Number.isInteger(away_pens)) return res.status(400).json({ success: false, error: 'Penalty scores must be whole numbers' });
      if (home_pens < 0 || away_pens < 0) return res.status(400).json({ success: false, error: 'Penalty scores must be 0 or greater' });
      if (home_pens === away_pens) return res.status(400).json({ success: false, error: 'Penalty shootout must have a clear winner (scores cannot be equal)' });
    }

    // Validate events if provided
    if (events) {
      if (!Array.isArray(events)) {
        return res.status(400).json({ success: false, error: 'Events must be an array' });
      }

      let homeEventGoals = 0;
      let awayEventGoals = 0;

      for (const ev of events) {
        if (!ev.claim_id || !ev.player_id || !ev.event_type) {
          return res.status(400).json({ success: false, error: 'Each event must have claim_id, player_id, and event_type' });
        }
        if (ev.event_type !== 'goal' && ev.event_type !== 'assist') {
          return res.status(400).json({ success: false, error: 'event_type must be either goal or assist' });
        }

        if (ev.event_type === 'goal') {
          if (ev.claim_id === match.home_claim_id) {
            homeEventGoals++;
          } else if (ev.claim_id === match.away_claim_id) {
            awayEventGoals++;
          } else {
            return res.status(400).json({ success: false, error: 'Event claim_id does not match home or away team' });
          }
        }
      }

      if (homeEventGoals > home_score) {
        return res.status(400).json({ success: false, error: `Assigned goals (${homeEventGoals}) exceeds home team score (${home_score})` });
      }
      if (awayEventGoals > away_score) {
        return res.status(400).json({ success: false, error: `Assigned goals (${awayEventGoals}) exceeds away team score (${away_score})` });
      }
    }

    const updatePayload: any = {
      home_score, away_score,
      submitted_by: uid,
      status: 'pending_verification',
      screenshot_url: screenshot_url || null,
    };
    if (needsPenalties) { updatePayload.home_pens = home_pens; updatePayload.away_pens = away_pens; }

    const { data: updated, error: upErr } = await supabaseAdmin.from('matches').update(updatePayload).eq('id', match.id).select(MATCH_SELECT).single();
    if (upErr) return res.status(500).json({ success: false, error: 'Failed to submit score' });

    // Save match events
    await supabaseAdmin.from('match_events').delete().eq('match_id', match.id);
    if (events && events.length > 0) {
      const eventsToInsert = events.map(ev => ({
        match_id: match.id,
        claim_id: ev.claim_id,
        player_id: ev.player_id,
        event_type: ev.event_type,
      }));

      const { error: evErr } = await supabaseAdmin.from('match_events').insert(eventsToInsert);
      if (evErr) {
        console.error('[submit-score] Error inserting match events:', evErr);
        return res.status(500).json({ success: false, error: 'Failed to save match statistics' });
      }
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /matches/:id/confirm-score ─────────────────────────────────────────

router.post('/:id/confirm-score', verifySession, requireActive, async (req: Request, res: Response) => {
  try {
    const { data: match } = await supabaseAdmin.from('matches').select(MATCH_SELECT).eq('id', req.params.id).maybeSingle();
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });

    const uid = req.user!.id;
    if (!isParticipant(match, uid)) return res.status(403).json({ success: false, error: 'You are not a participant in this match' });
    if (match.status !== 'pending_verification') return res.status(400).json({ success: false, error: `Match is ${match.status}, not pending verification` });
    if (match.submitted_by === uid) return res.status(403).json({ success: false, error: 'You cannot confirm your own score submission. Wait for your opponent.' });

    const { data: updated } = await supabaseAdmin.from('matches')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', match.id).select().single();

    // Fire post-match logic asynchronously
    resolveAfterVerified(match.id).catch(err => console.error('[resolveAfterVerified]', err));

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /matches/admin/:id/verify ──────────────────────────────────────────

router.post('/admin/:id/verify', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { data: match } = await supabaseAdmin.from('matches').select(MATCH_SELECT).eq('id', req.params.id).maybeSingle();
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });
    if (match.status === 'verified') return res.status(400).json({ success: false, error: 'Match is already verified' });

    const { home_score, away_score, home_pens, away_pens, screenshot_url, events } = req.body as {
      home_score?: number;
      away_score?: number;
      home_pens?: number;
      away_pens?: number;
      screenshot_url?: string;
      events?: Array<{
        claim_id: string;
        player_id: number;
        event_type: 'goal' | 'assist';
      }>;
    };
    if (home_score == null || away_score == null) return res.status(400).json({ success: false, error: 'home_score and away_score are required' });

    const isDraw = home_score === away_score;
    const needsPenalties = isDraw && (match.stage === 'pre_qual' || match.stage === 'knockout');
    if (needsPenalties && (home_pens == null || away_pens == null)) {
      return res.status(400).json({ success: false, error: 'Penalty scores required to determine winner for a drawn pre-qual/knockout match' });
    }
    if (needsPenalties && home_pens === away_pens) {
      return res.status(400).json({ success: false, error: 'Penalty shootout must have a clear winner' });
    }

    // Validate events if provided
    if (events) {
      if (!Array.isArray(events)) {
        return res.status(400).json({ success: false, error: 'Events must be an array' });
      }

      let homeEventGoals = 0;
      let awayEventGoals = 0;

      for (const ev of events) {
        if (ev.event_type === 'goal') {
          if (ev.claim_id === match.home_claim_id) homeEventGoals++;
          else if (ev.claim_id === match.away_claim_id) awayEventGoals++;
        }
      }

      if (homeEventGoals > home_score) {
        return res.status(400).json({ success: false, error: `Assigned goals (${homeEventGoals}) exceeds home team score (${home_score})` });
      }
      if (awayEventGoals > away_score) {
        return res.status(400).json({ success: false, error: `Assigned goals (${awayEventGoals}) exceeds away team score (${away_score})` });
      }
    }

    const updatePayload: any = {
      home_score,
      away_score,
      status: 'verified',
      verified_at: new Date().toISOString(),
      screenshot_url: screenshot_url || match.screenshot_url || null,
    };
    if (needsPenalties) { updatePayload.home_pens = home_pens; updatePayload.away_pens = away_pens; }

    const { data: updated } = await supabaseAdmin.from('matches').update(updatePayload).eq('id', match.id).select().single();

    // Save match events
    await supabaseAdmin.from('match_events').delete().eq('match_id', match.id);
    if (events && events.length > 0) {
      const eventsToInsert = events.map(ev => ({
        match_id: match.id,
        claim_id: ev.claim_id,
        player_id: ev.player_id,
        event_type: ev.event_type,
      }));

      const { error: evErr } = await supabaseAdmin.from('match_events').insert(eventsToInsert);
      if (evErr) {
        console.error('[admin/verify] Error inserting match events:', evErr);
      }
    }

    resolveAfterVerified(match.id).catch(err => console.error('[resolveAfterVerified]', err));

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /matches/admin/:id/reset ───────────────────────────────────────────

router.post('/admin/:id/reset', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { data: match } = await supabaseAdmin.from('matches').select('id,status').eq('id', req.params.id).maybeSingle();
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });

    // Clean up events
    await supabaseAdmin.from('match_events').delete().eq('match_id', match.id);

    const { data: updated } = await supabaseAdmin.from('matches').update({
      status: 'scheduled',
      home_score: null, away_score: null,
      home_pens: null, away_pens: null,
      screenshot_url: null,
      submitted_by: null, verified_at: null,
    }).eq('id', match.id).select().single();

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /matches/:id/messages ────────────────────────────────────────────────

router.get('/:id/messages', verifySession, requireActive, async (req: Request, res: Response) => {
  try {
    const { data: match } = await supabaseAdmin.from('matches').select(MATCH_SELECT).eq('id', req.params.id).maybeSingle();
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });

    const uid = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    if (!isParticipant(match, uid) && !isAdmin) return res.status(403).json({ success: false, error: 'Not authorized to view this match chat' });

    const { data: messages, error } = await supabaseAdmin.from('messages')
      .select('*, users(id, username, display_name)')
      .eq('match_id', match.id).order('created_at', { ascending: true });
    if (error) return res.status(500).json({ success: false, error: 'Failed to fetch messages' });

    return res.json({ success: true, data: messages });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /matches/:id/messages ──────────────────────────────────────────────

router.post('/:id/messages', verifySession, requireActive, async (req: Request, res: Response) => {
  try {
    const { data: match } = await supabaseAdmin.from('matches').select(MATCH_SELECT).eq('id', req.params.id).maybeSingle();
    if (!match) return res.status(404).json({ success: false, error: 'Match not found' });

    const uid = req.user!.id;
    const isAdmin = req.user!.role === 'admin';
    if (!isParticipant(match, uid) && !isAdmin) return res.status(403).json({ success: false, error: 'Not authorized to send messages in this match' });

    const { body, attachment_url } = req.body as { body?: string; attachment_url?: string };
    if (!body?.trim()) return res.status(400).json({ success: false, error: 'Message body cannot be empty' });
    if (body.trim().length > 1000) return res.status(400).json({ success: false, error: 'Message too long (max 1000 characters)' });

    const { data: msg, error } = await supabaseAdmin.from('messages').insert({
      match_id: match.id, sender_id: uid, body: body.trim(),
      ...(attachment_url ? { attachment_url } : {}),
    }).select('*, users(id, username, display_name)').single();
    if (error) return res.status(500).json({ success: false, error: 'Failed to send message' });

    return res.status(201).json({ success: true, data: msg });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
