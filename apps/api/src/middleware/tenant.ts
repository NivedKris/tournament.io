import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

// Extend Request interface to support tenantId
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Resolves the tenant context from headers or query parameters.
 * Scopes the current request execution.
 */
export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  // Read slug from headers (or fallback to query params for local API debugging)
  const slug = (req.headers['x-tenant-slug'] as string) || (req.query.t as string);

  if (!slug || slug.trim().toLowerCase() === 'default') {
    req.tenantId = DEFAULT_TENANT_ID;
    return next();
  }

  try {
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, status')
      .eq('slug', slug.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('[resolveTenant] Database error:', error);
      req.tenantId = DEFAULT_TENANT_ID;
      return next();
    }

    if (!tenant) {
      // If the slug doesn't exist, we fallback to default tenant instead of hard failing,
      // which keeps general API routes highly resilient.
      req.tenantId = DEFAULT_TENANT_ID;
      return next();
    }

    if (tenant.status === 'suspended') {
      return res.status(403).json({ success: false, error: 'This organization instance is currently suspended' });
    }

    req.tenantId = tenant.id;
    return next();
  } catch (err) {
    console.error('[resolveTenant] Unexpected error:', err);
    req.tenantId = DEFAULT_TENANT_ID;
    return next();
  }
}
