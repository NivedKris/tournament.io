import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import LoadingScreen from '../components/LoadingScreen';

export function PublicLayout() {
  return (
    <div className="public-layout">
      <Outlet />
    </div>
  );
}

export function ProtectedLayout() {
  const { user, isLoading, isNewUser } = useAuthStore();

  if (isLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (isNewUser || !user.username) return <Navigate to="/complete-profile" replace />;
  if (user.is_suspended) return <Navigate to="/suspended" replace />;

  return (
    <div className="protected-layout">
      <Outlet />
    </div>
  );
}
