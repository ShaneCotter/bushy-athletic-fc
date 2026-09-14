import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  discoverPreviousCompetitions,
  enrichCompetitionWithOfficialStats,
  loadPreviousCompetitionData,
} from '../js/api.js';
import {
  aggregatePreviousCompetition,
  finalizeCompetitionStats,
} from '../js/aggregate.js';
import { CONFIG } from '../js/config.js';
import { buildMatchInsights, writeInsights } from './insights.mjs';

const ROOT = join(import.meta.dirname, '..');
const OUT_PATH = join(ROOT, 'data', 'completed-seasons.json');
const INSIGHTS_PATH = join(ROOT, 'data', 'insights', 'completed-seasons.json');

console.log('Discovering completed competitions…');
const allCompetitions = await discoverPreviousCompetitions((message) => {
  console.log(message);
});

const competitions = allCompetitions.filter((competition) =>
  CONFIG.completedSeasonNames.includes(competition.name),
);

if (competitions.length === 0) {
  console.warn(
    `No competitions matched completedSeasonNames: ${CONFIG.completedSeasonNames.join(', ')}`,
  );
}

/** @type {import('../js/types.js').CompetitionStats[]} */
const seasons = [];
/** @type {object[]} */
const insightSeasons = [];

for (const competition of competitions) {
  console.log(`Fetching ${competition.name}…`);
  const matchDetails = await loadPreviousCompetitionData(competition, console.log);
  const { competitionStats } = aggregatePreviousCompetition(matchDetails, competition);

  const insightPlayers = await enrichCompetitionWithOfficialStats(
    competitionStats,
    competition,
    matchDetails,
    console.log,
  );
  const seasonLabel =
    CONFIG.seasons.find((season) => season.id === String(competition.id))
      ?.label ?? competitionStats.displayName ?? competition.name;
  competitionStats.displayName = seasonLabel;
  finalizeCompetitionStats(competitionStats);

  seasons.push({
    id: String(competition.id),
    name: competition.name,
    displayName: seasonLabel,
    stats: competitionStats,
  });
  insightSeasons.push({
    id: String(competition.id),
    name: competition.name,
    players: insightPlayers,
    matches: buildMatchInsights(matchDetails),
  });
}

seasons.sort((a, b) => a.name.localeCompare(b.name));

const output = {
  generatedAt: new Date().toISOString(),
  seasons,
};

mkdirSync(join(ROOT, 'data'), { recursive: true });
writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${seasons.length} completed season(s) to ${OUT_PATH}`);
writeInsights(INSIGHTS_PATH, { seasons: insightSeasons });
console.log(`Wrote insights to ${INSIGHTS_PATH}`);
