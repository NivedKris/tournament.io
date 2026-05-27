import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
}

// Admin client — bypasses RLS. Use only in backend. Never expose.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Builds a per-request Supabase client that acts on behalf of the authenticated user
export function buildUserClient(accessToken: string) {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY ?? supabaseServiceKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Builds a fresh throwaway client for guest login to avoid mutating supabaseAdmin's auth state
export function buildAuthClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY ?? supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Returns the correct frontend URL, falling back to Vercel deployment URL or localhost.
 */
export function getFrontendUrl(req?: any): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (req) {
    const host = typeof req.get === 'function' ? req.get('host') : req.headers?.host;
    if (host) {
      const protocol = req.secure || req.headers?.['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      return `${protocol}://${host}`;
    }
  }
  return 'http://localhost:5173';
}

