import { useAuthStore } from '../stores/authStore';

export default function HomePage() {
  const { user, signOut } = useAuthStore();

  return (
    <div className="app-shell">
      {/* Nav */}
      <nav className="navbar">
        <div className="nav-brand">
          <img src="/logo.png" alt="Matchup" className="nav-logo" />
          <span className="nav-wordmark">
            <span>MATCH</span><span className="up">UP</span>
          </span>
        </div>

        <div className="nav-right">
          <div className="nav-user-info">
            <span className="nav-display-name">{user?.display_name}</span>
            <span className="nav-username">@{user?.username}</span>
          </div>
          {user?.role === 'admin' && (
            <span className="badge badge-admin">Admin</span>
          )}
          <button id="signout-btn" className="btn btn-secondary btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="page-content">
        <div className="home-hero">
          <h1>Welcome back, {user?.display_name?.split(' ')[0]}.</h1>
          <p>The tournament platform is gearing up. More features arriving soon.</p>
        </div>
      </div>
    </div>
  );
}
