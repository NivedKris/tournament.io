import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

/**
 * GET /tenant/resolve/:slug
 * Resolves a tenant by slug. Used by frontend on startup to load branding.
 */
router.get('/resolve/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, logo_url, primary_color, status')
      .eq('slug', slug.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('[tenant/resolve] Error:', error);
      return res.status(500).json({ success: false, error: 'Failed to resolve tenant' });
    }

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    if (tenant.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Tenant is suspended' });
    }

    return res.json({ success: true, data: tenant });
  } catch (err: any) {
    console.error('[tenant/resolve] Unexpected error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * GET /tenant/resolve-id/:id
 * Resolves a tenant by ID. Used for cross-tenant redirection helpers.
 */
router.get('/resolve-id/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, logo_url, primary_color, status')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[tenant/resolve-id] Error:', error);
      return res.status(500).json({ success: false, error: 'Failed to resolve tenant' });
    }

    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    return res.json({ success: true, data: tenant });
  } catch (err: any) {
    console.error('[tenant/resolve-id] Unexpected error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

export default router;
