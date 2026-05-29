import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { supabase } from './lib/supabase';
import { useAuthStore } from './stores/authStore';

import { PublicLayout, ProtectedLayout } from './layouts';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import CompleteProfilePage from './pages/CompleteProfilePage';
import SuspendedPage from './pages/SuspendedPage';
import HomePage from './pages/HomePage';
import SquadBuilderPage from './pages/SquadBuilderPage';
import PublicProfilePage from './pages/PublicProfilePage';
import InvitePage from './pages/InvitePage';
import SelectTenantPage from './pages/SelectTenantPage';

import { TenantProvider } from './components/TenantProvider';
import SuperAdminPage from './pages/SuperAdminPage';
import MatchPage from './pages/MatchPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,   // 1 minute
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const { loadSession } = useAuthStore();

  useEffect(() => {
    // Load session on mount
    loadSession();

    // Listen for Supabase auth state changes (e.g. token refresh, sign-out from another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        useAuthStore.getState().setUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadSession({ silent: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [loadSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TenantProvider>
          <Routes>
            {/* Public routes */}
            <Route element={<PublicLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/complete-profile" element={<CompleteProfilePage />} />
              <Route path="/suspended" element={<SuspendedPage />} />
              <Route path="/profile/:claimId" element={<PublicProfilePage />} />
              <Route path="/invite/:inviteId" element={<InvitePage />} />
            </Route>

            {/* Protected routes */}
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/squad-builder" element={<SquadBuilderPage />} />
              <Route path="/match/:matchId" element={<MatchPage />} />
              <Route path="/super-admin" element={<SuperAdminPage />} />
              <Route path="/select-tenant" element={<SelectTenantPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TenantProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
