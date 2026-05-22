import { useAuthStore } from '../stores/authStore';

export default function SuspendedPage() {
  const { signOut } = useAuthStore();

  return (
    <div className="suspended-page">
      <div className="suspended-card">
        <span className="suspended-icon">🚫</span>
        <h1>Account suspended</h1>
        <p>
          Your account has been suspended by the tournament administrator.
          Contact an admin to get this resolved.
        </p>
        <button className="btn btn-secondary" onClick={signOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
