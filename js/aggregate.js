import { CONFIG, getTeamSide } from './api.js';

/** @typedef {import('./types.js').PlayerStats} PlayerStats */
/** @typedef {import('./types.js').TeamRecord} TeamRecord */
/** @typedef {import('./types.js').FixtureSummary} FixtureSummary */
/** @typedef {import('./types.js').MatchSummary} MatchSummary */
/** @typedef {import('./types.js').CompetitionStats} CompetitionStats */
/** @typedef {import('./types.js').SeasonBundle} SeasonBundle */
/** @typedef {import('./types.js').DashboardStats} DashboardStats */

/** @param {Array<{ date?: string }>} matches @returns {string|null} */
export function deriveSeasonYearLabel(matches) {
  const years = matches
    .map((match) => match.date && new Date(match.date).getFullYear())
    .filter((year) => Number.isFinite(year));

  if (years.length === 0) {
    return null;
  }

  const startYear = Math.min(...years);
  const endYear = Math.max(...years);

  if (startYear === endYear) {
    return String(startYear);
  }

  return `${startYear}/${String(endYear).slice(-2)}`;
}

/** @param {string} name @param {Array<{ date?: string }>} matches */
export function formatCompetitionDisplayName(name, matches) {
  const yearLabel = deriveSeasonYearLabel(matches);
  return yearLabel ? `${name} (${yearLabel})` : name;
}

/** @param {CompetitionStats} competitionStats @param {boolean} [updateMatchNames] */
function applyCompetitionDisplayName(competitionStats, updateMatchNames = true) {
  competitionStats.displayName = formatCompetitionDisplayName(
    competitionStats.name,
    competitionStats.matches,
  );

  if (!updateMatchNames) {
    return;
  }

  for (const match of competitionStats.matches) {
    match.competitionName = competitionStats.displayName;
  }

  for (const fixture of competitionStats.fixtures) {
    fixture.competitionName = competitionStats.displayName;
  }
}

