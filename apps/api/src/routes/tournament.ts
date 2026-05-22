import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { verifySession, requireRole, requireActive } from '../middleware/auth';

const router = Router();

/**
 * POST /tournament/admin/create
 * Admin-only: creates a new tournament
 * Body: { name: string, mode: 'world_cup' | 'ucl' }
 */
router.post('/admin/create', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  const { name, mode } = req.body as { name?: string; mode?: 'world_cup' | 'ucl' };

  if (!name?.trim() || !mode || !['world_cup', 'ucl'].includes(mode)) {
    return res.status(400).json({ success: false, error: 'Name and valid mode (world_cup or ucl) are required' });
  }

  // Deactivate any currently active registration/group_stage tournaments if needed?
  // Let's keep it simple and just create the new tournament.
  const { data: tournament, error } = await supabaseAdmin
    .from('tournaments')
    .insert({
      name: name.trim(),
      mode,
      status: 'registration',
    })
    .select()
    .single();

  if (error) {
    console.error('[tournament/admin/create] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create tournament' });
  }

  return res.status(201).json({ success: true, data: tournament });
});

/**
 * GET /tournament/current
 * Fetches the currently active tournament (not completed).
 * If multiple are active, returns the latest one.
 */
router.get('/current', async (_req: Request, res: Response) => {
  const { data: tournaments, error } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .neq('status', 'completed')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[tournament/current] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch active tournament' });
  }

  if (!tournaments || tournaments.length === 0) {
    return res.json({ success: true, data: null });
  }

  return res.json({ success: true, data: tournaments[0] });
});

/**
 * GET /tournament/nations
 * Lists all nations/clubs for the current active tournament mode,
 * along with all claims made for them.
 */
router.get('/nations', async (_req: Request, res: Response) => {
  // First, get the current tournament
  const { data: tournament, error: tErr } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tErr) {
    console.error('[tournament/nations] Error fetching tournament:', tErr);
    return res.status(500).json({ success: false, error: 'Failed to fetch tournament details' });
  }

  if (!tournament) {
    return res.json({ success: true, data: [] });
  }

  // Fetch all nations matching this mode
  const { data: nations, error: nErr } = await supabaseAdmin
    .from('nations')
    .select('*')
    .eq('mode', tournament.mode)
    .order('name', { ascending: true });

  if (nErr) {
    console.error('[tournament/nations] Error fetching nations:', nErr);
    return res.status(500).json({ success: false, error: 'Failed to fetch nations catalog' });
  }

  // Fetch all claims for this tournament
  const { data: claims, error: cErr } = await supabaseAdmin
    .from('nation_claims')
    .select(`
      id,
      nation_id,
      user_id,
      status,
      users (
        id,
        username,
        display_name
      )
    `)
    .eq('tournament_id', tournament.id);

  if (cErr) {
    console.error('[tournament/nations] Error fetching claims:', cErr);
    return res.status(500).json({ success: false, error: 'Failed to fetch nation claims' });
  }

  // Map claims to nations
  const nationsWithClaims = nations.map((nation) => {
    const nationClaims = (claims || [])
      .filter((c: any) => c.nation_id === nation.id)
      .map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        status: c.status,
        username: c.users?.username || 'unknown',
        display_name: c.users?.display_name || 'Anonymous',
      }));

    return {
      ...nation,
      claims: nationClaims,
    };
  });

  return res.json({ success: true, data: nationsWithClaims });
});

/**
 * POST /tournament/claim
 * Allows a user to claim a nation for the active tournament
 * Body: { nation_id: string }
 */
router.post('/claim', verifySession, requireActive, async (req: Request, res: Response) => {
  const { nation_id } = req.body as { nation_id?: string };

  if (!nation_id) {
    return res.status(400).json({ success: false, error: 'Nation ID is required' });
  }

  // 1. Get the current active tournament
  const { data: tournament, error: tErr } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tErr || !tournament) {
    return res.status(404).json({ success: false, error: 'No active tournament found' });
  }

  // 2. Validate status is 'registration'
  if (tournament.status !== 'registration') {
    return res.status(400).json({ success: false, error: 'Registration is closed for this tournament' });
  }

  // 3. Verify nation exists and matches mode
  const { data: nation, error: nErr } = await supabaseAdmin
    .from('nations')
    .select('*')
    .eq('id', nation_id)
    .eq('mode', tournament.mode)
    .maybeSingle();

  if (nErr || !nation) {
    return res.status(400).json({ success: false, error: 'Invalid nation for this tournament mode' });
  }

  // 4. Check if the user already has a claim in this tournament
  const { data: existingClaim, error: cErr } = await supabaseAdmin
    .from('nation_claims')
    .select('id')
    .eq('tournament_id', tournament.id)
    .eq('user_id', req.user!.id)
    .maybeSingle();

  if (cErr) {
    return res.status(500).json({ success: false, error: 'Failed to verify existing claims' });
  }

  if (existingClaim) {
    return res.status(400).json({ success: false, error: 'You have already claimed a nation in this tournament' });
  }

  // 5. Insert the new claim
  const { data: newClaim, error: insertErr } = await supabaseAdmin
    .from('nation_claims')
    .insert({
      tournament_id: tournament.id,
      nation_id: nation.id,
      user_id: req.user!.id,
      status: 'pending',
    })
    .select()
    .single();

  if (insertErr) {
    console.error('[tournament/claim] Insert claim failed:', insertErr);
    return res.status(500).json({ success: false, error: 'Failed to submit nation claim' });
  }

  return res.status(201).json({ success: true, data: newClaim });
});

export default router;
