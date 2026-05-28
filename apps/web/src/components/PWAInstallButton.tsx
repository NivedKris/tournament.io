import { useState, useEffect } from 'react';

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showIOSTooltip, setShowIOSTooltip] = useState(false);
  const [isAlreadyStandalone, setIsAlreadyStandalone] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (PWA installed)
    const checkStandalone = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
        || (navigator as any).standalone 
        || document.referrer.includes('android-app://');
      setIsAlreadyStandalone(!!isStandalone);
    };

    checkStandalone();

    // Listen for the custom PWA installation trigger
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (isIOS) {
      setShowIOSTooltip(prev => !prev);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    } else {
      alert("To install Matchup:\n\n1. On PC/Android: Click your browser's menu (three dots) and select 'Install' or 'Add to Home screen'.\n2. On iOS: Tap the Share button and select 'Add to Home Screen'.");
    }
  };

  if (isAlreadyStandalone) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  if (!isInstallable && !isIOS) return null;

  return (
    <div className="pwa-install-container" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
      {showIOSTooltip && (
        <div 
          className="pwa-ios-tooltip" 
          style={{
            position: 'absolute',
            bottom: '64px',
            right: '0',
            width: '260px',
            background: 'rgba(24, 24, 27, 0.9)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px',
            color: '#f4f4f5',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            fontSize: '0.85rem',
            lineHeight: '1.45',
            animation: 'slideUp 0.2s ease-out'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
            <span style={{ fontWeight: 'bold', color: '#fff' }}>Install Matchup</span>
            <button 
              onClick={() => setShowIOSTooltip(false)} 
              style={{ background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: '1.1rem', cursor: 'pointer', padding: '0 4px' }}
            >
              ×
            </button>
          </div>
          <p style={{ margin: '0 0 8px 0' }}>Install this app on your iPhone for the best experience:</p>
          <ol style={{ margin: '0', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <li>
              Tap the <strong>Share</strong> button{' '}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', display: 'inline-block', transform: 'translateY(-2px)' }}>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            </li>
            <li>
              Scroll down and select <strong>Add to Home Screen</strong>{' '}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', display: 'inline-block', transform: 'translateY(-2px)' }}>
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
            </li>
            <li>Tap <strong>Add</strong> in the top right.</li>
          </ol>
        </div>
      )}

      <button
        onClick={handleInstallClick}
        title="Install app"
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '24px',
          background: 'rgba(24, 24, 27, 0.8)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'transform 0.2s, background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.backgroundColor = 'rgba(39, 39, 42, 0.9)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.backgroundColor = 'rgba(24, 24, 27, 0.8)';
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
