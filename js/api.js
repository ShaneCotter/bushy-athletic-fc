import { CONFIG } from './config.js';

const API_BASE = 'https://api-fai.analyticom.de/api/live';

/**
 * @param {string} path
 * @param {Record<string, string|number>} [params]
 */
async function apiFetch(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set('organizationIdFilter', String(CONFIG.organizationId));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: {
      API_KEY: CONFIG.apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed (${response.status}): ${path}`);
  }

  return response.json();
}

/**
 * @param {object} team
 */
export function isTargetTeam(team) {
  if (team.name.includes(CONFIG.teamMatch)) {
    return true;
  }

  return Boolean(team.parent?.name?.includes(CONFIG.teamMatch));
}

/**
 * @param {object} match
 */
export function isTeamMatch(match) {
  return isTargetTeam(match.homeTeam) || isTargetTeam(match.awayTeam);
}

/**
 * @param {object} match
 */
export function getTeamSide(match) {
  if (isTargetTeam(match.homeTeam)) {
    return 'home';
  }

  if (isTargetTeam(match.awayTeam)) {
    return 'away';
  }

  return null;
}

/**
 * @param {object} match
 */
export function isFutureMatch(match) {
  if (!match.dateTimeUTC) {
    return false;
  }

  return match.dateTimeUTC > Date.now();
}

/**
 * @param {number} concurrency
 */
export function createPool(concurrency) {
  let active = 0;
  /** @type {Array<() => void>} */
  const queue = [];

  const runNext = () => {
    if (active >= concurrency || queue.length === 0) {
      return;
    }

    active += 1;
    const next = queue.shift();
    next?.();
  };

  return (task) =>
    new Promise((resolve, reject) => {
      const run = async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        } finally {
          active -= 1;
          runNext();
        }
      };

      queue.push(run);
      runNext();
    });
}

/**
 * @param {object} competition
 * @returns {Promise<boolean>}
 */
async function competitionIncludesTeam(competition) {
  try {
    const table = await apiFetch(`/competition/${competition.id}/table/official`);
    if (table.standings?.some((row) => isTargetTeam(row.team))) {
      return true;
    }
  } catch {
    // Some competitions have no league table.
  }

  const [past, future] = await Promise.all([
    apiFetch(`/competition/${competition.id}/matches/paginated/past/1`, {
      pageSize: 20,
      page: 1,
    }).catch(() => ({ result: [] })),
    apiFetch(`/competition/${competition.id}/matches/paginated/future/1`, {
      pageSize: 20,
      page: 1,
    }).catch(() => ({ result: [] })),
  ]);

  return (
    past.result.some(isTeamMatch) ||
    (future.result ?? []).some(isTeamMatch)
  );
}

/**
 * @param {object[]} competitions
 * @param {(message: string) => void} [onProgress]
 */
async function discoverTeamCompetitions(competitions, onProgress) {
  const pool = createPool(6);
  let checked = 0;

  const results = await Promise.all(
    competitions.map((competition) =>
      pool(async () => {
        checked += 1;
        onProgress?.(`Checking competitions (${checked}/${competitions.length})…`);
        const included = await competitionIncludesTeam(competition);
        return included ? competition : null;
      }),
    ),
  );

  return results.filter(Boolean);
}

/**
 * @param {object} competition
 */
async function fetchAllPastTeamMatches(competition) {
  /** @type {object[]} */
  const matches = [];
  let page = 1;

  while (true) {
    const past = await apiFetch(
      `/competition/${competition.id}/matches/paginated/past/1`,
      { pageSize: 100, page },
    );
    const batch = past.result.filter(isTeamMatch);
    matches.push(...batch);

    if (!past.result.length || past.result.length < 100) {
      break;
    }

    page += 1;
  }

  return matches;
}

/**
 * @param {object[]} competitions
 * @param {object[]} matches
 * @param {(message: string) => void} [onProgress]
 */
async function fetchMatchDetails(competitions, matches, onProgress) {
  const competitionById = new Map(competitions.map((comp) => [comp.id, comp]));
  const pool = createPool(4);
  let processed = 0;

  return Promise.all(
    matches.map((match) =>
      pool(async () => {
        processed += 1;
        onProgress?.(`Loading match ${processed} of ${matches.length}…`);

        const competition =
          competitionById.get(match.competition?.id) ??
          competitionById.get(match.competitionId) ??
          match.competition;

        const [lineups, events] = await Promise.all([
          apiFetch(`/match/${match.id}/lineups`).catch(() => null),
          apiFetch(`/match/${match.id}/events`).catch(() => []),
        ]);

        return {
          competition,
          match,
          lineups,
          events: Array.isArray(events) ? events : [],
        };
      }),
    ),
  );
}

/**
 * @param {object[]} competitions
 * @param {(message: string) => void} [onProgress]
 */
async function fetchFutureFixtures(competitions, onProgress) {
  /** @type {{ competition: object, match: object }[]} */
  const fixtureEntries = [];

  for (const competition of competitions) {
    onProgress?.(`Checking upcoming fixtures for ${competition.name}…`);

    const future = await apiFetch(
      `/competition/${competition.id}/matches/paginated/future/1`,
      { pageSize: 100, page: 1 },
    ).catch(() => ({ result: [] }));

    for (const match of future.result ?? []) {
      if (!isTeamMatch(match) || !isFutureMatch(match)) {
        continue;
      }

      fixtureEntries.push({ competition, match });
    }
  }

  return fixtureEntries;
}

/** @param {(message: string) => void} [onProgress] */
export async function loadDashboardData(onProgress) {
  const report = (message) => onProgress?.(message);

  report('Loading competitions…');
  const activeCompetitions = await apiFetch('/competition/list/active');

  report('Finding current season competitions…');
  const currentCompetitions = await discoverTeamCompetitions(
    activeCompetitions,
    report,
  );

  report('Loading upcoming fixtures…');
  const fixtureEntries = await fetchFutureFixtures(currentCompetitions, report);

  report('Loading current season results…');
  const currentMatches = (
    await Promise.all(
      currentCompetitions.map((competition) => fetchAllPastTeamMatches(competition)),
    )
  ).flat();

  const currentMatchDetails = await fetchMatchDetails(
    currentCompetitions,
    currentMatches,
    report,
  );

  report('Calculating stats…');

  return {
    currentCompetitions,
    previousCompetitions: [],
    fixtureEntries,
    currentMatchDetails,
  };
}

/**
 * @param {(message: string) => void} [onProgress]
 * @returns {Promise<object[]>}
 */
export async function discoverPreviousCompetitions(onProgress) {
  const report = (message) => onProgress?.(message);
  report('Searching previous seasons…');

  const allCompetitions = await apiFetch('/competition/list/all');
  const inactiveCompetitions = allCompetitions.filter((comp) => !comp.active);

  return discoverTeamCompetitions(inactiveCompetitions, report);
}

/**
 * @param {object} competition
 * @param {(message: string) => void} [onProgress]
 */
export async function loadPreviousCompetitionData(competition, onProgress) {
  const report = (message) => onProgress?.(message);

  report(`Loading ${competition.name}…`);
  const matches = await fetchAllPastTeamMatches(competition);
  const matchDetails = await fetchMatchDetails([competition], matches, report);
  report('Calculating stats…');

  return matchDetails;
}

/**
 * @param {object[]} matchDetails
 * @returns {number[]}
 */
export function collectPersonIdsFromMatchDetails(matchDetails) {
  /** @type {Set<number>} */
  const personIds = new Set();

  for (const { match, lineups } of matchDetails) {
    if (!lineups) {
      continue;
    }

    const side = getTeamSide(match);
    if (!side) {
      continue;
    }

    for (const player of lineups[side]?.players ?? []) {
      if (player.personId) {
        personIds.add(player.personId);
      }
    }
  }

  return [...personIds];
}

/**
 * @param {number} personId
 * @param {number|string} competitionId
 */
async function fetchOfficialCompetitionStat(personId, competitionId) {
  const [profile, statsList] = await Promise.all([
    apiFetch(`/player/${personId}`).catch(() => null),
    apiFetch(`/player/${personId}/stats`).catch(() => []),
  ]);

  if (!Array.isArray(statsList)) {
    return null;
  }

  const stat = statsList.find(
    (entry) => String(entry.competition?.id) === String(competitionId),
  );

  if (!stat || !profile) {
    return null;
  }

  return {
    personId,
    name: profile.name ?? profile.shortName ?? 'Unknown',
    shortName: profile.shortName ?? profile.name ?? 'Unknown',
    shirtNumber: null,
    goals: stat.goals ?? 0,
    appearances: stat.matchesPlayed ?? 0,
    minutes: stat.minutesPlayed ?? 0,
    yellowCards: stat.yellowCards ?? 0,
    redCards: stat.redCards ?? 0,
    assists: stat.assists ?? 0,
  };
}

/**
 * @param {number|string} competitionId
 * @param {number[]} personIds
 * @param {(message: string) => void} [onProgress]
 */
export async function fetchOfficialPlayerStatsForCompetition(
  competitionId,
  personIds,
  onProgress,
) {
  /** @type {Record<string, import('./types.js').PlayerStats>} */
  const players = {};
  const pool = createPool(6);
  let processed = 0;

  await Promise.all(
    personIds.map((personId) =>
      pool(async () => {
        processed += 1;
        onProgress?.(`Loading official player stats (${processed}/${personIds.length})…`);

        const stats = await fetchOfficialCompetitionStat(personId, competitionId);
        if (stats) {
          players[String(personId)] = stats;
        }
      }),
    ),
  );

  return players;
}

/**
 * @param {import('./types.js').CompetitionStats} competitionStats
 * @param {object} competition
 * @param {object[]} matchDetails
 * @param {(message: string) => void} [onProgress]
 */
export async function enrichCompetitionWithOfficialStats(
  competitionStats,
  competition,
  matchDetails,
  onProgress,
) {
  const personIds = collectPersonIdsFromMatchDetails(matchDetails);
  if (personIds.length === 0) {
    return competitionStats;
  }

  const officialPlayers = await fetchOfficialPlayerStatsForCompetition(
    competition.id,
    personIds,
    onProgress,
  );

  if (Object.keys(officialPlayers).length > 0) {
    competitionStats.players = officialPlayers;
  }

  return competitionStats;
}

export { CONFIG };
