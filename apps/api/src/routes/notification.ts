import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { verifySession, requireRole } from '../middleware/auth';
import { getActiveTournament } from './tournament';
import { sendEmail, queueEmails, EmailRecipient } from '../services/email';

const router = Router();

/**
 * POST /notification/admin/remind-pending
 * Sends a single aggregate email to all players who have uncompleted matches in the active tournament stage.
 */
router.post('/admin/remind-pending', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const tournament = await getActiveTournament(req.tenantId);
    if (!tournament) {
      return res.status(404).json({ success: false, error: 'No active tournament found' });
    }

    if (tournament.status === 'completed' || tournament.status === 'registration') {
      return res.status(400).json({ success: false, error: 'Tournament is not in an active play stage' });
    }

    // Determine current stage filter
    let stageKey = '';
    if (tournament.status === 'pre_qual') stageKey = 'pre_qual';
    else if (tournament.status === 'group_stage') stageKey = 'group';
    else if (tournament.status === 'knockout') stageKey = 'knockout';

    if (!stageKey) {
      return res.status(400).json({ success: false, error: 'Cannot determine active stage for reminders' });
    }

    // Fetch claims with user email and team details
    const { data: rawClaims, error: claimsErr } = await supabaseAdmin
      .from('nation_claims')
      .select(`
        id,
        user_id,
        users!inner (
          email,
          display_name,
          username
        ),
        nations!inner (
          name
        )
      `)
      .eq('tournament_id', tournament.id);

    if (claimsErr || !rawClaims) {
      console.error('[remind-pending] Claims fetch error:', claimsErr);
      return res.status(500).json({ success: false, error: 'Failed to fetch player details' });
    }

    // Map to a clean, flat object structure to avoid TypeScript array joined object issues
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

    // Fetch uncompleted matches (scheduled or disputed, not verified/pending_verification)
    const { data: pendingMatches, error: matchesErr } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('tournament_id', tournament.id)
      .eq('stage', stageKey)
      .in('status', ['scheduled', 'disputed']);

    if (matchesErr || !pendingMatches) {
      console.error('[remind-pending] Matches fetch error:', matchesErr);
      return res.status(500).json({ success: false, error: 'Failed to fetch pending matches' });
    }

    if (pendingMatches.length === 0) {
      return res.json({ success: true, message: 'No pending matches found in this stage.' });
    }

    // Build lookup map for claims
    const claimMap = new Map<string, any>();
    for (const claim of claims) {
      claimMap.set(claim.id, claim);
    }

    // Group pending matches by user
    const userPendingFixtures = new Map<string, { recipient: EmailRecipient; fixtures: string[] }>();

    for (const match of pendingMatches) {
      const homeClaim = claimMap.get(match.home_claim_id);
      const awayClaim = claimMap.get(match.away_claim_id);

      if (homeClaim && homeClaim.user?.email) {
        const userId = homeClaim.user_id;
        if (!userPendingFixtures.has(userId)) {
          userPendingFixtures.set(userId, {
            recipient: {
              email: homeClaim.user.email,
              name: homeClaim.user.display_name,
              username: homeClaim.user.username,
            },
            fixtures: [],
          });
        }
        const opponentName = awayClaim ? awayClaim.nation?.name : 'TBD';
        userPendingFixtures.get(userId)!.fixtures.push(`${homeClaim.nation?.name} vs ${opponentName}`);
      }

      if (awayClaim && awayClaim.user?.email && !match.is_bye) {
        const userId = awayClaim.user_id;
        if (!userPendingFixtures.has(userId)) {
          userPendingFixtures.set(userId, {
            recipient: {
              email: awayClaim.user.email,
              name: awayClaim.user.display_name,
              username: awayClaim.user.username,
            },
            fixtures: [],
          });
        }
        const opponentName = homeClaim ? homeClaim.nation?.name : 'TBD';
        userPendingFixtures.get(userId)!.fixtures.push(`${awayClaim.nation?.name} vs ${opponentName}`);
      }
    }

    const recipients = Array.from(userPendingFixtures.values());

    if (recipients.length === 0) {
      return res.json({ success: true, message: 'No registered players found with pending matches.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Dispatch emails sequentially in background
    queueEmails(
      recipients.map(r => r.recipient),
      `Matchup Reminder: You have pending matches in ${tournament.name}`,
      (recipient) => {
        const matchingClaim = claims.find(c => c.user?.email === recipient.email);
        const userFixtures = userPendingFixtures.get(matchingClaim?.user_id || '')?.fixtures || [];
        const fixturesListHtml = userFixtures.map(f => `
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
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Pending Match Reminder</h2>
              <p>Hi ${recipient.name || `@${recipient.username}`},</p>
              <p>You have outstanding fixtures to play in <strong>${tournament.name}</strong> (${tournament.status === 'pre_qual' ? 'Pre-Qualifiers' : tournament.status === 'group_stage' ? 'Group Stage' : 'Knockout Stage'}). Please connect with your opponents and complete them as soon as possible:</p>
              
              <ul>
                ${fixturesListHtml}
              </ul>
              
              <div style="text-align: center;">
                <a href="${frontendUrl}" class="cta-btn">Access Matchup Dashboard</a>
              </div>
              
              <div class="footer">
                Matchup Tournament Management platform. Generously automated.
              </div>
            </div>
          </body>
          </html>
        `;
      }
    );

    return res.json({ success: true, message: `Dispatched ${recipients.length} reminder email(s) in background.` });
  } catch (err: any) {
    console.error('[remind-pending] Error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * POST /notification/admin/broadcast
 * Broadcasts an announcement to all registered players with configured emails
 */
router.post('/admin/broadcast', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { subject, message } = req.body as { subject?: string; message?: string };

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, error: 'Subject and message are required.' });
    }

    const tournament = await getActiveTournament(req.tenantId);
    if (!tournament) {
      return res.status(404).json({ success: false, error: 'No active tournament found' });
    }

    // Fetch all claims for the active tournament with joined user email
    const { data: claims, error: claimsErr } = await supabaseAdmin
      .from('nation_claims')
      .select(`
        users!inner (
          email,
          display_name,
          username
        )
      `)
      .eq('tournament_id', tournament.id);

    if (claimsErr || !claims) {
      console.error('[broadcast] Claims fetch error:', claimsErr);
      return res.status(500).json({ success: false, error: 'Failed to fetch tournament players' });
    }

    // Extract unique users with valid emails
    const userMap = new Map<string, { email: string; display_name: string; username: string }>();
    for (const claim of claims) {
      const u = Array.isArray(claim.users) ? claim.users[0] : (claim.users as any);
      if (u && u.email && u.email.trim()) {
        userMap.set(u.email.trim().toLowerCase(), {
          email: u.email.trim(),
          display_name: u.display_name,
          username: u.username,
        });
      }
    }

    const users = Array.from(userMap.values());

    if (users.length === 0) {
      return res.json({ success: true, message: 'No registered players with emails found in the current tournament.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    queueEmails(
      users.map(u => ({ email: u.email!, name: u.display_name, username: u.username })),
      subject.trim(),
      (recipient) => {
        return `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e5e5e5; margin: 0; padding: 24px; }
              .card { max-width: 580px; margin: 0 auto; background-color: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 16px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
              h2 { font-size: 22px; font-weight: 800; color: #ffffff; margin-top: 0; letter-spacing: -0.02em; }
              p { font-size: 15px; line-height: 1.6; color: #a1a1a6; white-space: pre-wrap; }
              .cta-btn { display: inline-block; padding: 12px 24px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #ffffff; font-weight: 600; font-size: 14px; border-radius: 8px; text-decoration: none; text-align: center; margin-top: 16px; }
              .footer { margin-top: 32px; font-size: 12px; color: #48484a; border-top: 1px solid #2a2a2a; padding-top: 16px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>Tournament Broadcast Announcement</h2>
              <p>Hi ${recipient.name || `@${recipient.username}`},</p>
              <p>${message.trim()}</p>
              
              <div style="text-align: center;">
                <a href="${frontendUrl}" class="cta-btn">Open Matchup App</a>
              </div>
              
              <div class="footer">
                Matchup Tournament Management platform.
              </div>
            </div>
          </body>
          </html>
        `;
      }
    );

    return res.json({ success: true, message: `Dispatched announcement broadcast to ${users.length} user(s) in background.` });
  } catch (err: any) {
    console.error('[broadcast] Error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

/**
 * POST /notification/admin/notify-winner
 * Sends a custom direct reward claim instruction email to the winner of the latest completed tournament.
 */
router.post('/admin/notify-winner', verifySession, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { message } = req.body as { message?: string };
    if (!message?.trim()) {
      return res.status(400).json({ success: false, error: 'Message content is required.' });
    }

    // Fetch the latest completed tournament
    const { data: tournament, error: tErr } = await supabaseAdmin
      .from('tournaments')
      .select('*')
      .eq('tenant_id', req.tenantId || '00000000-0000-0000-0000-000000000000')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tErr || !tournament) {
      return res.status(404).json({ success: false, error: 'No completed tournament found to notify the winner.' });
    }

    // Fetch all claims for this tournament to find the qualified winner
    const { data: claims, error: claimsErr } = await supabaseAdmin
      .from('nation_claims')
      .select(`
        id,
        status,
        users!inner (
          email,
          display_name,
          username
        ),
        nations!inner (
          name
        )
      `)
      .eq('tournament_id', tournament.id);

    if (claimsErr || !claims) {
      console.error('[notify-winner] Claims fetch error:', claimsErr);
      return res.status(500).json({ success: false, error: 'Failed to fetch tournament participants' });
    }

    const winnerClaim = claims.find((c: any) => c.status === 'qualified');
    if (!winnerClaim) {
      return res.status(404).json({ success: false, error: 'No qualified winner claim found for this tournament.' });
    }

    const winnerUser = Array.isArray(winnerClaim.users) ? winnerClaim.users[0] : (winnerClaim.users as any);
    const winnerNation = Array.isArray(winnerClaim.nations) ? winnerClaim.nations[0] : (winnerClaim.nations as any);

    if (!winnerUser || !winnerUser.email) {
      return res.status(400).json({ success: false, error: 'Winner user details or email is missing.' });
    }

    // Send the email
    const subject = `Congratulations on winning ${tournament.name}! Claim your reward`;
    const recipient = {
      email: winnerUser.email,
      name: winnerUser.display_name,
      username: winnerUser.username,
    };

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const mailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #121212; color: #e5e5e5; margin: 0; padding: 24px; }
          .card { max-width: 580px; margin: 0 auto; background-color: #1c1c1e; border: 1px solid #2c2c2e; border-radius: 16px; padding: 32px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
          h2 { font-size: 22px; font-weight: 800; color: #ffffff; margin-top: 0; letter-spacing: -0.02em; }
          p { font-size: 15px; line-height: 1.6; color: #a1a1a6; white-space: pre-wrap; }
          .highlight-box { background: rgba(245, 200, 66, 0.08); border: 1px solid rgba(245, 200, 66, 0.2); border-radius: 10px; padding: 16px; margin: 20px 0; }
          .highlight-title { font-size: 11px; color: #F5C842; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
          .cta-btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #F5C842 0%, #D4AF37 100%); color: #121212; font-weight: 700; font-size: 15px; border-radius: 8px; text-decoration: none; text-align: center; margin-top: 12px; }
          .footer { margin-top: 32px; font-size: 12px; color: #48484a; border-top: 1px solid #2a2a2a; padding-top: 16px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🏆 Reward Claim Instructions 🏆</h2>
          <p>Hi ${recipient.name || `@${recipient.username}`},</p>
          <p>Congratulations once again on winning <strong>${tournament.name}</strong> playing as <strong>${winnerNation?.name || 'your selected nation'}</strong>!</p>
          
          <div class="highlight-box">
            <div class="highlight-title">Message from the Admin:</div>
            <p style="margin: 0; color: #ffffff; font-size: 15px;">${message.trim()}</p>
          </div>
          
          <div style="text-align: center;">
            <a href="${frontendUrl}" class="cta-btn">Go to Dashboard</a>
          </div>
          
          <div class="footer">
            Matchup Tournament Management platform.
          </div>
        </div>
      </body>
      </html>
    `;

    // Queue email sequentially
    queueEmails([recipient], subject, () => mailHtml);

    return res.json({
      success: true,
      message: `Direct claim notification email queued successfully for the champion (${recipient.email}).`,
    });
  } catch (err: any) {
    console.error('[notify-winner] Error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

export default router;
