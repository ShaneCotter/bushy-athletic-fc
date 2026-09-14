import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  discoverAdditionalTeamCompetitions,
  enrichCompetitionWithOfficialStats,
  isTargetTeam,
  loadCurrentCompetitionData,
} from '../js/api.js';
import {
  aggregateFixtures,
  aggregateSeason,
  finalizeCompetitionStats,
} from '../js/aggregate.js';
import { CONFIG } from '../js/config.js';
import { buildMatchInsights, writeInsights } from './insights.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUT_PATH = join(ROOT, 'data', 'current-season.json');
const INSIGHTS_PATH = join(ROOT, 'data', 'insights', 'current-season.json');

function seasonLabelFor(competitionId, competitionName) {
  return (
    CONFIG.seasons.find((season) => season.id === String(competitionId))?.label ??
    competitionName
  );
}

function mapStandings(table) {
  return (table.standings ?? []).map((row) => ({
    position: row.position ?? 0,
    teamName: row.team?.parent?.name ?? row.team?.name ?? 'Unknown',
    played: row.played ?? 0,
    won: row.wins ?? 0,
    drawn: row.draws ?? 0,
    lost: row.losses ?? 0,
    points: row.points ?? 0,
    isTargetTeam: row.team ? isTargetTeam(row.team) : false,
  }));
}

/**
 * @param {object} competition
 * @param {object[]} matchDetails
 * @param {object[]} fixtureEntries
 * @param {object} [table]
 */
async function buildCompetitionStats(
  competition,
  matchDetails,
  fixtureEntries,
  table,
) {
  const aggregated = aggregateSeason(matchDetails, true);
  const competitionId = String(competition.id);
  const competitionStats =
    aggregated.competitions[competitionId] ??
    finalizeCompetitionStats({
      id: competitionId,
      name: competition.name,
      active: true,
      players: {},
      teamRecord: {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      },
      matches: [],
      fixtures: [],
    });

  competitionStats.fixtures = aggregateFixtures(fixtureEntries);
  competitionStats.displayName = seasonLabelFor(competitionId, competition.name);
  for (const match of competitionStats.matches) {
    match.competitionName = competition.name;
  }
  for (const fixture of competitionStats.fixtures) {
    fixture.competitionName = competition.name;
  }
  if (table) {
    competitionStats.standings = mapStandings(table);
  }

  const insightPlayers = await enrichCompetitionWithOfficialStats(
    competitionStats,
    competition,
    matchDetails,
    console.log,
  );
  finalizeCompetitionStats(competitionStats);

  return { competitionStats, insightPlayers };
}

console.log(`Fetching ${CONFIG.currentSeasonCompetitionName}…`);
const { competition, matchDetails, fixtureEntries, table } =
  await loadCurrentCompetitionData(
    CONFIG.currentSeasonCompetitionName,
    console.log,
  );

const { competitionStats, insightPlayers } = await buildCompetitionStats(
  competition,
  matchDetails,
  fixtureEntries,
  table,
);

const discovered = await discoverAdditionalTeamCompetitions(
  competition,
  matchDetails,
  console.log,
);
const additional = discovered.others;
const allFixtureEntries = discovered.upcomingFixtureEntries?.length
  ? discovered.upcomingFixtureEntries
  : [...fixtureEntries];

if (additional.length === 0) {
  console.log('No additional cup competitions found for this team yet.');
} else {
  console.log(`Found ${additional.length} additional competition(s).`);
}

const extraCompetitions = [];
const extraInsights = [];

for (const extra of additional) {
  const built = await buildCompetitionStats(
    extra.competition,
    extra.matchDetails,
    extra.fixtureEntries,
  );
  extraCompetitions.push({
    id: String(extra.competition.id),
    name: extra.competition.name,
    label: extra.competition.name,
    kind: 'cup',
    stats: built.competitionStats,
  });
  extraInsights.push({
    id: String(extra.competition.id),
    name: extra.competition.name,
    players: built.insightPlayers,
    matches: buildMatchInsights(extra.matchDetails),
  });
}

const uniqueFixtures = [];
const seenFixtureIds = new Set();
for (const fixture of aggregateFixtures(allFixtureEntries)) {
  if (seenFixtureIds.has(fixture.id)) {
    continue;
  }
  seenFixtureIds.add(fixture.id);
  uniqueFixtures.push(fixture);
}

const output = {
  generatedAt: new Date().toISOString(),
  upcomingFixtures: uniqueFixtures,
  extraCompetitions,
  season: {
    id: String(competition.id),
    name: competition.name,
    stats: competitionStats,
  },
};

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote current season to ${OUT_PATH}`);

writeInsights(INSIGHTS_PATH, {
  league: {
    id: String(competition.id),
    name: competition.name,
    players: insightPlayers,
    matches: buildMatchInsights(matchDetails),
    table: table.standings ?? [],
  },
  extraCompetitions: extraInsights,
});
console.log(`Wrote insights to ${INSIGHTS_PATH}`);
