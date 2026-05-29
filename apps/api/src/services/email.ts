import dotenv from 'dotenv';
import { supabaseAdmin, getFrontendUrl } from '../lib/supabase';
import { getTournamentStatsRaw } from './stats';
import { sendUserPushNotification } from './push';

dotenv.config();

const BREVO_API_KEY = process.env.BREVO_API_KEY?.trim();
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL?.trim() || 'mark.organisation@gmail.com';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME?.trim() || 'Matchup Tournaments';

export interface EmailRecipient {
  email: string;
  name?: string;
  username?: string;
}

/**
 * Sends an email immediately via Brevo API
 */
export async function sendEmail(
  to: EmailRecipient[],
  subject: string,
  htmlContent: string
): Promise<boolean> {
  if (!BREVO_API_KEY) {
    console.warn('[EmailService] Missing BREVO_API_KEY. Skipping email dispatch.');
    return false;
  }

  if (!to || to.length === 0) {
    return false;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_SENDER_NAME,
          email: BREVO_SENDER_EMAIL,
        },
        to: to.map(r => {
          const defaultName = r.email.split('@')[0] || 'Player';
          return {
            email: r.email,
            name: (r.name || r.username || '').trim() || defaultName
          };
        }),
        subject,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[EmailService] Brevo API error:', response.status, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[EmailService] Exception during sendEmail:', err);
    return false;
  }
}

/**
 * Queues emails to run sequentially in the background to avoid rate limits and request blocking
 */
