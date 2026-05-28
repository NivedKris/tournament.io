import { Router, Request, Response } from 'express';
import { verifySession, requireActive } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

/**
 * GET /push/vapid-public-key
 * Returns the VAPID public key so the client can subscribe.
 */
router.get('/vapid-public-key', verifySession, requireActive, (req: Request, res: Response) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ success: false, error: 'VAPID public key not configured on server' });
  }
  return res.json({ success: true, publicKey });
});

/**
 * POST /push/subscribe
 * Register or update a user's web push subscription.
 */
router.post('/subscribe', verifySession, requireActive, async (req: Request, res: Response) => {
  try {
    const { subscription } = req.body;
    if (!subscription || typeof subscription !== 'object') {
      return res.status(400).json({ success: false, error: 'Valid subscription object is required' });
    }

    const userId = req.user!.id;

    const { error } = await supabaseAdmin
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        subscription: subscription
      });

    if (error) {
      if (error.code === '23505') {
        return res.json({ success: true, message: 'Subscription already registered' });
      }
      console.error('[PushRoute] Database error during subscribe:', error);
      return res.status(500).json({ success: false, error: 'Failed to save push subscription' });
    }

    return res.status(201).json({ success: true, message: 'Push subscription registered successfully' });
  } catch (err: any) {
    console.error('[PushRoute] Error in subscribe:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

export default router;
