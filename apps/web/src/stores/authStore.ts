import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@tournament/shared';
import { supabase } from '../lib/supabase';
import api from '../lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isNewUser: boolean;
  enrolledTenants: any[];
  setUser: (user: User | null) => void;
  setIsNewUser: (val: boolean) => void;
  setEnrolledTenants: (tenants: any[]) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithGuest: (username: string, password: string) => Promise<void>;
  signUpWithGuest: (name: string, username: string, password: string) => Promise<{ sanitized_username: string }>;
  signOut: () => Promise<void>;
  loadSession: () => Promise<any>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isNewUser: false,
      enrolledTenants: [],

      setUser: (user) => set({ user }),
      setIsNewUser: (val) => set({ isNewUser: val }),
      setEnrolledTenants: (tenants) => set({ enrolledTenants: tenants }),

      signInWithGoogle: async () => {
        const port = window.location.port ? `:${window.location.port}` : '';
        const baseDomain = window.location.hostname.includes('localhost') 
          ? `localhost${port}` 
          : window.location.hostname; // Fallback to current host if not local

        const protocol = window.location.protocol;
        const redirectUrl = `${protocol}//${baseDomain}/auth/callback`;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: redirectUrl },
        });
        if (error) throw error;
      },

      // Guest sign-in: hits our backend which uses Supabase admin signInWithPassword,
      // returns the session tokens, then we setSession on the client.
      signInWithGuest: async (username, password) => {
        set({ isLoading: true });
        try {
          const { data, error: axErr } = await (api.post('/auth/guest-login', { username, password }) as any)
            .catch((e: any) => ({ data: e.response?.data, error: e }));

          if (axErr || !data?.success) {
            throw new Error(data?.error ?? axErr?.message ?? 'Login failed');
          }

          const { user: appUser, access_token, refresh_token } = data.data;

          // Plant session in Supabase client so loadSession works going forward
          await supabase.auth.setSession({ access_token, refresh_token });

          set({ user: appUser, isNewUser: false, isLoading: false, enrolledTenants: [] });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      // Guest register: creates account, then immediately signs in.
      signUpWithGuest: async (name, username, password) => {
        set({ isLoading: true });
        try {
          const regRes = await api.post('/auth/guest-register', { name, username, password })
            .catch((e: any) => { throw new Error(e.response?.data?.error ?? e.message ?? 'Registration failed'); });

          if (!regRes.data.success) throw new Error(regRes.data.error ?? 'Registration failed');

          const sanitized_username: string = regRes.data.data.sanitized_username;

          // Now sign in with the sanitized username
          const loginRes = await api.post('/auth/guest-login', { username: sanitized_username, password })
            .catch((e: any) => { throw new Error(e.response?.data?.error ?? e.message ?? 'Login after register failed'); });

          if (!loginRes.data.success) throw new Error(loginRes.data.error ?? 'Login after register failed');

          const { user: appUser, access_token, refresh_token } = loginRes.data.data;
          await supabase.auth.setSession({ access_token, refresh_token });

          set({ user: appUser, isNewUser: false, isLoading: false, enrolledTenants: [] });
          return { sanitized_username };
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      signOut: async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('oauth_tenant_slug');
        set({ user: null, isNewUser: false, enrolledTenants: [] });
        window.location.href = '/login';
      },

      loadSession: async () => {
        set({ isLoading: true });
        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (!session) {
            set({ user: null, isLoading: false });
            return;
          }

          const oauthTenantSlug = localStorage.getItem('oauth_tenant_slug') || undefined;

          // Sync with our backend — upserts user record on first login
          const { data } = await api.post('/auth/session', {
            access_token: session.access_token,
            targetTenantSlug: oauthTenantSlug,
          });

          if (data.success) {
            set({
              user: data.data.user,
              isNewUser: data.data.is_new,
              enrolledTenants: data.data.tenants || [],
              isLoading: false,
            });
            return data;
          }
        } catch (err) {
          set({ user: null, isLoading: false });
          throw err;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
