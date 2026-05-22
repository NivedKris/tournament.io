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
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
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
