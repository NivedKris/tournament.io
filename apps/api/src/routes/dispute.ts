import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { verifySession, requireActive, requireRole } from '../middleware/auth';
import { resolveAfterVerified } from './match';

const router = Router();

// Helper to get active dispute for a match
async function getOpenDispute(matchId: string) {
  const { data } = await supabaseAdmin
    .from('disputes')
    .select('*')
    .eq('match_id', matchId)
    .eq('status', 'open')
    .maybeSingle();
  return data;
}

// Helper to check if a user is a participant in a match
async function isMatchParticipant(matchId: string, userId: string): Promise<boolean> {
  const { data: match } = await supabaseAdmin
    .from('matches')
    .select(`
      id,
      home_claim:nation_claims!matches_home_claim_id_fkey(user_id),
      away_claim:nation_claims!matches_away_claim_id_fkey(user_id)
    `)
    .eq('id', matchId)
    .maybeSingle();

  if (!match) return false;
  const homeUserId = (match.home_claim as any)?.user_id;
  const awayUserId = (match.away_claim as any)?.user_id;
  return homeUserId === userId || awayUserId === userId;
}

// ─── POST /matches/:id/dispute ──────────────────────────────────────────────
router.post('/:id/dispute', verifySession, requireActive, async (req: Request, res: Response) => {
  try {
    const matchId = req.params.id;
    const userId = req.user!.id;
    const { comment } = req.body as { comment?: string };

    if (!comment || typeof comment !== 'string' || comment.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Dispute comment/reason is required' });
    }
    if (comment.length > 500) {
      return res.status(400).json({ success: false, error: 'Dispute comment must be 500 characters or less' });
    }

    // Check participant
    const isParticipant = await isMatchParticipant(matchId, userId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'You are not a participant in this match' });
    }

    // Fetch match details
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();

    if (!match) {
      return res.status(404).json({ success: false, error: 'Match not found' });
    }

    if (match.tenant_id !== req.tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied: Match belongs to another organization' });
    }

    if (match.status !== 'pending_verification') {
      return res.status(400).json({ success: false, error: 'Match cannot be disputed. Status must be pending_verification.' });
    }

    if (match.submitted_by === userId) {
      return res.status(400).json({ success: false, error: 'You cannot dispute your own score submission. Only your opponent can raise a dispute.' });
    }

    // Check if an open dispute already exists
    const activeDispute = await getOpenDispute(matchId);
    if (activeDispute) {
      return res.status(400).json({ success: false, error: 'A dispute is already open for this match.' });
    }

    // Update match status to disputed
    const { error: matchUpdateErr } = await supabaseAdmin
      .from('matches')
      .update({ status: 'disputed' })
      .eq('id', matchId);

    if (matchUpdateErr) throw matchUpdateErr;

    // Create dispute row
    const { data: dispute, error: disputeErr } = await supabaseAdmin
      .from('disputes')
      .insert({
        match_id: matchId,
        raised_by: userId,
        comment: comment.trim(),
        status: 'open',
        tenant_id: match.tenant_id
      })
      .select()
      .single();

    if (disputeErr) throw disputeErr;

    return res.json({ success: true, data: { match: { ...match, status: 'disputed' }, dispute } });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /matches/:id/withdraw-dispute ──────────────────────────────────────
router.post('/:id/withdraw-dispute', verifySession, requireActive, async (req: Request, res: Response) => {
  try {
    const matchId = req.params.id;
    const userId = req.user!.id;

    // Check if dispute exists and was raised by current user
    const dispute = await getOpenDispute(matchId);
    if (!dispute) {
      return res.status(404).json({ success: false, error: 'No open dispute found for this match.' });
    }

    if (dispute.tenant_id !== req.tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied: Dispute belongs to another organization' });
    }

    if (dispute.raised_by !== userId) {
      return res.status(403).json({ success: false, error: 'Only the user who raised the dispute can withdraw it.' });
    }

    // Transition match to verified
    const { data: match, error: matchUpdateErr } = await supabaseAdmin
      .from('matches')
      .update({
        status: 'verified',
        verified_at: new Date().toISOString()
      })
      .eq('id', matchId)
      .select()
      .single();

    if (matchUpdateErr) throw matchUpdateErr;

    // Resolve dispute record
    const { error: disputeUpdateErr } = await supabaseAdmin
      .from('disputes')
      .update({
        status: 'resolved',
        resolution: 'Withdrawn by disputing player',
        resolved_by: userId,
        resolved_at: new Date().toISOString()
      })
      .eq('id', dispute.id);

    if (disputeUpdateErr) throw disputeUpdateErr;

    // Trigger tournament stats and progression
    await resolveAfterVerified(matchId, req);

    return res.json({ success: true, data: match });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /matches/admin/:id/resolve-dispute ──────────────────────────────────
router.post('/admin/:id/resolve-dispute', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const matchId = req.params.id;
    const adminId = req.user!.id;
    const { action, comment, home_score, away_score, home_pens, away_pens, screenshot_url, events } = req.body as {
      action: 'confirm' | 'override' | 'reset';
      comment?: string;
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

    if (!['confirm', 'override', 'reset'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid resolution action. Must be confirm, override, or reset.' });
    }

    // Check if open dispute exists
    const dispute = await getOpenDispute(matchId);
    if (!dispute) {
      return res.status(404).json({ success: false, error: 'No open dispute found for this match.' });
    }

    // Get match data
    const { data: match } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .maybeSingle();

    if (!match) {
      return res.status(404).json({ success: false, error: 'Match not found.' });
    }

    if (match.tenant_id !== req.tenantId) {
      return res.status(403).json({ success: false, error: 'Access denied: Match belongs to another organization' });
    }

    if (action === 'confirm') {
      // 1. Confirm original score
      const { data: updatedMatch, error: matchUpdateErr } = await supabaseAdmin
        .from('matches')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString()
        })
        .eq('id', matchId)
        .select()
        .single();

      if (matchUpdateErr) throw matchUpdateErr;

      // Resolve dispute record
      const { error: disputeUpdateErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: 'resolved',
          resolution: comment || 'Admin confirmed originally submitted score',
          resolved_by: adminId,
          resolved_at: new Date().toISOString()
        })
        .eq('id', dispute.id);

      if (disputeUpdateErr) throw disputeUpdateErr;

      // Trigger consequences (advance bracket, qualify etc.)
      await resolveAfterVerified(matchId, req);

      return res.json({ success: true, data: updatedMatch });

    } else if (action === 'reset') {
      // 2. Reset match completely
      // Delete associated match events first
      await supabaseAdmin.from('match_events').delete().eq('match_id', matchId);

      const { data: updatedMatch, error: matchUpdateErr } = await supabaseAdmin
        .from('matches')
        .update({
          status: 'scheduled',
          home_score: null,
          away_score: null,
          home_pens: null,
          away_pens: null,
          screenshot_url: null,
          submitted_by: null,
          verified_at: null
        })
        .eq('id', matchId)
        .select()
        .single();

      if (matchUpdateErr) throw matchUpdateErr;

      // Resolve dispute
      const { error: disputeUpdateErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: 'resolved',
          resolution: comment || 'Admin reset match for replay',
          resolved_by: adminId,
          resolved_at: new Date().toISOString()
        })
        .eq('id', dispute.id);

      if (disputeUpdateErr) throw disputeUpdateErr;

      return res.json({ success: true, data: updatedMatch });

    } else if (action === 'override') {
      // 3. Override match with different score/stats
      if (home_score == null || away_score == null) {
        return res.status(400).json({ success: false, error: 'home_score and away_score are required for override.' });
      }

      const isDraw = home_score === away_score;
      const needsPenalties = isDraw && (match.stage === 'pre_qual' || match.stage === 'knockout');
      if (needsPenalties && (home_pens == null || away_pens == null)) {
        return res.status(400).json({ success: false, error: 'Penalty scores required for tiebreakers in pre-qual/knockout stages.' });
      }
      if (needsPenalties && home_pens === away_pens) {
        return res.status(400).json({ success: false, error: 'Penalty shootout must have a clear winner' });
      }

      // Check events if provided
      if (events) {
        if (!Array.isArray(events)) {
          return res.status(400).json({ success: false, error: 'Events must be an array.' });
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
        screenshot_url: screenshot_url || match.screenshot_url || null
      };
      if (needsPenalties) {
        updatePayload.home_pens = home_pens;
        updatePayload.away_pens = away_pens;
      }

      const { data: updatedMatch, error: matchUpdateErr } = await supabaseAdmin
        .from('matches')
        .update(updatePayload)
        .eq('id', matchId)
        .select()
        .single();

      if (matchUpdateErr) throw matchUpdateErr;

      // Handle match events
      await supabaseAdmin.from('match_events').delete().eq('match_id', matchId);
      if (events && events.length > 0) {
        const eventsToInsert = events.map(ev => ({
          match_id: matchId,
          claim_id: ev.claim_id,
          player_id: ev.player_id,
          event_type: ev.event_type
        }));
        const { error: evInsertErr } = await supabaseAdmin.from('match_events').insert(eventsToInsert);
        if (evInsertErr) throw evInsertErr;
      }

      // Resolve dispute
      const { error: disputeUpdateErr } = await supabaseAdmin
        .from('disputes')
        .update({
          status: 'resolved',
          resolution: comment || 'Admin overrode score and stats',
          resolved_by: adminId,
          resolved_at: new Date().toISOString()
        })
        .eq('id', dispute.id);

      if (disputeUpdateErr) throw disputeUpdateErr;

      // Trigger standings & tournament progression
      await resolveAfterVerified(matchId, req);

      return res.json({ success: true, data: updatedMatch });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
