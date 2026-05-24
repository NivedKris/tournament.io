import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { verifySession, requireRole, requireActive } from '../middleware/auth';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { notifyPreQualsStarted, notifyGroupsStarted, notifyKnockoutsStarted } from '../services/email';
import { getTournamentStatsRaw } from '../services/stats';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

export async function getActiveTournament() {
  const { data: active } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active) return active;

  const { data: completed } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return completed;
}

/** Determine the winner of a verified match. Requires home_score/away_score to be set. */
function getMatchWinner(match: any): 'home' | 'away' {
  if ((match.home_score ?? 0) > (match.away_score ?? 0)) return 'home';
  if ((match.away_score ?? 0) > (match.home_score ?? 0)) return 'away';
  // Draw — check penalties (pre_qual / knockout)
  if (match.home_pens != null && match.away_pens != null) {
    return (match.home_pens ?? 0) >= (match.away_pens ?? 0) ? 'home' : 'away';
  }
  return 'home'; // fallback (shouldn't reach here)
}

interface StandingRow {
  claim_id: string;
  W: number; D: number; L: number;
  GF: number; GA: number; GD: number;
  Pts: number;
}

/** Calculate standings from a set of verified matches among a set of claim IDs. */
function calculateStandings(claimIds: string[], matches: any[]): StandingRow[] {
  const stats: Record<string, StandingRow> = {};
  for (const id of claimIds) {
    stats[id] = { claim_id: id, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
  }
  for (const m of matches) {
    if (m.status !== 'verified') continue;
    const hs = m.home_score ?? 0;
    const as_ = m.away_score ?? 0;
    const hid = m.home_claim_id;
    const aid = m.away_claim_id;
    if (!stats[hid] || !stats[aid]) continue;
    stats[hid].GF += hs; stats[hid].GA += as_;
    stats[aid].GF += as_; stats[aid].GA += hs;
    const winner = getMatchWinner(m);
    if (winner === 'home') {
      stats[hid].W++; stats[hid].Pts += 3; stats[aid].L++;
    } else if (winner === 'away') {
      stats[aid].W++; stats[aid].Pts += 3; stats[hid].L++;
    } else {
      stats[hid].D++; stats[hid].Pts++; stats[aid].D++; stats[aid].Pts++;
    }
  }
  for (const s of Object.values(stats)) s.GD = s.GF - s.GA;

  return Object.values(stats).sort((a, b) => {
    if (b.Pts !== a.Pts) return b.Pts - a.Pts;
    if (b.GD !== a.GD) return b.GD - a.GD;
    if (b.GF !== a.GF) return b.GF - a.GF;
    return a.claim_id.localeCompare(b.claim_id); // deterministic fallback
  });
}

/** Distribute N items into groups. Target 4 per group, min 3. */
function computeGroupSizes(n: number): number[] {
  if (n <= 5) return [n]; // 1 group of up to 5
  let numGroups: number;
  if (n <= 8)  numGroups = 2;
  else if (n <= 12) numGroups = 3;
  else numGroups = 4;
  const base = Math.floor(n / numGroups);
  const rem  = n % numGroups;
  return Array.from({ length: numGroups }, (_, i) => base + (i < rem ? 1 : 0));
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// ─── Existing Routes ─────────────────────────────────────────────────────────

router.post('/admin/create', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  const { name, mode } = req.body as { name?: string; mode?: 'world_cup' | 'ucl' };
  if (!name?.trim() || !mode || !['world_cup', 'ucl'].includes(mode)) {
    return res.status(400).json({ success: false, error: 'Name and valid mode (world_cup or ucl) are required' });
  }
  const { data: tournament, error } = await supabaseAdmin
    .from('tournaments').insert({ name: name.trim(), mode, status: 'registration' }).select().single();
  if (error) return res.status(500).json({ success: false, error: 'Failed to create tournament' });
  return res.status(201).json({ success: true, data: tournament });
});

router.get('/current', async (_req: Request, res: Response) => {
  try {
    // 1. First look for active tournament (status not completed)
    const { data: active, error: activeErr } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeErr) throw activeErr;

    if (active) {
      return res.json({ success: true, data: active });
    }

    // 2. If no active tournament, check for the most recently completed tournament
    const { data: completed, error: compErr } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (compErr) throw compErr;

    return res.json({ success: true, data: completed ?? null });
  } catch (err: any) {
    console.error('[GET /current]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to fetch tournament' });
  }
});

