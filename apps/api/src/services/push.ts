import webpush from 'web-push';
import { supabaseAdmin } from '../lib/supabase';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:mark.organisation@gmail.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
} else {
  console.warn('[PushService] VAPID keys missing from environment. Push notifications will fail.');
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
}

/**
 * Sends a web push notification to all stored push subscriptions of a target user.
 */
export async function sendUserPushNotification(userId: string, payload: PushNotificationPayload) {
  try {
    // Fetch all active subscriptions for the user
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, subscription')
      .eq('user_id', userId);

    if (error) {
      console.error(`[PushService] Failed to fetch push subscriptions for user ${userId}:`, error);
      return;
    }

    if (!subs || subs.length === 0) {
      return; // No active subscriptions registered for this user
    }

    const payloadString = JSON.stringify(payload);

    // Send notifications in parallel
    const promises = subs.map(async (subRecord: any) => {
      try {
        await webpush.sendNotification(subRecord.subscription, payloadString);
      } catch (err: any) {
        // If the subscription is no longer active (e.g. 404 or 410 Gone), prune it from the database
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`[PushService] Pruning expired push subscription ${subRecord.id} for user ${userId}`);
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', subRecord.id);
        } else {
          console.error(`[PushService] Failed to send push notification to subscription ${subRecord.id}:`, err);
        }
      }
    });

    await Promise.all(promises);
  } catch (err) {
    console.error('[PushService] Error in sendUserPushNotification:', err);
  }
}
