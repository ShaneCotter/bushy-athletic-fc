import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  discoverPreviousCompetitions,
  enrichCompetitionWithOfficialStats,
  loadPreviousCompetitionData,
} from '../js/api.js';
import { aggregatePreviousCompetition } from '../js/aggregate.js';
import { CONFIG } from '../js/config.js';

const ROOT = join(import.meta.dirname, '..');
const OUT_PATH = join(ROOT, 'data', 'completed-seasons.json');

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

for (const competition of competitions) {
  console.log(`Fetching ${competition.name}…`);
  const matchDetails = await loadPreviousCompetitionData(competition, console.log);
  const { competitionStats } = aggregatePreviousCompetition(matchDetails, competition);

  await enrichCompetitionWithOfficialStats(
    competitionStats,
    competition,
    matchDetails,
    console.log,
  );

  seasons.push({
    id: String(competition.id),
    name: competition.name,
    displayName: competitionStats.displayName ?? competition.name,
    stats: competitionStats,
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