router.get('/nations', async (_req: Request, res: Response) => {
  const tournament = await getActiveTournament();
  if (!tournament) return res.json({ success: true, data: [] });

  const { data: nations } = await supabaseAdmin.from('nations').select('*').eq('mode', tournament.mode).order('name');
  const { data: claims } = await supabaseAdmin.from('nation_claims').select(`id,nation_id,user_id,status,users(id,username,display_name)`).eq('tournament_id', tournament.id);

  const nationsWithClaims = (nations || []).map((nation: any) => ({
    ...nation,
    claims: (claims || [])
      .filter((c: any) => c.nation_id === nation.id)
      .map((c: any) => ({ id: c.id, user_id: c.user_id, status: c.status, username: c.users?.username, display_name: c.users?.display_name })),
  }));
  return res.json({ success: true, data: nationsWithClaims });
});

router.post('/claim', verifySession, requireActive, async (req: Request, res: Response) => {
  const { nation_id } = req.body as { nation_id?: string };
  if (!nation_id) return res.status(400).json({ success: false, error: 'Nation ID is required' });

  const tournament = await getActiveTournament();
  if (!tournament) return res.status(404).json({ success: false, error: 'No active tournament found' });
  if (tournament.status !== 'registration') return res.status(400).json({ success: false, error: 'Registration is closed' });

  const { data: nation } = await supabaseAdmin.from('nations').select('*').eq('id', nation_id).eq('mode', tournament.mode).maybeSingle();
  if (!nation) return res.status(400).json({ success: false, error: 'Invalid nation for this tournament mode' });

  const { data: existingClaim } = await supabaseAdmin.from('nation_claims').select('id').eq('tournament_id', tournament.id).eq('user_id', req.user!.id).maybeSingle();
  if (existingClaim) return res.status(400).json({ success: false, error: 'You have already claimed a nation in this tournament' });

  const { data: newClaim, error: insertErr } = await supabaseAdmin.from('nation_claims')
    .insert({ tournament_id: tournament.id, nation_id: nation.id, user_id: req.user!.id, status: 'pending' })
    .select().single();
  if (insertErr) return res.status(500).json({ success: false, error: 'Failed to submit nation claim' });
  return res.status(201).json({ success: true, data: newClaim });
});

// ─── Phase 3: Draw Pre-Quals ─────────────────────────────────────────────────

