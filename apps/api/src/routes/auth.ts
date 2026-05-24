import { Router, Request, Response } from 'express';
import { supabaseAdmin, buildAuthClient } from '../lib/supabase';
import { verifySession } from '../middleware/auth';

const router = Router();

/**
 * GET /auth/google
 * Redirects the browser to Google's OAuth consent page via Supabase.
 */
router.get('/google', async (_req: Request, res: Response) => {
  const authClient = buildAuthClient();
  const { data, error } = await authClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error || !data.url) {
    return res.status(500).json({ success: false, error: 'Failed to generate OAuth URL' });
  }

  return res.redirect(data.url);
});

// Determines the tenant and role of a user based on enrolled admin emails and super admin configs
async function determineUserRoleAndTenant(email?: string, defaultTenantId: string = '00000000-0000-0000-0000-000000000000') {
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'superadmin@gmail.com').toLowerCase();
  const userEmail = email?.toLowerCase();
  
  let role = 'player';
  let tenantId = defaultTenantId;

  if (userEmail === superAdminEmail) {
    role = 'super_admin';
  } else if (userEmail) {
    const { data: matchedTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('admin_email', userEmail)
      .maybeSingle();

    if (matchedTenant) {
      role = 'admin';
      tenantId = matchedTenant.id;
    }
  }
  return { role, tenantId };
}

async function convertInvitationsToMemberships(userId: string, email: string) {
  try {
    // 1. Fetch pending invitations for this email
    const { data: invites } = await supabaseAdmin
      .from('tenant_invitations')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending');

    if (invites && invites.length > 0) {
      for (const invite of invites) {
        // Insert into tenant_memberships
        await supabaseAdmin
          .from('tenant_memberships')
          .upsert(
            { user_id: userId, tenant_id: invite.tenant_id, role: invite.role },
            { onConflict: 'user_id, tenant_id', ignoreDuplicates: true }
          );

        // Mark invite as joined
        await supabaseAdmin
          .from('tenant_invitations')
          .update({ status: 'joined' })
          .eq('id', invite.id);
      }
    }

    // 2. Also check if the email matches any tenant's admin_email
    const { data: adminTenants } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('admin_email', email.toLowerCase());

    if (adminTenants && adminTenants.length > 0) {
      for (const t of adminTenants) {
        await supabaseAdmin
          .from('tenant_memberships')
          .upsert(
            { user_id: userId, tenant_id: t.id, role: 'admin' },
            { onConflict: 'user_id, tenant_id', ignoreDuplicates: true }
          );
      }
    }
  } catch (err) {
    console.error('[convertInvitationsToMemberships] Error converting invites:', err);
  }
}

/**
 * POST /auth/session
 * Called by the frontend after Supabase handles the OAuth callback and
 * returns the session tokens. We upsert the user record on first login.
 * Body: { access_token }
 */
