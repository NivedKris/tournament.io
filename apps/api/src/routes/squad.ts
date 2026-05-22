import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { verifySession, requireActive } from '../middleware/auth';

const router = Router();

/**
 * GET /squad/players/search
 * Proxies search to pesmaster.com, deduplicating player card variations by max OVR.
 * Query param: ?q=name
 */
router.get('/players/search', async (req: Request, res: Response) => {
  const query = req.query.q as string;

  if (!query || query.trim().length < 2) {
    return res.json({ success: true, data: [] });
  }

  try {
    const url = `https://www.pesmaster.com/efootball-2022/search/api.php?game=2022&name=${encodeURIComponent(query)}`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({ success: false, error: 'Pesmaster API search failed' });
    }

    const result = (await response.json()) as any;
    const data = result.data || [];

    // Deduplicate cards by player name, keeping the highest overall version
    const dedupedMap = new Map<string, any>();

    for (const player of data) {
      const nameKey = player.name_display || player.name;
      if (!nameKey) continue;

      const existing = dedupedMap.get(nameKey);
      if (!existing || (player.ovr || 0) > (existing.ovr || 0)) {
        dedupedMap.set(nameKey, player);
      }
    }

    const uniquePlayers = Array.from(dedupedMap.values())
      .map((p) => ({
        id: p.id,
        name: p.name_display || p.name,
        positions: p.pos ? [p.pos] : [],
        overall: p.ovr || 0,
        club: p.team_name || null,
        nationality: p.nat_name || null,
        image_url: p.image ? `https://www.pesmaster.com${p.image}` : null,
      }))
      .sort((a, b) => b.overall - a.overall);

    return res.json({ success: true, data: uniquePlayers });
  } catch (error) {
    console.error('[squad/players/search] Error querying Pesmaster:', error);
    return res.status(500).json({ success: false, error: 'Internal error searching player catalog' });
  }
});

/**
 * GET /squad/:claimId
 * Publicly retrieves a squad configuration and player details for a claim.
 */
router.get('/:claimId', async (req: Request, res: Response) => {
  const { claimId } = req.params;

  // 1. Fetch the squad
  const { data: squad, error: sErr } = await supabaseAdmin
    .from('squads')
    .select('*')
    .eq('claim_id', claimId)
    .maybeSingle();

  if (sErr) {
    console.error('[squad/:claimId] Error fetching squad:', sErr);
    return res.status(500).json({ success: false, error: 'Failed to fetch squad details' });
  }

  if (!squad) {
    return res.json({ success: true, data: null });
  }

  // 2. Fetch the player details for all player IDs in the squad
  const playerIds = Object.values(squad.positions).filter(Boolean) as number[];

  let players: any[] = [];
  if (playerIds.length > 0) {
    const { data: dbPlayers, error: pErr } = await supabaseAdmin
      .from('players')
      .select('*')
      .in('id', playerIds);

    if (pErr) {
      console.error('[squad/:claimId] Error fetching players:', pErr);
      return res.status(500).json({ success: false, error: 'Failed to fetch squad players' });
    }
    players = dbPlayers || [];
  }

  // 3. Map players back to their positions in the response
  const positionsWithDetails: Record<string, any> = {};
  for (const [posKey, playerId] of Object.entries(squad.positions)) {
    if (!playerId) {
      positionsWithDetails[posKey] = null;
      continue;
    }
    const playerDetail = players.find((p) => String(p.id) === String(playerId));
    positionsWithDetails[posKey] = playerDetail || { id: playerId, name: 'Unknown Player' };
  }

  return res.json({
    success: true,
    data: {
      ...squad,
      positions: positionsWithDetails,
    },
  });
});

/**
 * POST /squad
 * Saves/updates a user's squad. Upserts player cards into local DB.
 * Body: {
 *   formation: string,
 *   positions: { [posLabel]: PlayerObject }
 * }
 */
router.post('/', verifySession, requireActive, async (req: Request, res: Response) => {
  const { formation, positions, coordinates } = req.body as {
    formation?: string;
    positions?: Record<string, any>;
    coordinates?: Record<string, { x: number; y: number }>;
  };

  if (!formation || !positions || typeof positions !== 'object') {
    return res.status(400).json({ success: false, error: 'Formation and positions mapping are required' });
  }

  // 1. Fetch current active tournament & user's claim
  const { data: tournament, error: tErr } = await supabaseAdmin
    .from('tournaments')
    .select('id, status')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tErr || !tournament) {
    return res.status(404).json({ success: false, error: 'No active tournament found' });
  }

  const { data: claim, error: cErr } = await supabaseAdmin
    .from('nation_claims')
    .select('id, status')
    .eq('tournament_id', tournament.id)
    .eq('user_id', req.user!.id)
    .maybeSingle();

  if (cErr || !claim) {
    return res.status(403).json({ success: false, error: 'You do not have a registered nation claim in this tournament' });
  }

  // 2. Extract selected players and validate
  const squadPlayers = Object.values(positions).filter((p) => p && typeof p === 'object');
  if (squadPlayers.length === 0) {
    return res.status(400).json({ success: false, error: 'Squad must contain at least one player' });
  }

  // 3. Upsert players to local DB
  const playersToUpsert = squadPlayers.map((p: any) => ({
    id: p.id,
    name: p.name,
    positions: Array.isArray(p.positions) ? p.positions : [p.positions || ''],
    overall: p.overall || p.ovr || 0,
    club: p.club || p.team_name || null,
    nationality: p.nationality || p.nat_name || null,
    image_url: p.image_url || (p.image ? `https://www.pesmaster.com${p.image}` : null),
  }));

  const { error: upsertErr } = await supabaseAdmin
    .from('players')
    .upsert(playersToUpsert, { onConflict: 'id' });

  if (upsertErr) {
    console.error('[squad/save] Error upserting players:', upsertErr);
    return res.status(500).json({ success: false, error: 'Failed to sync squad players database' });
  }

  // 4. Map the positions JSON for saving (map label -> player ID bigint)
  const squadPositionsMapping: Record<string, number> = {};
  for (const [posLabel, playerObj] of Object.entries(positions)) {
    squadPositionsMapping[posLabel] = playerObj ? playerObj.id : null;
  }

  // 5. Save the squad configuration
  const { data: savedSquad, error: sErr } = await supabaseAdmin
    .from('squads')
    .upsert(
      {
        user_id: req.user!.id,
        tournament_id: tournament.id,
        claim_id: claim.id,
        formation,
        positions: squadPositionsMapping,
        coordinates: coordinates || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'claim_id' }
    )
    .select()
    .single();

  if (sErr) {
    console.error('[squad/save] Error saving squad:', sErr);
    return res.status(500).json({ success: false, error: 'Failed to save squad configuration' });
  }

  return res.json({ success: true, data: savedSquad });
});

export default router;
