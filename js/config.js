/** @typedef {import('./types.js').AppConfig} AppConfig */

/** @type {AppConfig} */
export const CONFIG = {
  /** Partial match against team name or parent club name in API data */
  teamMatch: 'Bushy Athletic',

  /**
   * Clubforce team id for this Bushy side (Division 2A this season).
   * Pins discovery to this squad even when the API name still says Division 3B.
   */
  teamId: 58704,

  /** UCFL organization ID in the Comet / FAI Analyticom system */
  organizationId: 87364,

  /** Clubforce store slug — used by optional refresh script only */
  storeSlug: 'ucfl',

  /**
   * Public API key (same one ucfl.clubforce.com embeds in its frontend bundle).
   * Refresh with: node scripts/fetch-config.mjs
   */
  apiKey: '880450cd0fffd0547340217d1e997efa22c49906f18e1efbf9311c166c0d89235ef8301b777655b1fbdc1895221c6d7a8742c14edb12dfafd2dcdbfe4cf1bf15',

  /** Estimated full-match length used for minutes calculations */
  matchLengthMinutes: 90,

  /** Cache aggregated stats in sessionStorage for this many minutes */
  cacheTtlMinutes: 30,

  /** Completed seasons to store in data/completed-seasons.json (exact competition names) */
  completedSeasonNames: ['UCFL Division 3A'],

  /** Active competition stored in data/current-season.json */
  currentSeasonCompetitionName: 'AUL / UCFL Division 2A',

  /** Competitions shown in the dropdown. */
  seasons: [
    {
      id: '51454018',
      label: '2026/27 League (Division 2A)',
      group: 'current',
    },
    {
      id: '2026-27-all',
      label: '2026/27 All Competitions',
      group: 'current',
    },
    {
      id: '37464242',
      label: '2025/26 League (Division 3A)',
      group: 'completed',
    },
  ],

  /** Default selected season id */
  defaultSeasonId: '51454018',
};
