import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getTeamSide } from '../js/api.js';

/**
 * @param {object} event
 */
function simplifyEvent(event) {
  return {
    minute: event.minuteFull ?? event.minute ?? null,
    type: event.eventType?.fcdName ?? event.eventType?.name ?? null,
    personId: event.player?.personId ?? null,
    playerName: event.player?.name ?? event.player?.shortName ?? null,
    homeTeam: Boolean(event.homeTeam),
  };
}

/**
 * @param {object} lineupSide
 */
function simplifyLineup(lineupSide) {
  const players = lineupSide?.players ?? [];
  return {
    starters: players
      .filter((player) => player.starting)
      .map((player) => ({
        personId: player.personId,
        name: player.name ?? player.shortName,
        shirtNumber: player.shirtNumber ?? null,
      })),
    substitutes: players
      .filter((player) => !player.starting)
      .map((player) => ({
        personId: player.personId,
        name: player.name ?? player.shortName,
        shirtNumber: player.shirtNumber ?? null,
      })),
  };
}

/**
 * @param {object[]} matchDetails
 */
export function buildMatchInsights(matchDetails) {
  return matchDetails.map(({ match, lineups, events, competition }) => {
    const side = getTeamSide(match);
    return {
      matchId: match.id,
      competitionId: competition?.id ?? match.competition?.id,
      competitionName: competition?.name ?? match.competition?.name,
      date: match.dateTimeUTC
        ? new Date(match.dateTimeUTC).toISOString()
        : null,
      round: match.round ?? null,
      homeTeam: match.homeTeam?.name,
      awayTeam: match.awayTeam?.name,
      homeGoals: match.homeGoals ?? match.result?.home ?? null,
      awayGoals: match.awayGoals ?? match.result?.away ?? null,
      teamSide: side,
      events: (Array.isArray(events) ? events : []).map(simplifyEvent),
      lineup: side ? simplifyLineup(lineups?.[side]) : null,
    };
  });
}

/**
 * @param {string} outPath
 * @param {object} payload
 */
export function writeInsights(outPath, payload) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        note: 'Extra Clubforce data for occasional team analysis. Not loaded by the public website.',
        generatedAt: new Date().toISOString(),
        ...payload,
      },
      null,
      2,
    )}\n`,
  );
}
