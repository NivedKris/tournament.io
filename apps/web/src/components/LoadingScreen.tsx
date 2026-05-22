
export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <img
        src="/logo.png"
        alt="Matchup"
        className="loading-logo"
      />
      <div className="loading-spinner" />
    </div>
  );
}