export function queueEmails(
  recipients: EmailRecipient[],
  subject: string,
  htmlGenerator: (recipient: EmailRecipient) => string
) {
  // Fire and forget: runs in the background
  (async () => {
    console.log(`[EmailQueue] Commencing background email dispatch for ${recipients.length} recipient(s)...`);
    for (const recipient of recipients) {
      if (!recipient.email) continue;
      try {
        const html = htmlGenerator(recipient);
        await sendEmail([recipient], subject, html);
      } catch (err) {
        console.error(`[EmailQueue] Failed to send email to ${recipient.email}:`, err);
      }
      // Simple rate limiting: 300ms delay between deliveries
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    console.log('[EmailQueue] Background email dispatch finished.');
  })();
}

/**
 * Notify all pre-qual players that the Pre-Qualifiers phase has commenced.
 */
export async function notifyPreQualsStarted(tournamentId: string, tournamentName: string, req?: any) {
  try {
    const { data: matches } = await supabaseAdmin.from('matches').select('*').eq('tournament_id', tournamentId).eq('stage', 'pre_qual');
    const { data: rawClaims } = await supabaseAdmin.from('nation_claims').select(`
      id,
      user_id,
      users!inner (email, display_name, username),
      nations!inner (name)
    `).eq('tournament_id', tournamentId);

    if (!matches || !rawClaims) return;

    const claims = rawClaims.map((c: any) => {
      const userObj = Array.isArray(c.users) ? c.users[0] : c.users;
      const nationObj = Array.isArray(c.nations) ? c.nations[0] : c.nations;
      return {
        id: c.id,
        user_id: c.user_id,
        user: userObj,
        nation: nationObj,
      };
    });

    const claimMap = new Map(claims.map((c: any) => [c.id, c]));
    const userFixtures = new Map<string, { recipient: EmailRecipient; fixtures: string[] }>();

    for (const m of matches) {
      const home = claimMap.get(m.home_claim_id);
      const away = claimMap.get(m.away_claim_id);

      if (home?.user?.email) {
        if (!userFixtures.has(home.user_id)) {
          userFixtures.set(home.user_id, {
            recipient: { email: home.user.email, name: home.user.display_name, username: home.user.username },
            fixtures: [],
          });
        }
        userFixtures.get(home.user_id)!.fixtures.push(`${home.nation?.name} vs ${away ? away.nation?.name : 'TBD'}`);
      }
      if (away?.user?.email && !m.is_bye) {
        if (!userFixtures.has(away.user_id)) {
          userFixtures.set(away.user_id, {
            recipient: { email: away.user.email, name: away.user.display_name, username: away.user.username },
            fixtures: [],
          });
        }
        userFixtures.get(away.user_id)!.fixtures.push(`${away.nation?.name} vs ${home ? home.nation?.name : 'TBD'}`);
      }
    }

    const recipients = Array.from(userFixtures.values());
    if (recipients.length === 0) return;

    const frontendUrl = getFrontendUrl(req);

    queueEmails(
      recipients.map(r => r.recipient),
      `Tournament Started: Pre-Qualifiers phase has commenced for ${tournamentName}`,
      (recipient) => {
        const matchingClaim = claims.find((c: any) => c.user?.email === recipient.email);
        const userId = matchingClaim ? matchingClaim.user_id : '';
        const fixtures = userFixtures.get(userId)?.fixtures || [];
        const fixturesHtml = fixtures.map(f => `
          <li style="padding: 10px 0; border-bottom: 1px solid #2a2a2a; color: #ffffff; font-size: 15px;">
            <strong style="color: #F5C842;">Fixture:</strong> ${f}
          </li>
        `).join('');

        return `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e5e5e5; margin: 0; padding: 24px; }
              .card { max-width: 580px; margin: 0 auto; background-color: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 16px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
              h2 { font-size: 22px; font-weight: 800; color: #ffffff; margin-top: 0; letter-spacing: -0.02em; }
              p { font-size: 15px; line-height: 1.6; color: #a1a1a6; }
              ul { list-style: none; padding: 0; margin: 24px 0; border-top: 1px solid #2a2a2a; }
              .cta-btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #F5C842 0%, #D4AF37 100%); color: #121212; font-weight: 700; font-size: 15px; border-radius: 8px; text-decoration: none; text-align: center; margin-top: 12px; }
              .footer { margin-top: 32px; font-size: 12px; color: #48484a; border-top: 1px solid #2a2a2a; padding-top: 16px; text-align: center; }
              .info-box { margin-bottom: 24px; padding: 16px; background-color: rgba(245, 200, 66, 0.08); border-left: 4px solid #F5C842; border-radius: 4px; color: #e5e5e5; font-size: 14px; line-height: 1.5; }
              .instructions { margin: 24px 0; padding: 20px; background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Pre-Qualifiers Started</h2>
              <p>Hi ${recipient.name || `@${recipient.username}`},</p>
              
              <div class="info-box">
                <strong>What are Pre-Qualifiers?</strong><br/>
                Pre-Qualifiers occur when multiple managers claim the same country or club. It is a mini-stage where you compete head-to-head with other claimants of that nation to determine who earns the spot in the main tournament group stage.
              </div>

              <p>The Pre-Qualifiers phase has officially commenced for <strong>${tournamentName}</strong>! Here is your scheduled fixture:</p>
              <ul>
                ${fixturesHtml}
              </ul>

              <div class="instructions">
                <h3 style="margin-top: 0; color: #F5C842; font-size: 16px; font-weight: 700;">How to Play Your Match:</h3>
                <ol style="margin: 0; padding-left: 20px; color: #a1a1a6; font-size: 14px; line-height: 1.6;">
                  <li style="margin-bottom: 8px;">Go to the **My Fixtures** section on the Matchup dashboard.</li>
                  <li style="margin-bottom: 8px;">Click on your match to open the **Match Chat** to communicate directly with your opponent.</li>
                  <li style="margin-bottom: 8px;">Create a friendly lobby in eFootball, share the Match Room details in the chat, and play the match.</li>
                  <li style="margin-bottom: 8px;">Once the match is over, the **winner** must upload a clear screenshot of the final score screen and report the match scorers.</li>
                </ol>
              </div>

              <div style="text-align: center;">
                <a href="${frontendUrl}" class="cta-btn">View Fixtures & Report Scores</a>
              </div>
              <div class="footer">
                Matchup Tournaments.
              </div>
            </div>
          </body>
          </html>
        `;
      }
    );

    // Dispatch push notifications
    for (const [userId, data] of userFixtures.entries()) {
      const fixturesCount = data.fixtures.length;
      const fixturesText = fixturesCount === 1 ? '1 fixture' : `${fixturesCount} fixtures`;
      sendUserPushNotification(userId, {
        title: 'Pre-Qualifiers Started',
        body: `Your Pre-Qualifier matchups are live! You have ${fixturesText} scheduled in ${tournamentName}.`,
        url: '/'
      });
    }
  } catch (err) {
    console.error('[notifyPreQualsStarted] Error:', err);
  }
}

/**
 * Notify all group stage players of their group placement and group fixtures.
 */
export async function notifyGroupsStarted(tournamentId: string, tournamentName: string, req?: any) {
  try {
    const { data: matches } = await supabaseAdmin.from('matches').select('*').eq('tournament_id', tournamentId).eq('stage', 'group');
    const { data: rawClaims } = await supabaseAdmin.from('nation_claims').select(`
      id,
      user_id,
      users!inner (email, display_name, username),
      nations!inner (name)
    `).eq('tournament_id', tournamentId);

    if (!matches || !rawClaims) return;

    const claims = rawClaims.map((c: any) => {
      const userObj = Array.isArray(c.users) ? c.users[0] : c.users;
      const nationObj = Array.isArray(c.nations) ? c.nations[0] : c.nations;
      
      const claimMatch = matches.find((m: any) => m.home_claim_id === c.id || m.away_claim_id === c.id);
      const groupName = claimMatch?.group_name || 'TBD';

      return {
        id: c.id,
        user_id: c.user_id,
        group_name: groupName,
        user: userObj,
        nation: nationObj,
      };
    });

    const claimMap = new Map(claims.map((c: any) => [c.id, c]));
    const userFixtures = new Map<string, { recipient: EmailRecipient; groupName: string; fixtures: string[] }>();

    for (const m of matches) {
      const home = claimMap.get(m.home_claim_id);
      const away = claimMap.get(m.away_claim_id);

      if (home?.user?.email) {
        if (!userFixtures.has(home.user_id)) {
          userFixtures.set(home.user_id, {
            recipient: { email: home.user.email, name: home.user.display_name, username: home.user.username },
            groupName: home.group_name || '',
            fixtures: [],
          });
        }
        userFixtures.get(home.user_id)!.fixtures.push(`${home.nation?.name} vs ${away ? away.nation?.name : 'TBD'}`);
      }
      if (away?.user?.email && !m.is_bye) {
        if (!userFixtures.has(away.user_id)) {
          userFixtures.set(away.user_id, {
            recipient: { email: away.user.email, name: away.user.display_name, username: away.user.username },
            groupName: away.group_name || '',
            fixtures: [],
          });
        }
        userFixtures.get(away.user_id)!.fixtures.push(`${away.nation?.name} vs ${home ? home.nation?.name : 'TBD'}`);
      }
    }

    const recipients = Array.from(userFixtures.values());
    if (recipients.length === 0) return;

    const frontendUrl = getFrontendUrl(req);

    queueEmails(
      recipients.map(r => r.recipient),
      `Group Stage Commenced: ${tournamentName}`,
      (recipient) => {
        const matchingClaim = claims.find((c: any) => c.user?.email === recipient.email);
        const userId = matchingClaim ? matchingClaim.user_id : '';
        const data = userFixtures.get(userId);
        const groupName = data?.groupName || 'TBD';
        const fixtures = data?.fixtures || [];
        const fixturesHtml = fixtures.map(f => `
          <li style="padding: 10px 0; border-bottom: 1px solid #2a2a2a; color: #ffffff; font-size: 15px;">
            <strong style="color: #F5C842;">Fixture:</strong> ${f}
          </li>
        `).join('');

        return `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e5e5e5; margin: 0; padding: 24px; }
              .card { max-width: 580px; margin: 0 auto; background-color: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 16px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
              h2 { font-size: 22px; font-weight: 800; color: #ffffff; margin-top: 0; letter-spacing: -0.02em; }
              p { font-size: 15px; line-height: 1.6; color: #a1a1a6; }
              ul { list-style: none; padding: 0; margin: 24px 0; border-top: 1px solid #2a2a2a; }
              .cta-btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #F5C842 0%, #D4AF37 100%); color: #121212; font-weight: 700; font-size: 15px; border-radius: 8px; text-decoration: none; text-align: center; margin-top: 12px; }
              .footer { margin-top: 32px; font-size: 12px; color: #48484a; border-top: 1px solid #2a2a2a; padding-top: 16px; text-align: center; }
              .instructions { margin: 24px 0; padding: 20px; background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Group Stage Commenced</h2>
              <p>Hi ${recipient.name || `@${recipient.username}`},</p>
              <p>The Group Stage of <strong>${tournamentName}</strong> has officially commenced! You have been placed in <strong>Group ${groupName}</strong>.</p>
              <p>Here are your group stage fixtures:</p>
              <ul>
                ${fixturesHtml}
              </ul>

              <div class="instructions">
                <h3 style="margin-top: 0; color: #F5C842; font-size: 16px; font-weight: 700;">How to Play Your Match:</h3>
                <ol style="margin: 0; padding-left: 20px; color: #a1a1a6; font-size: 14px; line-height: 1.6;">
                  <li style="margin-bottom: 8px;">Go to the **My Fixtures** section on the Matchup dashboard.</li>
                  <li style="margin-bottom: 8px;">Click on your match to open the **Match Chat** to communicate directly with your opponent.</li>
                  <li style="margin-bottom: 8px;">Create a friendly lobby in eFootball, share the Match Room details in the chat, and play the match.</li>
                  <li style="margin-bottom: 8px;">Once the match is over, the **winner** must upload a clear screenshot of the final score screen and report the match scorers.</li>
                </ol>
              </div>

              <div style="text-align: center;">
                <a href="${frontendUrl}" class="cta-btn">View Standings & Play</a>
              </div>
              <div class="footer">
                Matchup Tournaments.
              </div>
            </div>
          </body>
          </html>
        `;
      }
    );

    // Dispatch push notifications
    for (const [userId, data] of userFixtures.entries()) {
      const fixturesCount = data.fixtures.length;
      const fixturesText = fixturesCount === 1 ? '1 fixture' : `${fixturesCount} fixtures`;
      sendUserPushNotification(userId, {
        title: 'Group Stage Commenced',
        body: `You have been placed in Group ${data.groupName}! Play your ${fixturesText} now in ${tournamentName}.`,
        url: '/'
      });
    }
  } catch (err) {
    console.error('[notifyGroupsStarted] Error:', err);
  }
}

/**
 * Notify all players qualified for knockouts about their next knockout fixtures.
 * Do not email users who did not qualify for knockouts.
 */
export async function notifyKnockoutsStarted(tournamentId: string, tournamentName: string, req?: any) {
  try {
    const { data: matches } = await supabaseAdmin.from('matches').select('*').eq('tournament_id', tournamentId).eq('stage', 'knockout');
    const { data: rawClaims } = await supabaseAdmin.from('nation_claims').select(`
      id,
      user_id,
      users!inner (email, display_name, username),
      nations!inner (name)
    `).eq('tournament_id', tournamentId);

    if (!matches || matches.length === 0 || !rawClaims) return;

    const claims = rawClaims.map((c: any) => {
      const userObj = Array.isArray(c.users) ? c.users[0] : c.users;
      const nationObj = Array.isArray(c.nations) ? c.nations[0] : c.nations;
      return {
        id: c.id,
        user_id: c.user_id,
        user: userObj,
        nation: nationObj,
      };
    });

    // Find the starting round of knockouts (the round with the maximum value)
    const maxRound = Math.max(...matches.map((m: any) => m.round));
    const startRoundMatches = matches.filter((m: any) => m.round === maxRound);

    const claimMap = new Map(claims.map((c: any) => [c.id, c]));
    const userFixtures = new Map<string, { recipient: EmailRecipient; fixtures: string[] }>();

    for (const m of startRoundMatches) {
      const home = claimMap.get(m.home_claim_id);
      const away = claimMap.get(m.away_claim_id);

      if (home?.user?.email) {
        if (!userFixtures.has(home.user_id)) {
          userFixtures.set(home.user_id, {
            recipient: { email: home.user.email, name: home.user.display_name, username: home.user.username },
            fixtures: [],
          });
        }
        userFixtures.get(home.user_id)!.fixtures.push(`${home.nation?.name} vs ${away ? away.nation?.name : 'TBD'}`);
      }
      if (away?.user?.email && !m.is_bye) {
        if (!userFixtures.has(away.user_id)) {
          userFixtures.set(away.user_id, {
            recipient: { email: away.user.email, name: away.user.display_name, username: away.user.username },
            fixtures: [],
          });
        }
        userFixtures.get(away.user_id)!.fixtures.push(`${away.nation?.name} vs ${home ? home.nation?.name : 'TBD'}`);
      }
    }

    const recipients = Array.from(userFixtures.values());
    if (recipients.length === 0) return;

    const frontendUrl = getFrontendUrl(req);

    queueEmails(
      recipients.map(r => r.recipient),
      `Knockout Stage Commenced: ${tournamentName}`,
      (recipient) => {
        const matchingClaim = claims.find((c: any) => c.user?.email === recipient.email);
        const userId = matchingClaim ? matchingClaim.user_id : '';
        const fixtures = userFixtures.get(userId)?.fixtures || [];
        const fixturesHtml = fixtures.map(f => `
          <li style="padding: 10px 0; border-bottom: 1px solid #2a2a2a; color: #ffffff; font-size: 15px;">
            <strong style="color: #F5C842;">Fixture:</strong> ${f}
          </li>
        `).join('');

        return `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e5e5e5; margin: 0; padding: 24px; }
              .card { max-width: 580px; margin: 0 auto; background-color: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 16px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
              h2 { font-size: 22px; font-weight: 800; color: #ffffff; margin-top: 0; letter-spacing: -0.02em; }
              p { font-size: 15px; line-height: 1.6; color: #a1a1a6; }
              ul { list-style: none; padding: 0; margin: 24px 0; border-top: 1px solid #2a2a2a; }
              .cta-btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #F5C842 0%, #D4AF37 100%); color: #121212; font-weight: 700; font-size: 15px; border-radius: 8px; text-decoration: none; text-align: center; margin-top: 12px; }
              .footer { margin-top: 32px; font-size: 12px; color: #48484a; border-top: 1px solid #2a2a2a; padding-top: 16px; text-align: center; }
              .instructions { margin: 24px 0; padding: 20px; background-color: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Knockout Stage Commenced</h2>
              <p>Hi ${recipient.name || `@${recipient.username}`},</p>
              <p>Congratulations! You have qualified for the Knockout Stage of <strong>${tournamentName}</strong>!</p>
              <p>Here is your starting knockout fixture:</p>
              <ul>
                ${fixturesHtml}
              </ul>

              <div class="instructions">
                <h3 style="margin-top: 0; color: #F5C842; font-size: 16px; font-weight: 700;">How to Play Your Match:</h3>
                <ol style="margin: 0; padding-left: 20px; color: #a1a1a6; font-size: 14px; line-height: 1.6;">
                  <li style="margin-bottom: 8px;">Go to the **My Fixtures** section on the Matchup dashboard.</li>
                  <li style="margin-bottom: 8px;">Click on your match to open the **Match Chat** to communicate directly with your opponent.</li>
                  <li style="margin-bottom: 8px;">Create a friendly lobby in eFootball, share the Match Room details in the chat, and play the match.</li>
                  <li style="margin-bottom: 8px;">Once the match is over, the **winner** must upload a clear screenshot of the final score screen and report the match scorers.</li>
                </ol>
              </div>

              <div style="text-align: center;">
                <a href="${frontendUrl}" class="cta-btn">Access Knockout Bracket</a>
              </div>
              <div class="footer">
                Matchup Tournaments.
              </div>
            </div>
          </body>
          </html>
        `;
      }
    );

    // Dispatch push notifications
    for (const [userId, data] of userFixtures.entries()) {
      const fixturesCount = data.fixtures.length;
      const fixturesText = fixturesCount === 1 ? '1 fixture' : `${fixturesCount} fixtures`;
      sendUserPushNotification(userId, {
        title: 'Knockout Stage Commenced',
        body: `Congratulations! You qualified for the Knockout Stage in ${tournamentName}! Play your ${fixturesText} now.`,
        url: '/'
      });
    }
  } catch (err) {
    console.error('[notifyKnockoutsStarted] Error:', err);
  }
}

/**
 * Broadcast tournament winner and final statistics to all users.
 */
export async function notifyTournamentWinner(tournamentId: string, tournamentName: string, req?: any) {
  try {
    const { data: claims } = await supabaseAdmin.from('nation_claims').select(`
      id,
      user_id,
      status,
      users!inner (email, display_name, username),
      nations!inner (name)
    `).eq('tournament_id', tournamentId);

    const winnerClaim = claims?.find((c: any) => c.status === 'qualified');

    const rawStats = await getTournamentStatsRaw(tournamentId);

    let topScorer = 'None';
    let topAssister = 'None';
    let topGlove = 'None';

    if (rawStats.topScorers.length > 0 && rawStats.topScorers[0].count > 0) {
      const ts = rawStats.topScorers[0];
      topScorer = `${ts.player?.name || 'Unknown'} (${ts.claim?.nations?.name || 'Unknown'}) - ${ts.count} Goals`;
    }
    if (rawStats.topPlaymakers.length > 0 && rawStats.topPlaymakers[0].count > 0) {
      const ta = rawStats.topPlaymakers[0];
      topAssister = `${ta.player?.name || 'Unknown'} (${ta.claim?.nations?.name || 'Unknown'}) - ${ta.count} Assists`;
    }
    if (rawStats.topGoalkeepers.length > 0 && rawStats.topGoalkeepers[0].cleanSheets > 0) {
      const tg = rawStats.topGoalkeepers[0];
      topGlove = `${tg.player?.name || 'Unknown'} (${tg.claim?.nations?.name || 'Unknown'}) - ${tg.cleanSheets} Clean Sheets`;
    }

    const { data: users } = await supabaseAdmin.from('users').select('id, email, display_name, username').not('email', 'is', null).neq('email', '');
    if (!users || users.length === 0) return;

    const winnerUser = Array.isArray(winnerClaim?.users) ? winnerClaim.users[0] : (winnerClaim?.users as any);
    const winnerNation = Array.isArray(winnerClaim?.nations) ? winnerClaim.nations[0] : (winnerClaim?.nations as any);

    const winnerText = winnerClaim 
      ? `${winnerUser?.display_name || `@${winnerUser?.username}`} playing as ${winnerNation?.name}`
      : 'TBD';

    const frontendUrl = getFrontendUrl(req);

    queueEmails(
      users.map(u => ({ email: u.email!, name: u.display_name, username: u.username })),
      `Tournament Completed: Champion Crowned in ${tournamentName}!`,
      (recipient) => {
        return `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e5e5e5; margin: 0; padding: 24px; }
              .card { max-width: 580px; margin: 0 auto; background-color: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 16px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); text-align: center; }
              h2 { font-size: 24px; font-weight: 900; color: #ffffff; margin-top: 0; letter-spacing: -0.03em; }
              p { font-size: 15px; line-height: 1.6; color: #a1a1a6; }
              .winner-section { background: rgba(245, 200, 66, 0.08); border: 1.5px solid rgba(245, 200, 66, 0.25); border-radius: 12px; padding: 20px; margin: 24px 0; }
              .winner-title { font-size: 11px; color: #F5C842; font-weight: 800; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 6px; }
              .winner-name { font-size: 20px; font-weight: 800; color: #ffffff; }
              .stats-section { border-top: 1px solid #2a2a2a; padding-top: 20px; margin-top: 24px; text-align: left; }
              .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #252528; }
              .stat-label { font-size: 14px; color: #a1a1a6; font-weight: 500; }
              .stat-val { font-size: 14px; color: #ffffff; font-weight: 600; text-align: right; }
              .footer { margin-top: 32px; font-size: 12px; color: #48484a; border-top: 1px solid #2a2a2a; padding-top: 16px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Tournament Completed!</h2>
              <p>The final whistle has blown for <strong>${tournamentName}</strong> and the champion has been crowned!</p>
              
              <div class="winner-section">
                <div class="winner-title">🏆 Tournament Champion 🏆</div>
                <div class="winner-name">${winnerText}</div>
              </div>

              <div class="stats-section">
                <h3 style="font-size: 16px; color: #ffffff; margin-bottom: 12px;">Tournament Statistics</h3>
                
                <div class="stat-row">
                  <span class="stat-label">⚽ Golden Boot (Top Scorer)</span>
                  <span class="stat-val">${topScorer}</span>
                </div>
                
                <div class="stat-row">
                  <span class="stat-label">👟 Playmaker (Top Assists)</span>
                  <span class="stat-val">${topAssister}</span>
                </div>
                
                <div class="stat-row">
                  <span class="stat-label">🧤 Golden Glove (Clean Sheets)</span>
                  <span class="stat-val">${topGlove}</span>
                </div>
              </div>
              
              <div class="footer">
                Matchup Tournaments.
              </div>
            </div>
          </body>
          </html>
        `;
      }
    );

    // Dispatch push notifications to all users
    if (users && users.length > 0) {
      for (const u of users) {
        sendUserPushNotification(u.id, {
          title: '🏆 Tournament Completed! 🏆',
          body: `Champion crowned in ${tournamentName}! Tap to view final standings and statistics.`,
          url: '/'
        });
      }
    }
  } catch (err) {
    console.error('[notifyTournamentWinner] Error:', err);
  }
}

/**
 * Calculates high-contrast text color (dark/light) based on background hex color
 */
function getContrastColor(hexColor: string): string {
  let cleanHex = hexColor.trim().replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }
  if (cleanHex.length !== 6) return '#FFFFFF';
  
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#121215' : '#FFFFFF';
}