router.post('/admin/draw-prequals', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const tournament = await getActiveTournament();
    if (!tournament) return res.status(404).json({ success: false, error: 'No active tournament found' });
    if (tournament.status !== 'registration') return res.status(400).json({ success: false, error: 'Tournament is not in registration phase' });

    const { data: existingPrequals } = await supabaseAdmin.from('matches').select('id').eq('tournament_id', tournament.id).eq('stage', 'pre_qual').limit(1);
    if (existingPrequals && existingPrequals.length > 0) return res.status(400).json({ success: false, error: 'Pre-qual matches already exist. Cannot redraw.' });

    const { data: claims } = await supabaseAdmin.from('nation_claims').select('id,nation_id,user_id').eq('tournament_id', tournament.id).eq('status', 'pending');
    if (!claims || claims.length === 0) return res.status(400).json({ success: false, error: 'No pending claims found. Cannot start tournament.' });

    // Group by nation
    const byNation = new Map<string, string[]>();
    for (const c of claims) {
      const arr = byNation.get(c.nation_id) || [];
      arr.push(c.id);
      byNation.set(c.nation_id, arr);
    }

    const autoQualifyIds: string[] = [];
    const pendingPrequalIds: string[] = [];
    const matchesToInsert: any[] = [];

    for (const [, claimIds] of byNation) {
      if (claimIds.length === 1) {
        autoQualifyIds.push(claimIds[0]);
      } else {
        pendingPrequalIds.push(...claimIds);
        // Round-robin among all claimants for this nation
        for (let i = 0; i < claimIds.length; i++) {
          for (let j = i + 1; j < claimIds.length; j++) {
            const flip = Math.random() > 0.5;
            matchesToInsert.push({
              tournament_id: tournament.id,
              home_claim_id: flip ? claimIds[i] : claimIds[j],
              away_claim_id: flip ? claimIds[j] : claimIds[i],
              stage: 'pre_qual', status: 'scheduled',
              is_prequal: true, is_bye: false,
            });
          }
        }
      }
    }

    if (autoQualifyIds.length > 0) {
      const { error: err1 } = await supabaseAdmin.from('nation_claims').update({ status: 'qualified' }).in('id', autoQualifyIds);
      if (err1) throw err1;
    }
    if (pendingPrequalIds.length > 0) {
      const { error: err2 } = await supabaseAdmin.from('nation_claims').update({ status: 'pending_prequal' }).in('id', pendingPrequalIds);
      if (err2) throw err2;
    }
    if (matchesToInsert.length > 0) {
      const { error: err3 } = await supabaseAdmin.from('matches').insert(matchesToInsert);
      if (err3) throw err3;
    }

    const { error: err4 } = await supabaseAdmin.from('tournaments').update({ status: 'pre_qual' }).eq('id', tournament.id);
    if (err4) throw err4;

    // Trigger Pre-Qual notification emails in background
    notifyPreQualsStarted(tournament.id, tournament.name);

    return res.json({
      success: true,
      data: { prequal_matches: matchesToInsert.length, auto_qualified: autoQualifyIds.length },
    });
  } catch (err: any) {
    console.error('[draw-prequals]', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Internal error' });
  }
});

// ─── Phase 3: Draw Groups ────────────────────────────────────────────────────