router.post('/session', async (req: Request, res: Response) => {
  const { access_token, targetTenantSlug } = req.body as { access_token?: string; targetTenantSlug?: string };

  if (!access_token) {
    return res.status(400).json({ success: false, error: 'access_token is required' });
  }

  // Verify the token is legit
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);

  if (error || !user) {
    return res.status(401).json({ success: false, error: 'Invalid access token' });
  }

  const email = user.email || '';
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || 'mark.organisation@gmail.com').toLowerCase();
  const isSuperAdmin = email.toLowerCase() === superAdminEmail;
  const googleId = user.user_metadata?.sub ?? user.id;

  // 1. Check if user already exists by ID
  let { data: existingById } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // 2. If not found by ID, check by google_id to map UUID mismatch if any
  if (!existingById) {
    const { data: existingByGoogle } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .maybeSingle();

    if (existingByGoogle) {
      // Sync the user's Supabase auth ID to their profile record
      const { data: updated, error: updateErr } = await supabaseAdmin
        .from('users')
        .update({ id: user.id, email })
        .eq('google_id', googleId)
        .select()
        .single();

      if (updateErr) {
        console.error('[auth/session] Failed to sync user ID:', updateErr);
        return res.status(500).json({ success: false, error: 'Failed to sync user ID record' });
      }
      existingById = updated;
    } else {
      // Create a new user profile record
      const displayName = user.user_metadata?.full_name ?? '';
      const username = `google_${user.id.replace(/-/g, '').substring(0, 10)}`;

      const { data: created, error: createErr } = await supabaseAdmin
        .from('users')
        .upsert(
          {
            id: user.id,
            google_id: googleId,
            email,
            display_name: displayName,
            username,
            role: 'player', // placeholder role initially
            tenant_id: null,
            is_suspended: false,
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (createErr) {
        console.error('[auth/session] Failed to create/upsert user:', createErr);
        return res.status(500).json({ success: false, error: 'Failed to create user record' });
      }
      existingById = created;
    }
  } else if (!existingById.email && email) {
    // If the user exists by ID but email was not set, sync it
    const { data: updated } = await supabaseAdmin
      .from('users')
      .update({ email })
      .eq('id', user.id)
      .select()
      .single();
    if (updated) {
      existingById = updated;
    }
  }

  // 3. Convert any pending invitations or register tenant admin memberships
  // Now that the user record definitely exists in public.users, this won't violate key constraints!
  if (email) {
    await convertInvitationsToMemberships(user.id, email);
  }

  // 4. Determine user roles & active tenant selection based on memberships
  let requireTenantSelection = false;
  let finalRole = 'player';
  let finalTenantId: string | null = null;
  let enrolledTenants: any[] = [];

  if (isSuperAdmin) {
    finalRole = 'super_admin';
    finalTenantId = null;
  } else {
    // Query active memberships with tenant metadata
    const { data: memberships, error: memErr } = await supabaseAdmin
      .from('tenant_memberships')
      .select('role, tenant_id, tenants (id, name, slug, logo_url)')
      .eq('user_id', user.id) as any;

    if (memErr) {
      console.error('[auth/session] Failed to query memberships:', memErr);
      return res.status(500).json({ success: false, error: 'Failed to verify tournament invitations' });
    }

    if (!memberships || memberships.length === 0) {
      return res.status(403).json({ 
        success: false, 
        error: 'no_invitations', 
        message: 'You have not been invited to any tournament. Please contact your coordinator.' 
      });
    }

    enrolledTenants = memberships.map((m: any) => ({
      role: m.role,
      id: m.tenant_id,
      name: m.tenants?.name || 'Tournament Arena',
      slug: m.tenants?.slug || 'default',
      logo_url: m.tenants?.logo_url
    }));

    let targetTenantId: string | null = null;
    if (targetTenantSlug) {
      const { data: targetTenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('slug', targetTenantSlug)
        .maybeSingle();
      if (targetTenant) {
        targetTenantId = targetTenant.id;
      }
    }

    if (memberships.length === 1) {
      finalRole = memberships[0].role;
      finalTenantId = memberships[0].tenant_id;
    } else {
      if (targetTenantId) {
        // If they just accepted an invitation, prioritize and route directly to that target tenant
        const currentMembership = memberships.find((m: any) => m.tenant_id === targetTenantId);
        if (currentMembership) {
          finalRole = currentMembership.role;
          finalTenantId = currentMembership.tenant_id;
        } else {
          requireTenantSelection = true;
          finalTenantId = null;
        }
      } else {
        // Normal login: if in multiple tournaments, always force them to choose which tournament portal to enter
        requireTenantSelection = true;
        finalTenantId = null;
      }
    }
  }

  // 5. Update user profile with final determined role & active tenant ID
  const updateFields: any = { role: finalRole };
  if (!requireTenantSelection) {
    updateFields.tenant_id = finalTenantId;
  }

  const { data: finalUser, error: finalErr } = await supabaseAdmin
    .from('users')
    .update(updateFields)
    .eq('id', user.id)
    .select()
    .single();

  if (finalErr || !finalUser) {
    console.error('[auth/session] Failed to update final user properties:', finalErr);
    return res.status(500).json({ success: false, error: 'Failed to complete session setup' });
  }

  return res.json({
    success: true,
    data: {
      user: finalUser,
      requireTenantSelection,
      tenants: enrolledTenants
    }
  });
});

/**
 * POST /auth/select-tenant
 * Updates user session with active tournament portal choice
 */
router.post('/select-tenant', verifySession, async (req: Request, res: Response) => {
  const { tenantId } = req.body as { tenantId?: string };
  const userId = req.user?.id;

  if (!tenantId || !userId) {
    return res.status(400).json({ success: false, error: 'tenantId is required' });
  }

  try {
    // Verify membership
    const { data: membership, error: memErr } = await supabaseAdmin
      .from('tenant_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (memErr || !membership) {
      return res.status(403).json({ success: false, error: 'You do not belong to this organization' });
    }

    // Update active portal tenant and role mapping
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('users')
      .update({
        tenant_id: tenantId,
        role: membership.role
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateErr) {
      console.error('[select-tenant] Error selecting tenant:', updateErr);
      return res.status(500).json({ success: false, error: 'Failed to enter tournament portal' });
    }

    return res.json({ success: true, data: { user: updated } });
  } catch (err: any) {
    console.error('[select-tenant] Unexpected error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * POST /auth/complete-profile
 * Called after first login to set display_name and username.
 * Requires a valid session token.
 */
router.post('/complete-profile', verifySession, async (req: Request, res: Response) => {
  const { display_name, username } = req.body as { display_name?: string; username?: string };

  if (!display_name?.trim() || !username?.trim()) {
    return res.status(400).json({ success: false, error: 'display_name and username are required' });
  }

  // Username: lowercase alphanumeric + underscores, 3–20 chars
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({
      success: false,
      error: 'Username must be 3–20 characters, lowercase letters, numbers, or underscores only',
    });
  }

  // Check uniqueness
  const { data: taken } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('username', username)
    .neq('id', req.user!.id)
    .single();

  if (taken) {
    return res.status(409).json({ success: false, error: 'Username is already taken' });
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('users')
    .update({ display_name: display_name.trim(), username: username.trim() })
    .eq('id', req.user!.id)
    .select()
    .single();

  if (updateErr) {
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }

  return res.json({ success: true, data: updated });
});

/**
 * POST /auth/guest-register
 * Creates a test/guest account with display name, username and password.
 * Strips email domains and sanitizes username automatically so testers can
 * type "Nick@gmail.com" and it becomes "nick" safely.
 */
router.post('/guest-register', async (req: Request, res: Response) => {
  const { name, username, password } = req.body as { name?: string; username?: string; password?: string };

  if (!name?.trim() || !username?.trim() || !password?.trim()) {
    return res.status(400).json({ success: false, error: 'Name, username, and password are required' });
  }

  // Sanitize: strip email domains, replace special chars with underscores
  let u = username.trim().toLowerCase();
  if (u.includes('@')) u = u.split('@')[0];
  u = u.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  if (u.length < 2 || u.length > 20) {
    return res.status(400).json({ success: false, error: 'Username must be 2–20 alphanumeric characters (got: ' + u + ')' });
  }

  try {
    // Check username uniqueness
    const { data: taken } = await supabaseAdmin.from('users').select('id').eq('username', u).maybeSingle();
    if (taken) return res.status(409).json({ success: false, error: `Username "${u}" is already taken` });

    // Create Supabase auth user (pre-confirmed, no email needed)
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: `${u}@guest.local`,
      password,
      email_confirm: true,
      user_metadata: { full_name: name.trim(), username: u },
    });

    if (authErr || !authData.user) {
      console.error('[guest-register] Auth create error:', authErr);
      return res.status(500).json({ success: false, error: authErr?.message ?? 'Failed to create auth user' });
    }

    // Insert app user record
    const { data: created, error: dbErr } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        google_id: `guest_${authData.user.id}`,
        display_name: name.trim(),
        username: u,
        role: u.startsWith('admin') ? 'admin' : 'player',
        tenant_id: req.tenantId,
        is_suspended: false,
      })
      .select()
      .single();

    if (dbErr) {
      console.error('[guest-register] DB insert error:', dbErr);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ success: false, error: 'Failed to create user profile' });
    }

    return res.status(201).json({ success: true, data: { user: created, sanitized_username: u } });
  } catch (err: any) {
    console.error('[guest-register] Unexpected error:', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' });
  }
});

/**
 * POST /auth/guest-login
 * Sign in a guest account. Returns the Supabase access_token so the frontend
 * can store the session the same way as Google OAuth.
 */
router.post('/guest-login', async (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username?.trim() || !password?.trim()) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }

  let u = username.trim().toLowerCase();
  if (u.includes('@')) u = u.split('@')[0];
  u = u.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

  try {
    const authClient = buildAuthClient();
    const { data: signInData, error: signInErr } = await authClient.auth.signInWithPassword({
      email: `${u}@guest.local`,
      password,
    });

    if (signInErr || !signInData.session) {
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }

    // Fetch the app user record
    const { data: appUser, error: userErr } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', signInData.user.id)
      .single();

    if (userErr || !appUser) {
      return res.status(401).json({ success: false, error: 'User profile not found' });
    }

    return res.json({
      success: true,
      data: {
        user: appUser,
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
      },
    });
  } catch (err: any) {
    console.error('[guest-login] Unexpected error:', err);
    return res.status(500).json({ success: false, error: err.message ?? 'Internal server error' });
  }
});

/**
 * GET /auth/me
 * Returns the current authenticated user's profile.
 * Returns 401 without a valid token.
 */
router.get('/me', verifySession, (req: Request, res: Response) => {
  return res.json({ success: true, data: req.user });
});

export default router;
