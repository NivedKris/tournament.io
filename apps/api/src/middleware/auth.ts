import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

// Inlined so the API is self-contained (no cross-workspace import needed in prod)
type UserRole = 'player' | 'admin';

// Extend Express Request to carry user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: UserRole;
        is_suspended: boolean;
      };
    }
  }
}

/**
 * Validates the Bearer JWT from the Authorization header.
 * Attaches `req.user` on success. Returns 401 on failure.
 */
export async function verifySession(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    // Verify the JWT with Supabase — this also validates expiry
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session token' });
    }

    // Fetch our application user record
    const { data: appUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, role, is_suspended')
      .eq('id', user.id)
      .single();

    if (userError || !appUser) {
      return res.status(401).json({ success: false, error: 'User record not found — please complete profile setup' });
    }

    req.user = appUser;
    return next();
  } catch (err) {
    console.error('[verifySession] Unexpected error:', err);
    return res.status(500).json({ success: false, error: 'Internal authentication error' });
  }
}

/**
 * Role guard — must come after verifySession.
 * Usage: router.get('/admin/...', verifySession, requireRole('admin'), handler)
 */
export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthenticated' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ success: false, error: `Requires ${role} role` });
    }
    return next();
  };
}

/**
 * Suspension guard — blocks suspended players from any action.
 * Must come after verifySession.
 */
export function requireActive(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Unauthenticated' });
  }
  if (req.user.is_suspended) {
    return res.status(403).json({ success: false, error: 'Your account has been suspended' });
  }
  return next();
}