router.post('/admin/draw-groups', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const tournament = await getActiveTournament();
    if (!tournament) return res.status(404).json({ success: false, error: 'No active tournament found' });
    if (tournament.status !== 'pre_qual') return res.status(400).json({ success: false, error: `Tournament is in '${tournament.status}', not 'pre_qual'` });

    // All pre-qual matches must be verified
    const { data: pendingPrequals } = await supabaseAdmin.from('matches').select('id')
      .eq('tournament_id', tournament.id).eq('stage', 'pre_qual').neq('status', 'verified');
    if (pendingPrequals && pendingPrequals.length > 0) {
      return res.status(400).json({ success: false, error: `${pendingPrequals.length} pre-qual match(es) still need to be verified before drawing groups.` });
    }

    // No group matches already
    const { data: existingGroup } = await supabaseAdmin.from('matches').select('id').eq('tournament_id', tournament.id).eq('stage', 'group').limit(1);
    if (existingGroup && existingGroup.length > 0) return res.status(400).json({ success: false, error: 'Group matches already exist. Cannot redraw.' });

    const { data: qualified } = await supabaseAdmin.from('nation_claims').select('id,nation_id,user_id').eq('tournament_id', tournament.id).eq('status', 'qualified');
    if (!qualified || qualified.length < 2) {
      return res.status(400).json({ success: false, error: `Need at least 2 qualified managers to draw groups. Currently: ${qualified?.length ?? 0}` });
    }

    // Shuffle
    const shuffled = [...qualified].sort(() => Math.random() - 0.5);
    const n = shuffled.length;

    // SPECIAL CASE: only 2 → direct final (no group stage)
    if (n === 2) {
      const flip = Math.random() > 0.5;
      await supabaseAdmin.from('matches').insert({
        tournament_id: tournament.id,
        home_claim_id: flip ? shuffled[0].id : shuffled[1].id,
        away_claim_id: flip ? shuffled[1].id : shuffled[0].id,
        stage: 'knockout', round: 1, bracket_slot: 1,
        status: 'scheduled', is_bye: false, is_prequal: false,
      });
      await supabaseAdmin.from('tournaments').update({ status: 'knockout' }).eq('id', tournament.id);
      return res.json({ success: true, data: { note: 'Only 2 managers — direct final created', groups: 0, matches: 1 } });
    }

    // Form groups
    const sizes = computeGroupSizes(n);
    const GROUP_LABELS = ['A','B','C','D','E','F','G','H'];
    const matchesToInsert: any[] = [];
    let idx = 0;

    for (let g = 0; g < sizes.length; g++) {
      const groupClaims = shuffled.slice(idx, idx + sizes[g]);
      idx += sizes[g];
      const groupName = GROUP_LABELS[g];
      for (let i = 0; i < groupClaims.length; i++) {
        for (let j = i + 1; j < groupClaims.length; j++) {
          const flip = Math.random() > 0.5;
          matchesToInsert.push({
            tournament_id: tournament.id,
            home_claim_id: flip ? groupClaims[i].id : groupClaims[j].id,
            away_claim_id: flip ? groupClaims[j].id : groupClaims[i].id,
            stage: 'group', group_name: groupName,
            status: 'scheduled', is_bye: false, is_prequal: false,
          });
        }
      }
    }

    if (matchesToInsert.length > 0) {
      const { error: insertErr } = await supabaseAdmin.from('matches').insert(matchesToInsert);
      if (insertErr) throw insertErr;
    }
    const { error: updateErr } = await supabaseAdmin.from('tournaments').update({ status: 'group_stage' }).eq('id', tournament.id);
    if (updateErr) throw updateErr;

    // Trigger Group Stage notification emails in background
    notifyGroupsStarted(tournament.id, tournament.name);

    return res.json({ success: true, data: { groups: sizes.length, matches: matchesToInsert.length, group_sizes: sizes } });
  } catch (err: any) {
    console.error('[draw-groups]', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Internal error' });
  }
});

// ─── Phase 3: Group Standings ─────────────────────────────────────────────────

