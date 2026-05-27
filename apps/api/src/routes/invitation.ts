import { Router, Request, Response } from 'express';
import { supabaseAdmin, getFrontendUrl } from '../lib/supabase';
import { verifySession } from '../middleware/auth';
import { sendTenantInvitationEmail } from '../services/email';

const router = Router();

/**
 * GET /tenant/invitations/resolve/:id
 * Public endpoint to fetch details of a specific invitation before accepting it.
 */
router.get('/resolve/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from('tenant_invitations')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (inviteErr || !invite) {
      return res.status(404).json({ success: false, error: 'Invitation not found or expired' });
    }

    if (invite.status === 'joined') {
      return res.status(400).json({ success: false, error: 'Invitation has already been accepted' });
    }

    // Resolve tenant details
    const { data: tenant, error: tenantErr } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, logo_url, primary_color')
      .eq('id', invite.tenant_id)
      .maybeSingle();

    if (tenantErr || !tenant) {
      return res.status(404).json({ success: false, error: 'Tournament tenant not found' });
    }

    return res.json({
      success: true,
      data: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logo_url: tenant.logo_url,
          primary_color: tenant.primary_color
        }
      }
    });
  } catch (err: any) {
    console.error('[invitations/resolve] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /tenant/invitations
 * Admin endpoint to list all invitations for the tenant.
 */
router.get('/', verifySession, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  const tenantId = user.tenant_id;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: 'No active tenant context found' });
  }

  try {
    const { data: invites, error } = await supabaseAdmin
      .from('tenant_invitations')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[invitations/list] Error:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch invitations' });
    }

    return res.json({ success: true, data: invites });
  } catch (err: any) {
    console.error('[invitations/list] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /tenant/invitations
 * Admin endpoint to create a single player/admin invitation.
 */
router.post('/', verifySession, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  const tenantId = user.tenant_id;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: 'No active tenant context found' });
  }

  const { email, role = 'player' } = req.body as { email?: string; role?: 'player' | 'admin' };
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();

    // Create the invitation record in Supabase
    const { data: invite, error } = await supabaseAdmin
      .from('tenant_invitations')
      .insert({
        email: normalizedEmail,
        tenant_id: tenantId,
        role,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: 'User is already invited to this organization' });
      }
      console.error('[invitations/create] Error:', error);
      return res.status(500).json({ success: false, error: 'Failed to create invitation' });
    }

    // Retrieve tenant brand parameters (name, logo, color)
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name, slug, logo_url, primary_color')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenant) {
      // Send the beautifully formatted, brand-styled email via Brevo
      await sendTenantInvitationEmail(normalizedEmail, invite.id, tenant, role);
    } else {
      // Fallback log
      const frontendUrl = getFrontendUrl(req);
      const inviteLink = `${frontendUrl}/invite/${invite.id}`;
      console.log('\n========================================');
      console.log('[MOCK EMAIL SENT]');
      console.log(`To:      ${normalizedEmail}`);
      console.log(`Subject: Invite to join tournament`);
      console.log(`Link:    ${inviteLink}`);
      console.log('========================================\n');
    }

    return res.status(201).json({ success: true, data: invite });
  } catch (err: any) {
    console.error('[invitations/create] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /tenant/invitations/bulk
 * Admin endpoint to send invitations to a list of emails (e.g. from CSV).
 */
router.post('/bulk', verifySession, async (req: Request, res: Response) => {
  const user = req.user;
  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  const tenantId = user.tenant_id;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: 'No active tenant context found' });
  }

  const { emails, role = 'player' } = req.body as { emails?: string[]; role?: 'player' | 'admin' };
  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ success: false, error: 'A non-empty list of emails is required' });
  }

  try {
    const records = emails.map(email => ({
      email: email.trim().toLowerCase(),
      tenant_id: tenantId,
      role,
      status: 'pending'
    }));

    const { data: inserted, error } = await supabaseAdmin
      .from('tenant_invitations')
      .insert(records)
      .select();

    if (error) {
      console.error('[invitations/bulk] Error:', error);
      return res.status(500).json({ success: false, error: 'Failed to create bulk invitations' });
    }

    // Retrieve tenant brand parameters (name, logo, color)
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('name, slug, logo_url, primary_color')
      .eq('id', tenantId)
      .maybeSingle();

    if (tenant) {
      // Fire and forget dispatch of bulk emails in the background
      (async () => {
        for (const inv of inserted) {
          try {
            await sendTenantInvitationEmail(inv.email, inv.id, tenant, role);
            // Throttle slightly to respect Brevo connection limit
            await new Promise((resolve) => setTimeout(resolve, 200));
          } catch (mailErr) {
            console.error(`[invitations/bulk] Failed to email ${inv.email}:`, mailErr);
          }
        }
      })();
    } else {
      const frontendUrl = getFrontendUrl(req);
      console.log('\n========================================');
      console.log(`[MOCK BULK EMAILS SENT] Count: ${inserted.length}`);
      for (const inv of inserted) {
        const inviteLink = `${frontendUrl}/invite/${inv.id}`;
        console.log(`- To: ${inv.email} | Link: ${inviteLink}`);
      }
      console.log('========================================\n');
    }

    return res.status(201).json({ success: true, data: { count: inserted.length } });
  } catch (err: any) {
    console.error('[invitations/bulk] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * DELETE /tenant/invitations/:id
 * Admin endpoint to revoke/delete an invitation.
 */
router.delete('/:id', verifySession, async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  const tenantId = user.tenant_id;
  if (!tenantId) {
    return res.status(400).json({ success: false, error: 'No active tenant context found' });
  }

  try {
    // 1. Fetch the invitation to get the email address
    const { data: invite, error: getErr } = await supabaseAdmin
      .from('tenant_invitations')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (getErr || !invite) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    // 2. Delete the invitation
    const { error: delInviteErr } = await supabaseAdmin
      .from('tenant_invitations')
      .delete()
      .eq('id', id);

    if (delInviteErr) {
      console.error('[invitations/delete] Error deleting invite:', delInviteErr);
      return res.status(500).json({ success: false, error: 'Failed to revoke invitation' });
    }

    // 3. Find if user exists with this email, and revoke their membership as well
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', invite.email.toLowerCase())
      .maybeSingle();

    if (targetUser) {
      const { error: delMemErr } = await supabaseAdmin
        .from('tenant_memberships')
        .delete()
        .eq('user_id', targetUser.id)
        .eq('tenant_id', tenantId);

      if (delMemErr) {
        console.error('[invitations/delete] Error deleting membership:', delMemErr);
      }

      // Also reset their active tenant_id if they are currently inside this tenant
      await supabaseAdmin
        .from('users')
        .update({ tenant_id: null })
        .eq('id', targetUser.id)
        .eq('tenant_id', tenantId);
    }

    return res.json({ success: true, message: 'Invitation revoked successfully' });
  } catch (err: any) {
    console.error('[invitations/delete] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
