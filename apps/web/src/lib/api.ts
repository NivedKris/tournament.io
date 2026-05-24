import axios from 'axios';
import { supabase } from './supabase';

// Helper to determine tenant slug from hostname or query param
export function getTenantSlug(): string {
  const oauthSlug = localStorage.getItem('oauth_tenant_slug');
  if (oauthSlug) return oauthSlug;

  const params = new URLSearchParams(window.location.search);
  const paramSlug = params.get('tenant');
  if (paramSlug) return paramSlug;

  return 'default';
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject the Supabase access token and tenant slug into every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  config.headers['x-tenant-slug'] = getTenantSlug();
  return config;
});

// Global error handler — 401 → clear session and reload
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