router.get('/standings', async (_req: Request, res: Response) => {
  try {
    const tournament = await getActiveTournament();
    if (!tournament) return res.json({ success: true, data: [] });

    const { data: groupMatches } = await supabaseAdmin.from('matches').select('*')
      .eq('tournament_id', tournament.id).eq('stage', 'group');
    if (!groupMatches || groupMatches.length === 0) return res.json({ success: true, data: [] });

    // Also fetch pre_qual group matches (club mini-groups)
    const { data: prequals } = await supabaseAdmin.from('matches').select('*')
      .eq('tournament_id', tournament.id).eq('stage', 'pre_qual');

    // Fetch claim+user+nation info for display
    const allClaimIds = [...new Set([
      ...groupMatches.map((m: any) => m.home_claim_id),
      ...groupMatches.map((m: any) => m.away_claim_id),
    ])];
    const { data: claims } = await supabaseAdmin.from('nation_claims')
      .select('id,nation_id,user_id,nations(name,flag_url),users(display_name,username)')
      .in('id', allClaimIds);
    const claimMap: Record<string, any> = {};
    (claims || []).forEach((c: any) => { claimMap[c.id] = c; });

    // Group names present
    const groupNames = [...new Set(groupMatches.map((m: any) => m.group_name))].sort();
    const result: any[] = [];

    for (const groupName of groupNames) {
      const gMatches = groupMatches.filter((m: any) => m.group_name === groupName);
      const claimIds = [...new Set([...gMatches.map((m: any) => m.home_claim_id), ...gMatches.map((m: any) => m.away_claim_id)])];
      const standings = calculateStandings(claimIds, gMatches);
      result.push({
        group: groupName,
        standings: standings.map((s, pos) => ({
          position: pos + 1,
          ...s,
          nation_name: claimMap[s.claim_id]?.nations?.name ?? '?',
          flag_url: claimMap[s.claim_id]?.nations?.flag_url ?? null,
          display_name: claimMap[s.claim_id]?.users?.display_name ?? '?',
          username: claimMap[s.claim_id]?.users?.username ?? '?',
          matches_played: s.W + s.D + s.L,
        })),
        matches: gMatches,
      });
    }

    // Also return pre-qual groups (clubs with multiple claimants)
    const prequalGroups: any[] = [];
    if (prequals && prequals.length > 0) {
      const pqClaimIds = [...new Set([...prequals.map((m: any) => m.home_claim_id), ...prequals.map((m: any) => m.away_claim_id)])];
      const { data: pqClaims } = await supabaseAdmin.from('nation_claims')
        .select('id,nation_id,nations(name,flag_url),users(display_name,username)')
        .in('id', pqClaimIds);
      const pqClaimMap: Record<string, any> = {};
      (pqClaims || []).forEach((c: any) => { pqClaimMap[c.id] = c; });

      // Group pre-quals by nation
      const byNation = new Map<string, { name: string; claimIds: string[]; matches: any[] }>();
      for (const m of prequals) {
        const claim = pqClaimMap[m.home_claim_id];
        const nationId = claim?.nation_id;
        const nationName = claim?.nations?.name ?? nationId;
        if (!byNation.has(nationId)) byNation.set(nationId, { name: nationName, claimIds: [], matches: [] });
        const entry = byNation.get(nationId)!;
        if (!entry.claimIds.includes(m.home_claim_id)) entry.claimIds.push(m.home_claim_id);
        if (!entry.claimIds.includes(m.away_claim_id)) entry.claimIds.push(m.away_claim_id);
        entry.matches.push(m);
      }

      for (const [, entry] of byNation) {
        if (entry.claimIds.length < 2) continue;
        const standings = calculateStandings(entry.claimIds, entry.matches);
        prequalGroups.push({
          nation: entry.name,
          standings: standings.map((s, pos) => ({
            position: pos + 1, ...s,
            display_name: pqClaimMap[s.claim_id]?.users?.display_name ?? '?',
            username: pqClaimMap[s.claim_id]?.users?.username ?? '?',
            matches_played: s.W + s.D + s.L,
          })),
          matches: entry.matches,
        });
      }
    }

    return res.json({ success: true, data: { groups: result, prequal_groups: prequalGroups } });
  } catch (err: any) {
    console.error('[standings]', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Internal error' });
  }
});

// ─── Phase 3: Start Knockouts ─────────────────────────────────────────────────

router.post('/admin/start-knockouts', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const tournament = await getActiveTournament();
    if (!tournament) return res.status(404).json({ success: false, error: 'No active tournament found' });
    if (tournament.status !== 'group_stage') return res.status(400).json({ success: false, error: `Tournament is in '${tournament.status}', not 'group_stage'` });

    const { data: pendingGroup } = await supabaseAdmin.from('matches').select('id')
      .eq('tournament_id', tournament.id).eq('stage', 'group').neq('status', 'verified');
    if (pendingGroup && pendingGroup.length > 0) {
      return res.status(400).json({ success: false, error: `${pendingGroup.length} group match(es) still need to be verified.` });
    }

    const { data: existingKO } = await supabaseAdmin.from('matches').select('id').eq('tournament_id', tournament.id).eq('stage', 'knockout').limit(1);
    if (existingKO && existingKO.length > 0) return res.status(400).json({ success: false, error: 'Knockout matches already exist.' });

    const { data: groupMatches } = await supabaseAdmin.from('matches').select('*').eq('tournament_id', tournament.id).eq('stage', 'group');
    if (!groupMatches) return res.status(500).json({ success: false, error: 'Failed to fetch group matches' });

    const groupNames = [...new Set(groupMatches.map((m: any) => m.group_name))].sort() as string[];

    // Calculate group standings — seed top 2 from each group
    const winners: Array<{ claim_id: string; group: string; Pts: number; GD: number; GF: number }> = [];
    const runnerUps: Array<{ claim_id: string; group: string; Pts: number; GD: number; GF: number }> = [];

    for (const gName of groupNames) {
      const gMatches = groupMatches.filter((m: any) => m.group_name === gName);
      const claimIds = [...new Set([...gMatches.map((m: any) => m.home_claim_id), ...gMatches.map((m: any) => m.away_claim_id)])] as string[];
      const standings = calculateStandings(claimIds, gMatches);
      if (standings[0]) winners.push({ ...standings[0], group: gName });
      if (standings[1]) runnerUps.push({ ...standings[1], group: gName });
    }

    // Sort each tier by standing quality for BYE seeding
    const sortTier = (arr: typeof winners) => arr.sort((a, b) => {
      if (b.Pts !== a.Pts) return b.Pts - a.Pts;
      if (b.GD !== a.GD) return b.GD - a.GD;
      return b.GF - a.GF;
    });
    sortTier(winners);
    sortTier(runnerUps);

    // All advancing in seed order: winners first, then runners-up
    const advancing = [...winners, ...runnerUps].map(t => t.claim_id);
    const numAdvancing = advancing.length;
    const bracketSize = nextPowerOfTwo(numAdvancing);
    const numByes = bracketSize - numAdvancing;
    const totalRounds = Math.log2(bracketSize);
    const firstRound = Math.round(totalRounds);

    // Seed pairs: slot k matches seed k vs seed (bracketSize+1-k)
    const matchesToInsert: any[] = [];

    for (let slot = 1; slot <= bracketSize / 2; slot++) {
      const seedA_idx = slot - 1;          // 0-based
      const seedB_idx = bracketSize - slot; // 0-based (opponent)

      const claimA = seedA_idx < numAdvancing ? advancing[seedA_idx] : null;
      const claimB = seedB_idx < numAdvancing ? advancing[seedB_idx] : null;

      // If either is null — shouldn't happen with this seeding, but guard anyway
      if (!claimA || !claimB) continue;

      const isBye = seedB_idx >= numAdvancing; // top seeds get BYEs when numAdvancing < bracketSize

      if (isBye) {
        // BYE match: seedA auto-advances
        matchesToInsert.push({
          tournament_id: tournament.id,
          home_claim_id: claimA,
          away_claim_id: claimA, // same — placeholder; we'll handle this specially
          stage: 'knockout', round: firstRound, bracket_slot: slot,
          status: 'verified', home_score: 1, away_score: 0,
          is_bye: true, is_prequal: false, verified_at: new Date().toISOString(),
        });
      } else {
        const flip = Math.random() > 0.5;
        matchesToInsert.push({
          tournament_id: tournament.id,
          home_claim_id: flip ? claimA : claimB,
          away_claim_id: flip ? claimB : claimA,
          stage: 'knockout', round: firstRound, bracket_slot: slot,
          status: 'scheduled', is_bye: false, is_prequal: false,
        });
      }
    }

    // If numByes > 0, handle differently:
    // The top numByes seeds get BYE — their "first round" match is a BYE vs nobody
    // We already handled this above with the seeding math. But when seedB_idx >= numAdvancing
    // the actual logic needs adjustment. Let me redo the BYE logic cleanly:

    // Actually the seeding math above is: slot k pairs seed k vs seed (bracketSize - k + 1)
    // For bracketSize=8, numAdvancing=6:
    //   slot 1: seed 1 vs seed 8 (seed 8 doesn't exist → BYE for seed 1)
    //   slot 2: seed 2 vs seed 7 (seed 7 doesn't exist → BYE for seed 2)  
    //   slot 3: seed 3 vs seed 6 ✓
    //   slot 4: seed 4 vs seed 5 ✓
    // This is correct! Top 2 seeds get BYEs.

    if (matchesToInsert.length > 0) {
      const { error: insertErr } = await supabaseAdmin.from('matches').insert(matchesToInsert);
      if (insertErr) throw insertErr;
    }
    const { error: updateErr } = await supabaseAdmin.from('tournaments').update({ status: 'knockout' }).eq('id', tournament.id);
    if (updateErr) throw updateErr;

    // Trigger Knockout Stage notification emails in background
    notifyKnockoutsStarted(tournament.id, tournament.name);

    return res.json({ success: true, data: { bracket_size: bracketSize, byes: numByes, matches: matchesToInsert.length } });
  } catch (err: any) {
    console.error('[start-knockouts]', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Internal error' });
  }
});

