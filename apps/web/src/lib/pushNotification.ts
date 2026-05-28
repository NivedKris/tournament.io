import api from './api';

// Helper to convert VAPID base64 key to Uint8Array for pushManager subscription
function urlBase64ToUint8Array(base64String: string): any {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks if Push Notifications are supported by the browser.
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Returns the current notification permission state.
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Requests permission and subscribes the user to web push.
 */
export async function subscribeUserToPush(): Promise<boolean> {
  if (!isPushSupported()) {
    console.warn('Push notifications are not supported in this browser.');
    return false;
  }

  try {
    // Request permission if not already granted
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied by user.');
      return false;
    }

    // Get active Service Worker registration
    const registration = await navigator.serviceWorker.ready;

    // Fetch the VAPID public key from backend
    const res = await api.get('/push/vapid-public-key');
    const vapidPublicKey = res.data.publicKey;

    if (!vapidPublicKey) {
      throw new Error('VAPID key not returned by backend');
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    // Subscribe user
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });

    // Send subscription object to backend
    await api.post('/push/subscribe', { subscription });
    console.log('[Push] User successfully subscribed to push notifications.');
    return true;
  } catch (err) {
    console.error('[Push] Failed to subscribe user to push:', err);
    return false;
  }
}

/**
 * Automatically refresh/register subscription in the background if permission is already granted.
 */
export async function autoRegisterPushIfPermissionGranted() {
  if (isPushSupported() && getNotificationPermission() === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Fetch public key and subscribe
        const res = await api.get('/push/vapid-public-key');
        const vapidPublicKey = res.data.publicKey;
        if (vapidPublicKey) {
          const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });
        }
      }

      if (subscription) {
        await api.post('/push/subscribe', { subscription });
      }
    } catch (err) {
      console.error('[Push] Failed to auto-register push subscription:', err);
    }
  }
}