/**
 * Sends a premium Apple-styled, tenant-branded invitation email to a player or admin.
 */
export async function sendTenantInvitationEmail(
  email: string,
  inviteId: string,
  tenant: { name: string; slug: string; logo_url: string | null; primary_color: string },
  role: 'player' | 'admin',
  req?: any
): Promise<boolean> {
  const frontendUrl = getFrontendUrl(req);
  const inviteLink = `${frontendUrl}/invite/${inviteId}`;
  
  const brandColor = tenant.primary_color || '#007aff'; // Default Apple blue
  const textColor = getContrastColor(brandColor); // Get optimal high-contrast text color
  const logoSrc = tenant.logo_url || 'https://i.imgur.com/KzWdOaH.png'; // Premium neutral fallback logo
  
  const subject = role === 'admin'
    ? `Action Required: Administrative Access to ${tenant.name}`
    : `Invitation: Join ${tenant.name} on Matchup`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tournament Invitation</title>
  <style>
    body {
      background-color: #0A0A0C;
      color: #F5F5F7;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #0A0A0C;
      padding: 40px 0;
    }
    .container {
      max-width: 540px;
      margin: 0 auto;
      background: #121215;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .brand-glow {
      height: 6px;
      background: linear-gradient(90deg, ${brandColor} 0%, ${brandColor}CC 50%, ${brandColor}33 100%);
    }
    .content {
      padding: 40px 32px 32px 32px;
      text-align: center;
    }
    .logo-container {
      width: 90px;
      height: 90px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.08);
      margin: 0 auto 24px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1), 0 8px 16px rgba(0, 0, 0, 0.4);
    }
    .logo-img {
      max-width: 80%;
      max-height: 80%;
      object-fit: contain;
      border-radius: 50%;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 20px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #A1A1A6;
    }
    .badge-admin {
      background: ${brandColor}15;
      border: 1px solid ${brandColor}30;
      color: ${brandColor};
    }
    h1 {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.25;
      color: #FFFFFF;
      margin: 0 0 16px 0;
      letter-spacing: -0.03em;
    }
    .subtitle {
      font-size: 15px;
      line-height: 1.6;
      color: #8E8E93;
      margin: 0 0 32px 0;
    }
    .invite-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 32px;
      text-align: left;
    }
    .info-row {
      margin-bottom: 12px;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      font-size: 12px;
      color: #8E8E93;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 15px;
      color: #FFFFFF;
      font-weight: 500;
    }
    .cta-btn {
      display: inline-block;
      background: ${brandColor};
      color: ${textColor} !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 15px;
      padding: 14px 40px;
      border-radius: 14px;
      margin: 0 auto;
      text-align: center;
      box-shadow: 0 4px 14px ${brandColor}40;
      transition: all 0.2s ease;
    }
    .cta-btn:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }
    .footer {
      padding: 32px;
      text-align: center;
      font-size: 12px;
      color: #636366;
      border-top: 1px solid rgba(255, 255, 255, 0.04);
    }
    .footer a {
      color: ${brandColor};
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="brand-glow"></div>
      <div class="content">
        <div class="logo-container">
          <img class="logo-img" src="${logoSrc}" alt="${tenant.name}">
        </div>
        
        <span class="badge ${role === 'admin' ? 'badge-admin' : ''}">
          ${role === 'admin' ? 'Co-Coordinator Invitation' : 'Tournament Invite'}
        </span>
        
        <h1>Join the Arena</h1>
        
        <p class="subtitle">
          You have been invited to join <strong>${tenant.name}</strong> as ${role === 'admin' ? 'an Administrator' : 'a Player'} on the Matchup platform.
        </p>
        
        <div class="invite-box">
          <div class="info-row">
            <div class="info-label">Tournament Organization</div>
            <div class="info-value">${tenant.name}</div>
          </div>
          <div class="info-row" style="margin-top: 16px;">
            <div class="info-label">Your Role</div>
            <div class="info-value" style="text-transform: capitalize; font-weight: 600; color: ${brandColor};">${role}</div>
          </div>
          <div class="info-row" style="margin-top: 16px;">
            <div class="info-label">Recipient Email</div>
            <div class="info-value" style="font-family: monospace;">${email}</div>
          </div>
        </div>
        
        <a href="${inviteLink}" class="cta-btn">Accept Invitation</a>
      </div>
      
      <div class="footer">
        This is an official invitation on behalf of the <strong>${tenant.name}</strong> league coordinators.<br>
        If you didn't expect this invitation, you can safely ignore this email.<br><br>
        Powered by <a href="${frontendUrl}">Matchup</a>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail([{ email }], subject, htmlContent);
}
