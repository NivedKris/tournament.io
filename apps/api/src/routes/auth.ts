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

/**
 * POST /auth/session
 * Called by the frontend after Supabase handles the OAuth callback and
 * returns the session tokens. We upsert the user record on first login.
 * Body: { access_token, refresh_token, user: { id, email, user_metadata } }
 */
router.post('/session', async (req: Request, res: Response) => {
  const { access_token } = req.body as { access_token?: string };

  if (!access_token) {
    return res.status(400).json({ success: false, error: 'access_token is required' });
  }

  // Verify the token is legit
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);

  if (error || !user) {
    return res.status(401).json({ success: false, error: 'Invalid access token' });
  }

  // Check if user record already exists by id
  const { data: existingById } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existingById) {
    if (!existingById.email && user.email) {
      await supabaseAdmin.from('users').update({ email: user.email }).eq('id', user.id);
      existingById.email = user.email;
    }
    return res.json({ success: true, data: { user: existingById, is_new: false } });
  }

  // Check if user record already exists by google_id
  const googleId = user.user_metadata?.sub ?? user.id;
  const { data: existingByGoogle } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('google_id', googleId)
    .maybeSingle();

  if (existingByGoogle) {
    // Sync the UUID in public.users to match the new one from Supabase Auth.
    // Thanks to ON UPDATE CASCADE, this propagates to referencing tables automatically.
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ id: user.id, email: user.email || '' })
      .eq('google_id', googleId)
      .select()
      .single();

    if (updateErr) {
      console.error('[auth/session] Failed to sync user ID:', updateErr);
      return res.status(500).json({ success: false, error: 'Failed to sync user ID record' });
    }

    return res.json({ success: true, data: { user: updated, is_new: false } });
  }

  // First login — create a partial record (no username/display_name yet)
  // The frontend will prompt them to complete their profile
  const { data: created, error: createErr } = await supabaseAdmin
    .from('users')
    .insert({
      id: user.id,
      google_id: googleId,
      email: user.email || '',
      display_name: user.user_metadata?.full_name ?? '',
      username: `google_${user.id.replace(/-/g, '').substring(0, 10)}`, // Must be completed via /auth/complete-profile
      role: 'player',
      is_suspended: false,
    })
    .select()
    .single();

  if (createErr) {
    if (createErr.code === '23505') {
      // Handle race condition where a concurrent request inserted the user record first
      const { data: reFetched } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (reFetched) {
        return res.json({ success: true, data: { user: reFetched, is_new: true } });
      }
    }
    console.error('[auth/session] Failed to create user:', createErr);
    return res.status(500).json({ success: false, error: 'Failed to create user record' });
  }

  return res.status(201).json({ success: true, data: { user: created, is_new: true } });
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
