import { supabaseAdmin } from '../lib/supabase';

export interface TournamentStatsData {
  topScorers: any[];
  topPlaymakers: any[];
  topGoalkeepers: any[];
}

export async function getTournamentStatsRaw(tournamentId: string): Promise<TournamentStatsData> {
  const { data: matchesList } = await supabaseAdmin
    .from('matches')
    .select('id')
    .eq('tournament_id', tournamentId);

  const matchIds = matchesList?.map(m => m.id) || [];

  let topScorers: any[] = [];
  let topPlaymakers: any[] = [];
  let topGoalkeepers: any[] = [];

  if (matchIds.length > 0) {
    // Fetch goals and assists
    const { data: events, error: evErr } = await supabaseAdmin
      .from('match_events')
      .select('player_id, event_type, claim_id, player:players(*), claim:nation_claims(*, users(id, username, display_name), nations(id, name, flag_url))')
      .in('match_id', matchIds);

    if (evErr) {
      console.error('Error fetching match events:', evErr);
    }

    const scorersMap: Record<string, { player: any; claim: any; count: number }> = {};
    const playmakersMap: Record<string, { player: any; claim: any; count: number }> = {};

    if (events) {
      for (const item of events) {
        if (!item.player_id) continue;
        const pid = String(item.player_id);
        const detail = {
          player: item.player,
          claim: item.claim,
          count: 0
        };
        if (item.event_type === 'goal') {
          if (!scorersMap[pid]) scorersMap[pid] = detail;
          scorersMap[pid].count++;
        } else if (item.event_type === 'assist') {
          if (!playmakersMap[pid]) playmakersMap[pid] = detail;
          playmakersMap[pid].count++;
        }
      }
    }

    topScorers = Object.values(scorersMap).sort((a, b) => b.count - a.count);
    topPlaymakers = Object.values(playmakersMap).sort((a, b) => b.count - a.count);

    // Fetch goalkeeper stats
    const { data: claims } = await supabaseAdmin
      .from('nation_claims')
      .select('id, nation_id, nations(id, name, flag_url), users(id, username, display_name)')
      .eq('tournament_id', tournamentId);

    const { data: squads } = await supabaseAdmin
      .from('squads')
      .select('claim_id, positions')
      .eq('tournament_id', tournamentId);

    const { data: verifiedMatches } = await supabaseAdmin
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('status', 'verified');

    if (claims && squads) {
      const gkPlayerIds = squads.map(s => s.positions?.GK).filter(Boolean) as number[];
      
      let gkPlayers: any[] = [];
      if (gkPlayerIds.length > 0) {
        const { data: dbGks } = await supabaseAdmin
          .from('players')
          .select('*')
          .in('id', gkPlayerIds);
        gkPlayers = dbGks || [];
      }

      const gkStats = claims.map(claim => {
        const squad = squads.find(s => s.claim_id === claim.id);
        const gkId = squad?.positions?.GK;
        const gkPlayer = gkPlayers.find(p => String(p.id) === String(gkId));
        
        if (!gkPlayer) return null;

        const teamMatches = verifiedMatches?.filter(m => m.home_claim_id === claim.id || m.away_claim_id === claim.id) || [];
        let cleanSheets = 0;
        let goalsConceded = 0;

        for (const m of teamMatches) {
          const opponentGoals = m.home_claim_id === claim.id ? m.away_score : m.home_score;
          if (opponentGoals === 0) cleanSheets++;
          goalsConceded += opponentGoals || 0;
        }

        return {
          player: gkPlayer,
          claim,
          cleanSheets,
          goalsConceded,
          matchesPlayed: teamMatches.length
        };
      }).filter(Boolean);

      topGoalkeepers = (gkStats as any[]).sort((a, b) => {
        if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
        return a.goalsConceded - b.goalsConceded; // secondary sort: fewer goals conceded
      });
    }
  }

  return {
    topScorers,
    topPlaymakers,
    topGoalkeepers
  };
}
