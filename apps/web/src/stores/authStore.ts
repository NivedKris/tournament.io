import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@tournament/shared';
import { supabase } from '../lib/supabase';
import api from '../lib/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isNewUser: boolean;
  setUser: (user: User | null) => void;
  setIsNewUser: (val: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signInWithGuest: (username: string, password: string) => Promise<void>;
  signUpWithGuest: (name: string, username: string, password: string) => Promise<{ sanitized_username: string }>;
  signOut: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isNewUser: false,

      setUser: (user) => set({ user }),
      setIsNewUser: (val) => set({ isNewUser: val }),

      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: `${window.location.origin}/auth/callback` },
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

          set({ user: appUser, isNewUser: false, isLoading: false });
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

          set({ user: appUser, isNewUser: false, isLoading: false });
          return { sanitized_username };
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, isNewUser: false });
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

          // Sync with our backend — upserts user record on first login
          const { data } = await api.post('/auth/session', {
            access_token: session.access_token,
          });

          if (data.success) {
            set({
              user: data.data.user,
              isNewUser: data.data.is_new,
              isLoading: false,
            });
          }
        } catch {
          set({ user: null, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