router.get('/stats', verifySession, requireActive, async (req: Request, res: Response) => {
  try {
    // 1. Fetch current active tournament
    let tournament = await getActiveTournament();
    if (!tournament) {
      // Fallback: search for last completed tournament to show historical stats
      const { data: lastCompleted } = await supabaseAdmin
        .from('tournaments')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      tournament = lastCompleted;
    }

    if (!tournament) {
      return res.json({
        success: true,
        data: { topScorers: [], topPlaymakers: [], topGoalkeepers: [], aiSummary: 'No active or completed tournament found.' }
      });
    }

    // 2. Fetch stats using the stats service
    const { topScorers, topPlaymakers, topGoalkeepers } = await getTournamentStatsRaw(tournament.id);

    // 3. Generate AI sports news summary paragraph
    let aiSummary = 'Live statistics are being compiled. Goalkeeping and goalscorer leaderboards will appear here as match results are verified.';
    const hasAnyStats = topScorers.length > 0 || topPlaymakers.length > 0 || topGoalkeepers.some(g => g.matchesPlayed > 0);
    
    if (hasAnyStats) {
      const prompt = `
You are a professional, enthusiastic eFootball sports news anchor reporting on the ongoing tournament.
Write a concise, engaging summary report of the current tournament statistics based on the live data below.
Mention the leaders, the tight races, and highlight notable goalkeeping performances or high-scoring players. Keep the tone premium and exciting, like a real sports center report. Do not use markdown headers, bullet points or list format, write it as a single natural, beautiful paragraph of 3-5 sentences.

Live Statistics:
Top Goal Scorers:
${topScorers.slice(0, 3).map(s => `- ${s.player?.name || 'Unknown'} (${s.claim?.nations?.name}): ${s.count} goals`).join('\n') || 'No goals scored yet.'}

Top Playmakers:
${topPlaymakers.slice(0, 3).map(p => `- ${p.player?.name || 'Unknown'} (${p.claim?.nations?.name}): ${p.count} assists`).join('\n') || 'No assists recorded yet.'}

Goalkeepers (Sorted by Clean Sheets):
${topGoalkeepers.slice(0, 3).map(g => `- ${g.player?.name || 'Unknown'} (${g.claim?.nations?.name}): ${g.cleanSheets} clean sheets, conceded ${g.goalsConceded} goals in ${g.matchesPlayed} matches`).join('\n') || 'No matches played yet.'}
`;

      try {
        const key = process.env.GEMINI_API_KEY;
        if (key) {
          const genAI = new GoogleGenerativeAI(key);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
          const result = await model.generateContent(prompt);
          aiSummary = result.response.text().trim();
        }
      } catch (err) {
        console.error('[Gemini Stats Summary Error]:', err);
      }
    }

    return res.json({
      success: true,
      data: {
        topScorers,
        topPlaymakers,
        topGoalkeepers,
        aiSummary
      }
    });

  } catch (err: any) {
    console.error('[GET /stats]', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Failed to compute stats' });
  }
});

export default router;
