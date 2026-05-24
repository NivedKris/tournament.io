import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { verifySession, requireRole, requireActive } from '../middleware/auth';

const router = Router();

// Helper to get active/latest tournament scoped by tenant
async function getActiveTournament(tenantId?: string) {
  const tId = tenantId || '00000000-0000-0000-0000-000000000000';
  const { data: active } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('tenant_id', tId)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active) return active;

  const { data: completed } = await supabaseAdmin
    .from('tournaments')
    .select('*')
    .eq('tenant_id', tId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return completed;
}

// GET /reward — Retrieve active tournament reward
router.get('/', verifySession, async (req: Request, res: Response) => {
  try {
    const tournament = await getActiveTournament(req.tenantId);
    if (!tournament) {
      return res.json({ success: true, data: null });
    }

    const { data: reward, error } = await supabaseAdmin
      .from('tournament_rewards')
      .select('*')
      .eq('tournament_id', tournament.id)
      .maybeSingle();

    if (error) {
      console.error('[GET /reward] Error fetching reward:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch tournament reward' });
    }

    return res.json({ success: true, data: reward || null });
  } catch (err: any) {
    console.error('[GET /reward] Unexpected error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /reward — Upsert tournament reward (Admin only)
router.post('/', verifySession, requireActive, requireRole('admin'), async (req: Request, res: Response) => {
  const { name, image_url, cta_link, cta_text } = req.body as {
    name?: string;
    image_url?: string;
    cta_link?: string;
    cta_text?: string;
  };

  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'Reward name is required' });
  }

  try {
    const tournament = await getActiveTournament(req.tenantId);
    if (!tournament) {
      return res.status(404).json({ success: false, error: 'No active or latest tournament found to attach reward' });
    }

    // Upsert the reward based on tournament_id unique constraint
    const { data: reward, error } = await supabaseAdmin
      .from('tournament_rewards')
      .upsert(
        {
          tournament_id: tournament.id,
          name: name.trim(),
          image_url: image_url || null,
          cta_link: cta_link || null,
          cta_text: cta_text || null,
          tenant_id: req.tenantId || '00000000-0000-0000-0000-000000000000',
        },
        { onConflict: 'tournament_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[POST /reward] Error saving reward:', error);
      return res.status(500).json({ success: false, error: 'Failed to save reward details' });
    }

    return res.json({ success: true, data: reward });
  } catch (err: any) {
    console.error('[POST /reward] Unexpected error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
