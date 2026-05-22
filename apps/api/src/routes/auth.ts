import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { verifySession } from '../middleware/auth';

const router = Router();

/**
 * GET /auth/google
 * Redirects the browser to Google's OAuth consent page via Supabase.
 */
router.get('/google', async (_req: Request, res: Response) => {
  const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
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

  // Check if user record already exists
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single();

  if (existing) {
    return res.json({ success: true, data: { user: existing, is_new: false } });
  }

  // First login — create a partial record (no username/display_name yet)
  // The frontend will prompt them to complete their profile
  const { data: created, error: createErr } = await supabaseAdmin
    .from('users')
    .insert({
      id: user.id,
      google_id: user.user_metadata?.sub ?? user.id,
      display_name: user.user_metadata?.full_name ?? '',
      username: '', // Must be completed via /auth/complete-profile
      role: 'player',
      is_suspended: false,
    })
    .select()
    .single();

  if (createErr) {
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
 * GET /auth/me
 * Returns the current authenticated user's profile.
 * Returns 401 without a valid token.
 */
router.get('/me', verifySession, (req: Request, res: Response) => {
  return res.json({ success: true, data: req.user });
});

export default router;
