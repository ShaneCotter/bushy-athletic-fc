/** @typedef {import('./types.js').AppConfig} AppConfig */

/** @type {AppConfig} */
export const CONFIG = {
  /** Partial match against team name or parent club name in API data */
  teamMatch: 'Bushy Athletic',

  /** UCFL organization ID in the Comet / FAI Analyticom system */
  organizationId: 12198,

  /** Clubforce store slug — used by optional refresh script only */
  storeSlug: 'ucfl',

  /**
   * Public API key (same one ucfl.clubforce.com embeds in its frontend bundle).
   * Refresh with: node scripts/fetch-config.mjs
   */
  apiKey: 'f7e6c5647d793cf7162b8c1d12794d09b0575160ef067e7290ded5646858ea5cbab09114ddb14cc18554df0a5890bca02a1f837428550cb19217cbf7f9c71426',

  /** Estimated full-match length used for minutes calculations */
  matchLengthMinutes: 90,

  /** Cache aggregated stats in sessionStorage for this many minutes */
  cacheTtlMinutes: 30,

  /** Completed seasons to store in data/completed-seasons.json (exact competition names) */
  completedSeasonNames: ['UCFL Division 3A'],

  /** Season shown in the dropdown (id must match a stored season or future config) */
  seasons: [
    { id: '37464242', label: '2025/26' },
    { id: '2627', label: '2026/27', comingSoon: true },
  ],

  /** Default selected season id */
  defaultSeasonId: '37464242',

  /**
   * When 2026/27 starts: remove comingSoon, add data via fetch script,
   * and point id at the new competition id from the API.
   */
};
