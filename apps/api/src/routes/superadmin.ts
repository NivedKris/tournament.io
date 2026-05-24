import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { verifySession, requireRole } from '../middleware/auth';

const router = Router();

// Apply auth middlewares to all super-admin endpoints
router.use(verifySession);
router.use(requireRole('super_admin'));

/**
 * GET /super-admin/tenants
 * Lists all tenants in the system.
 */
router.get('/tenants', async (req: Request, res: Response) => {
  try {
    const { data: tenants, error } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[super-admin/tenants] Error fetching tenants:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch tenants' });
    }

    return res.json({ success: true, data: tenants });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * POST /super-admin/tenants
 * Creates a new tenant and designates an admin_email.
 */
router.post('/tenants', async (req: Request, res: Response) => {
  const { name, slug, admin_email, logo_url, primary_color } = req.body as {
    name?: string;
    slug?: string;
    admin_email?: string;
    logo_url?: string;
    primary_color?: string;
  };

  if (!name?.trim() || !slug?.trim() || !admin_email?.trim()) {
    return res.status(400).json({ success: false, error: 'Name, Slug, and Tenant Admin Email are required' });
  }

  // Format slug to lowercase alphanumeric
  const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (cleanSlug.length < 3) {
    return res.status(400).json({ success: false, error: 'Slug must be at least 3 alphanumeric characters' });
  }

  try {
    // Check if slug is taken
    const { data: existingSlug } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle();

    if (existingSlug) {
      return res.status(409).json({ success: false, error: `Slug "${cleanSlug}" is already taken` });
    }

    // Check if admin email is already assigned to a tenant
    const { data: existingEmail } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('admin_email', admin_email.trim().toLowerCase())
      .maybeSingle();

    if (existingEmail) {
      return res.status(409).json({ success: false, error: `Email "${admin_email}" is already assigned to another tenant` });
    }

    // Insert new tenant
    const { data: newTenant, error: insertErr } = await supabaseAdmin
      .from('tenants')
      .insert({
        name: name.trim(),
        slug: cleanSlug,
        admin_email: admin_email.trim().toLowerCase(),
        logo_url: logo_url?.trim() || null,
        primary_color: primary_color?.trim() || '#3b82f6',
        status: 'active'
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[super-admin/tenants] Insert error:', insertErr);
      return res.status(500).json({ success: false, error: 'Failed to create tenant record' });
    }

    // If an existing user matches this admin_email, promote them to admin role & link to this tenant
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', admin_email.trim().toLowerCase())
      .maybeSingle();

    if (existingUser) {
      await supabaseAdmin
        .from('users')
        .update({
          role: 'admin',
          tenant_id: newTenant.id
        })
        .eq('id', existingUser.id);
    }

    return res.status(201).json({ success: true, data: newTenant });
  } catch (err: any) {
    console.error('[super-admin/tenants] Unexpected error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * DELETE /super-admin/tenants/:id
 * Deletes a tenant (cascades database wipe of their data).
 */
router.delete('/tenants/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('tenants')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[super-admin/tenants] Delete error:', error);
      return res.status(500).json({ success: false, error: 'Failed to delete tenant' });
    }

    return res.json({ success: true, message: 'Tenant successfully deleted' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * POST /super-admin/tenants/:id/suspend
 * Toggles suspension state of a tenant.
 */
router.post('/tenants/:id/suspend', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status: 'active' | 'suspended' };

  if (status !== 'active' && status !== 'suspended') {
    return res.status(400).json({ success: false, error: 'Invalid tenant status' });
  }

  try {
    const { data: updated, error } = await supabaseAdmin
      .from('tenants')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[super-admin/tenants] Status update error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update tenant status' });
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

export default router;
