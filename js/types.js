/**
 * @typedef {Object} AppConfig
 * @property {string} teamMatch
 * @property {number} organizationId
 * @property {string} storeSlug
 * @property {string} apiKey
 * @property {number} matchLengthMinutes
 * @property {number} cacheTtlMinutes
 * @property {string[]} completedSeasonNames
 * @property {Array<{ id: string, label: string, comingSoon?: boolean }>} seasons
 * @property {string} defaultSeasonId
 */

/**
 * @typedef {Object} PlayerStats
 * @property {number} personId
 * @property {string} name
 * @property {string} shortName
 * @property {number|null} shirtNumber
 * @property {number} goals
 * @property {number} appearances
 * @property {number} minutes
 * @property {number} yellowCards
 * @property {number} redCards
 * @property {number} [assists]
 */

/**
 * @typedef {Object} TeamRecord
 * @property {number} played
 * @property {number} won
 * @property {number} drawn
 * @property {number} lost
 * @property {number} goalsFor
 * @property {number} goalsAgainst
 */

/**
 * @typedef {Object} GoalScorer
 * @property {string} shortName
 * @property {number} minute
 */

/**
 * @typedef {Object} MatchSummary
 * @property {number} id
 * @property {string} competitionId
 * @property {string} competitionName
 * @property {string} date
 * @property {string} round
 * @property {string} opponent
 * @property {boolean} isHome
 * @property {number} goalsFor
 * @property {number} goalsAgainst
 * @property {'W'|'D'|'L'} result
 * @property {string} scoreline
 * @property {GoalScorer[]} [goalScorers]
 */

/**
 * @typedef {Object} FixtureSummary
 * @property {number} id
 * @property {string} competitionId
 * @property {string} competitionName
 * @property {string} date
 * @property {string} round
 * @property {string} opponent
 * @property {boolean} isHome
 */

/**
 * @typedef {Object} CompetitionStats
 * @property {string} id
 * @property {string} name
 * @property {string} [displayName]
 * @property {boolean} active
 * @property {Record<string, PlayerStats>} players
 * @property {TeamRecord} teamRecord
 * @property {MatchSummary[]} matches
 * @property {FixtureSummary[]} fixtures
 */

/** @typedef {CompetitionStats} SeasonBundle */

/**
 * @typedef {Object} CompetitionOption
 * @property {string} id
 * @property {string} name
 * @property {string} [displayName]
 * @property {boolean} active
 */

/**
 * @typedef {Object} DashboardStats
 * @property {string} generatedAt
 * @property {string} teamDisplayName
 * @property {FixtureSummary[]} fixtures
 * @property {SeasonBundle} currentSeason
 * @property {Record<string, CompetitionStats>} currentCompetitions
 * @property {CompetitionOption[]} previousCompetitions
 * @property {Record<string, CompetitionStats>} previousSeasons
 */

export {};