/** @returns {TeamRecord} */
function emptyTeamRecord() {
  return {
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

/** @returns {CompetitionStats} */
function emptyCompetitionStats(id, name, active) {
  return {
    id,
    name,
    active,
    players: {},
    teamRecord: emptyTeamRecord(),
    matches: [],
    fixtures: [],
  };
}

/** @returns {PlayerStats} */
function emptyPlayer(personId, name, shortName, shirtNumber) {
  return {
    personId,
    name,
    shortName,
    shirtNumber,
    goals: 0,
    appearances: 0,
    minutes: 0,
    yellowCards: 0,
    redCards: 0,
    assists: 0,
  };
}

/**
 * @param {Record<string, PlayerStats>} players
 * @param {PlayerStats} stats
 */
function upsertPlayer(players, stats) {
  const existing = players[String(stats.personId)];
  if (!existing) {
    players[String(stats.personId)] = { ...stats };
    return;
  }

  existing.goals += stats.goals;
  existing.appearances += stats.appearances;
  existing.minutes += stats.minutes;
  existing.yellowCards += stats.yellowCards;
  existing.redCards += stats.redCards;
}

/**
 * @param {Record<string, PlayerStats>} players
 * @param {object} sideLineup
 * @param {object[]} events
 * @param {boolean} isHome
 */
function applyLineupStats(players, sideLineup, events, isHome) {
  if (!sideLineup?.players?.length) {
    return;
  }

  const subEvents = collectSubstitutionEvents(sideLineup.players);
  const matchLength = CONFIG.matchLengthMinutes;

  for (const player of sideLineup.players) {
    const personId = player.personId;
    if (!personId) {
      continue;
    }

    const subInfo = subEvents.get(personId) ?? { onMinute: null, offMinute: null };
    let onMinute = subInfo.onMinute;
    let offMinute = subInfo.offMinute;

    if (onMinute === null && (player.starting || offMinute !== null)) {
      onMinute = 0;
    }

    if (onMinute === null) {
      continue;
    }

    if (offMinute === null) {
      offMinute = matchLength;
    }

    const minutes = Math.max(0, offMinute - onMinute);
    if (minutes <= 0) {
      continue;
    }

    upsertPlayer(players, {
      ...emptyPlayer(
        personId,
        player.name ?? player.shortName ?? 'Unknown',
        player.shortName ?? player.name ?? 'Unknown',
        player.shirtNumber ?? null,
      ),
      appearances: 1,
      minutes,
    });
  }

  for (const event of events) {
    const type = event.eventType?.fcdName;
    if (!event.player?.personId) {
      continue;
    }

    if (event.homeTeam !== isHome) {
      continue;
    }

    const personId = event.player.personId;
    const base = emptyPlayer(
      personId,
      event.player.name ?? event.player.shortName ?? 'Unknown',
      event.player.shortName ?? event.player.name ?? 'Unknown',
      event.player.shirtNumber ?? null,
    );

    if (type === 'GOAL') {
      upsertPlayer(players, { ...base, goals: 1, appearances: 0, minutes: 0 });
    }

    if (type === 'YELLOW') {
      upsertPlayer(players, { ...base, yellowCards: 1, appearances: 0, minutes: 0 });
    }

    if (type === 'SECOND_YELLOW') {
      upsertPlayer(players, { ...base, redCards: 1, appearances: 0, minutes: 0 });
    }
  }
}

/** @param {object[]} players */
function collectSubstitutionEvents(players) {
  /** @type {Map<number, { onMinute: number|null, offMinute: number|null }>} */
  const map = new Map();
  /** @type {Set<number>} */
  const seen = new Set();

  for (const player of players) {
    for (const event of player.events ?? []) {
      if (event.eventType?.fcdName !== 'SUBSTITUTION') {
        continue;
      }

      const eventId = event.eventId;
      if (eventId && seen.has(eventId)) {
        continue;
      }
      if (eventId) {
        seen.add(eventId);
      }

      const minute = event.minuteFull ?? event.minute ?? 0;
      const offId = event.player?.personId;
      const onId = event.player2?.personId;

      if (offId) {
        const entry = map.get(offId) ?? { onMinute: null, offMinute: null };
        entry.offMinute = minute;
        map.set(offId, entry);
      }

      if (onId) {
        const entry = map.get(onId) ?? { onMinute: null, offMinute: null };
        entry.onMinute = minute;
        map.set(onId, entry);
      }
    }
  }

  return map;
}

/**
 * @param {object} match
 * @param {'home'|'away'} side
 */
function getGoals(match, side) {
  const homeGoals = match.homeTeamResult?.current ?? 0;
  const awayGoals = match.awayTeamResult?.current ?? 0;
  return side === 'home'
    ? { goalsFor: homeGoals, goalsAgainst: awayGoals }
    : { goalsFor: awayGoals, goalsAgainst: homeGoals };
}

/**
 * @param {object} competition
 * @param {object} match
 * @param {'home'|'away'} side
 * @returns {FixtureSummary}
 */
function buildFixtureSummary(competition, match, side) {
  const opponent =
    side === 'home' ? match.awayTeam.name : match.homeTeam.name;

  return {
    id: match.id,
    competitionId: String(competition.id),
    competitionName: competition.name,
    date: match.dateTimeUTC
      ? new Date(match.dateTimeUTC).toISOString()
      : '',
    round: match.round ?? '',
    opponent,
    isHome: side === 'home',
  };
}

/** @param {object} event */
function isTeamScoringEvent(event) {
  const type = event.eventType?.fcdName;
  return (type === 'GOAL' || type === 'PENALTY') && Boolean(event.player);
}

/**
 * @param {object[]} events
 * @param {boolean} isHome
 * @returns {import('./types.js').GoalScorer[]}
 */
function collectTeamGoalScorers(events, isHome) {
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .filter(
      (event) => isTeamScoringEvent(event) && event.homeTeam === isHome,
    )
    .sort(
      (a, b) =>
        (a.minuteFull ?? a.minute ?? 0) - (b.minuteFull ?? b.minute ?? 0),
    )
    .map((event) => ({
      shortName: event.player.shortName ?? event.player.name ?? 'Unknown',
      minute: event.minuteFull ?? event.minute ?? 0,
    }));
}

/**
 * @param {object} competition
 * @param {object} match
 * @param {'home'|'away'} side
 * @param {object[]} [events]
 * @returns {MatchSummary}
 */
function buildMatchSummary(competition, match, side, events = []) {
  const { goalsFor, goalsAgainst } = getGoals(match, side);
  const opponent =
    side === 'home' ? match.awayTeam.name : match.homeTeam.name;
  let result = 'D';
  if (goalsFor > goalsAgainst) {
    result = 'W';
  } else if (goalsFor < goalsAgainst) {
    result = 'L';
  }

  return {
    id: match.id,
    competitionId: String(competition.id),
    competitionName: competition.name,
    date: match.dateTimeUTC
      ? new Date(match.dateTimeUTC).toISOString()
      : '',
    round: match.round ?? '',
    opponent,
    isHome: side === 'home',
    goalsFor,
    goalsAgainst,
    result,
    scoreline: `${goalsFor}-${goalsAgainst}`,
    goalScorers: collectTeamGoalScorers(events, side === 'home'),
  };
}

/** @param {TeamRecord} record @param {MatchSummary} summary */
function applyTeamRecord(record, summary) {
  record.played += 1;
  record.goalsFor += summary.goalsFor;
  record.goalsAgainst += summary.goalsAgainst;

  if (summary.result === 'W') {
    record.won += 1;
  } else if (summary.result === 'D') {
    record.drawn += 1;
  } else {
    record.lost += 1;
  }
}

/**
 * @param {object[]} fixtureEntries
 * @returns {FixtureSummary[]}
 */
export function aggregateFixtures(fixtureEntries) {
  /** @type {FixtureSummary[]} */
  const fixtures = [];

  for (const { competition, match } of fixtureEntries) {
    const side = getTeamSide(match);
    if (!side) {
      continue;
    }

    fixtures.push(buildFixtureSummary(competition, match, side));
  }

  fixtures.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  return fixtures;
}

/**
 * @param {object[]} matchDetails
 * @param {boolean} active
 * @returns {SeasonBundle}
 */
export function aggregateSeason(matchDetails, active) {
  /** @type {Record<string, CompetitionStats>} */
  const competitions = {};
  /** @type {SeasonBundle} */
  const overall = {
    id: active ? 'current' : 'previous',
    name: active ? 'Current season' : 'Previous season',
    active,
    players: {},
    teamRecord: emptyTeamRecord(),
    matches: [],
    fixtures: [],
  };

  let teamDisplayName = CONFIG.teamMatch;

  for (const { competition, match, lineups, events } of matchDetails) {
    const side = getTeamSide(match);
    if (!side) {
      continue;
    }

    const compId = String(competition.id);
    if (!competitions[compId]) {
      competitions[compId] = emptyCompetitionStats(
        compId,
        competition.name,
        active,
      );
    }

    const isHome = side === 'home';
    const team = isHome ? match.homeTeam : match.awayTeam;
    teamDisplayName = team.parent?.name ?? team.name;

    const summary = buildMatchSummary(competition, match, side, events);
    const compStats = competitions[compId];

    compStats.matches.push(summary);
    applyTeamRecord(compStats.teamRecord, summary);
    applyTeamRecord(overall.teamRecord, summary);
    overall.matches.push(summary);

    if (lineups) {
      const sideLineup = lineups[side];
      applyLineupStats(compStats.players, sideLineup, events, isHome);
      applyLineupStats(overall.players, sideLineup, events, isHome);
    } else {
      for (const event of events) {
        if (event.eventType?.fcdName !== 'GOAL' || !event.player?.personId) {
          continue;
        }
        if (event.homeTeam !== isHome) {
          continue;
        }

        upsertPlayer(compStats.players, {
          ...emptyPlayer(
            event.player.personId,
            event.player.name,
            event.player.shortName,
            event.player.shirtNumber ?? null,
          ),
          goals: 1,
        });
        upsertPlayer(overall.players, {
          ...emptyPlayer(
            event.player.personId,
            event.player.name,
            event.player.shortName,
            event.player.shirtNumber ?? null,
          ),
          goals: 1,
        });
      }
    }
  }

  for (const comp of Object.values(competitions)) {
    comp.matches.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    applyCompetitionDisplayName(comp);
  }
  overall.matches.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  applyCompetitionDisplayName(overall, false);

  return {
    bundle: overall,
    competitions,
    teamDisplayName,
  };
}

/**
 * @param {DashboardStats} stats
 * @param {{ generatedAt?: string, seasons?: Array<{ id: string, name: string, stats: CompetitionStats }> }|null} stored
 * @returns {DashboardStats}
 */
export function mergeCompletedSeasons(stats, stored) {
  if (!stored?.seasons?.length) {
    return stats;
  }

  /** @type {Record<string, CompetitionStats>} */
  const previousSeasons = { ...stats.previousSeasons };
  /** @type {import('./types.js').CompetitionOption[]} */
  const previousCompetitions = [];

  for (const season of stored.seasons) {
    const displayName =
      season.stats.displayName ??
      formatCompetitionDisplayName(season.name, season.stats.matches ?? []);
    previousCompetitions.push({
      id: season.id,
      name: season.name,
      displayName,
      active: false,
    });
    previousSeasons[season.id] = {
      ...season.stats,
      displayName,
    };
  }

  previousCompetitions.sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...stats,
    previousCompetitions,
    previousSeasons,
  };
}

/**
 * @param {object} payload
 * @returns {DashboardStats}
 */
export function aggregateStats(payload) {
  const current = aggregateSeason(payload.currentMatchDetails ?? [], true);
  const fixtures = aggregateFixtures(payload.fixtureEntries ?? []);

  for (const fixture of fixtures) {
    const competition = current.competitions[fixture.competitionId];
    if (competition?.displayName) {
      fixture.competitionName = competition.displayName;
      continue;
    }

    fixture.competitionName = formatCompetitionDisplayName(fixture.competitionName, [
      { date: fixture.date },
    ]);
  }

  return {
    generatedAt: new Date().toISOString(),
    teamDisplayName: current.teamDisplayName,
    fixtures,
    currentSeason: current.bundle,
    currentCompetitions: current.competitions,
    previousCompetitions: (payload.previousCompetitions ?? []).map((comp) => ({
      id: String(comp.id),
      name: comp.name,
      displayName: comp.displayName,
      active: false,
    })),
    previousSeasons: {},
  };
}

/**
 * @param {object[]} matchDetails
 * @param {object} competition
 * @returns {{ competitionStats: CompetitionStats, overall: SeasonBundle }}
 */
export function aggregatePreviousCompetition(matchDetails, competition) {
  const result = aggregateSeason(matchDetails, false);
  const compId = String(competition.id);
  const competitionStats =
    result.competitions[compId] ??
    emptyCompetitionStats(compId, competition.name, false);

  return {
    competitionStats,
    overall: result.bundle,
  };
}

/** @param {Record<string, PlayerStats>} players @param {string} metric */
export function sortPlayers(players, metric) {
  return Object.values(players).sort((a, b) => {
    const diff = (b[metric] ?? 0) - (a[metric] ?? 0);
    if (diff !== 0) {
      return diff;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * @param {PlayerStats[]} sortedPlayers
 * @param {string} metric
 * @returns {Array<{ player: PlayerStats, rank: number }>}
 */
export function rankPlayers(sortedPlayers, metric) {
  let rank = 0;
  let lastValue = null;

  return sortedPlayers.map((player, index) => {
    const value = player[metric] ?? 0;
    if (index === 0 || value !== lastValue) {
      rank = index + 1;
      lastValue = value;
    }

    return { player, rank };
  });
}

/** @param {Record<string, CompetitionStats>} competitions @returns {Record<string, PlayerStats>} */
export function mergeCompetitionPlayers(competitions) {
  /** @type {Record<string, PlayerStats>} */
  const players = {};

  for (const comp of Object.values(competitions)) {
    for (const stats of Object.values(comp.players)) {
      upsertPlayer(players, stats);
    }
  }

  return players;
}

/**
 * @param {object} payload
 * @param {(competitionStats: CompetitionStats, competition: object, matchDetails: object[]) => Promise<CompetitionStats>} enricher
 * @returns {Promise<DashboardStats>}
 */
export async function aggregateStatsWithOfficialPlayers(payload, enricher) {
  const stats = aggregateStats(payload);

  for (const competition of payload.currentCompetitions ?? []) {
    const compId = String(competition.id);
    const competitionStats = stats.currentCompetitions[compId];
    if (!competitionStats) {
      continue;
    }

    const matchDetails = (payload.currentMatchDetails ?? []).filter(
      (entry) => String(entry.competition?.id) === compId,
    );

    stats.currentCompetitions[compId] = await enricher(
      competitionStats,
      competition,
      matchDetails,
    );
  }

  stats.currentSeason.players = mergeCompetitionPlayers(stats.currentCompetitions);
  return stats;
}

export { CONFIG };
