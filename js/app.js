import { CONFIG } from './config.js';
import { mergeCompletedSeasons, rankPlayers, sortPlayers } from './aggregate.js';

/** @typedef {import('./types.js').DashboardStats} DashboardStats */
/** @typedef {import('./types.js').SeasonBundle} SeasonBundle */
/** @typedef {import('./types.js').MatchSummary} MatchSummary */

const CACHE_KEY = 'ucfl-dashboard-stats-v10';
const COMPLETED_SEASONS_URL = 'data/completed-seasons.json';
const RESULTS_PAGE_SIZE = 10;

const SECTION_TARGETS = {
  home: 'home',
  fixtures: 'fixtures',
  stats: 'season',
  results: 'results',
  sponsors: 'sponsors',
};

const NAV_SECTIONS = ['home', 'fixtures', 'stats', 'results', 'sponsors'];

/** @type {DashboardStats|null} */
let currentStats = null;
/** @type {string} */
let activeSeasonId = CONFIG.defaultSeasonId;
/** @type {'home'|'fixtures'|'stats'|'results'|'sponsors'} */
let activeSection = 'home';
/** @type {'goals'|'appearances'|'minutes'|'yellowCards'|'redCards'} */
let activeMetric = 'goals';
let resultsPage = 0;
let playerSearchQuery = '';
let resultsSearchQuery = '';
let scrollSpyInitialized = false;
let scrollSpyTicking = false;

const elements = {
  loading: document.getElementById('loading'),
  loadingText: document.getElementById('loading-text'),
  error: document.getElementById('error'),
  errorText: document.getElementById('error-text'),
  retryBtn: document.getElementById('retry-btn'),
  dashboard: document.getElementById('dashboard'),
  seasonSelect: document.getElementById('season-select'),
  playerSearch: document.getElementById('player-search'),
  resultsSearch: document.getElementById('results-search'),
  fixturesList: document.getElementById('fixtures-list'),
  resultsPanel: document.getElementById('results-panel'),
  resultsPagination: document.getElementById('results-pagination'),
  summaryCards: document.getElementById('summary-cards'),
  leaderboardTabs: document.getElementById('leaderboard-tabs'),
  leaderboardPanel: document.getElementById('leaderboard-panel'),
  navButtons: document.querySelectorAll('[data-nav]'),
};

init();

function init() {
  elements.retryBtn.addEventListener('click', () => bootstrap(true));
  elements.seasonSelect.addEventListener('change', (event) => {
    activeSeasonId = /** @type {HTMLSelectElement} */ (event.target).value;
    resultsPage = 0;
    renderDashboard();
  });

  elements.leaderboardTabs.addEventListener('click', (event) => {
    const button = /** @type {HTMLElement|null} */ (
      event.target instanceof HTMLElement ? event.target.closest('[data-metric]') : null
    );
    if (!button) {
      return;
    }

    activeMetric = /** @type {typeof activeMetric} */ (button.dataset.metric);
    renderLeaderboard();
  });

  elements.playerSearch.addEventListener('input', (event) => {
    playerSearchQuery = /** @type {HTMLInputElement} */ (event.target).value.trim();
    renderLeaderboard();
  });

  elements.resultsSearch.addEventListener('input', (event) => {
    resultsSearchQuery = /** @type {HTMLInputElement} */ (event.target).value.trim();
    resultsPage = 0;
    renderResults();
  });

  elements.resultsPagination.addEventListener('click', (event) => {
    const button = /** @type {HTMLElement|null} */ (
      event.target instanceof HTMLElement ? event.target.closest('[data-page]') : null
    );
    if (!button || button.hasAttribute('disabled')) {
      return;
    }

    resultsPage = Number(button.dataset.page);
    renderResults();
  });

  elements.navButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const section = /** @type {typeof activeSection} */ (
        /** @type {HTMLElement} */ (button).dataset.nav
      );
      if (section) {
        navigateToSection(section);
      }
    });
  });

  window.addEventListener('hashchange', syncSectionFromHash);

  bootstrap(false);
}

function initScrollSpy() {
  if (scrollSpyInitialized) {
    updateActiveSectionFromScroll();
    return;
  }

  scrollSpyInitialized = true;

  window.addEventListener(
    'scroll',
    () => {
      if (scrollSpyTicking) {
        return;
      }

      scrollSpyTicking = true;
      window.requestAnimationFrame(() => {
        updateActiveSectionFromScroll();
        scrollSpyTicking = false;
      });
    },
    { passive: true },
  );

  updateActiveSectionFromScroll();
}

function getScrollSpyOffset() {
  const header = document.querySelector('.site-header');
  return (header?.getBoundingClientRect().height ?? 80) + 24;
}

function updateActiveSectionFromScroll() {
  if (elements.dashboard.hidden) {
    return;
  }

  const scrollPosition = window.scrollY + getScrollSpyOffset();
  let current = /** @type {typeof activeSection} */ (NAV_SECTIONS[0]);

  for (const sectionKey of NAV_SECTIONS) {
    const sectionEl = document.getElementById(SECTION_TARGETS[sectionKey]);
    if (!sectionEl) {
      continue;
    }

    const sectionTop = sectionEl.getBoundingClientRect().top + window.scrollY;
    if (sectionTop <= scrollPosition) {
      current = /** @type {typeof activeSection} */ (sectionKey);
    }
  }

  highlightSection(current);
}

function syncSectionFromHash() {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'home' || hash === 'fixtures' || hash === 'stats' || hash === 'results' || hash === 'sponsors') {
    navigateToSection(hash, false);
  }
}

/** @param {'home'|'fixtures'|'stats'|'results'|'sponsors'} section */
function highlightSection(section) {
  if (activeSection === section) {
    elements.navButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.nav === section);
    });
    return;
  }

  activeSection = section;

  elements.navButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.nav === section);
  });
}

/** @param {'home'|'fixtures'|'stats'|'results'|'sponsors'} section @param {boolean} [updateHash] @param {boolean} [scroll] */
function navigateToSection(section, updateHash = true, scroll = true) {
  highlightSection(section);

  if (scroll) {
    document.getElementById(SECTION_TARGETS[section])?.scrollIntoView({ behavior: 'smooth' });
  }

  if (updateHash) {
    history.replaceState(null, '', `#${section}`);
  }
}

/** @param {'home'|'fixtures'|'stats'|'results'|'sponsors'} section @param {boolean} [updateHash] @param {boolean} [scroll] */
function setActiveSection(section, updateHash = true, scroll = true) {
  navigateToSection(section, updateHash, scroll);
}

/** @returns {DashboardStats} */
function createEmptyDashboardStats() {
  return {
    generatedAt: new Date().toISOString(),
    teamDisplayName: CONFIG.teamMatch,
    fixtures: [],
    currentSeason: {
      id: 'current',
      name: 'Current season',
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
    },
    currentCompetitions: {},
    previousCompetitions: [],
    previousSeasons: {},
  };
}

/** @param {boolean} forceRefresh */
async function bootstrap(forceRefresh) {
  showLoading(true);
  hideError();
  elements.dashboard.hidden = true;

  try {
    const storedPromise = loadStoredCompletedSeasons();

    if (!forceRefresh) {
      const cached = readCache();
      if (cached) {
        currentStats = cached;
        renderAll();
        showLoading(false);
        refreshInBackground();
        return;
      }
    }

    const storedSeasons = await storedPromise;
    if (storedSeasons?.seasons?.length) {
      currentStats = mergeCompletedSeasons(createEmptyDashboardStats(), storedSeasons);
      renderAll();
      showLoading(false);
    }

    currentStats = await fetchStats(
      (message) => {
        elements.loadingText.textContent = message;
        if (storedSeasons?.seasons?.length) {
          showLoading(true);
        }
      },
      storedSeasons,
    );
    writeCache(currentStats);
    renderAll();
    showLoading(false);
  } catch (error) {
    if (currentStats?.previousCompetitions?.length) {
      renderAll();
      showLoading(false);
      return;
    }

    showLoading(false);
    showError(error instanceof Error ? error.message : 'Unable to load data.');
  }
}

async function refreshInBackground() {
  try {
    const storedSeasons = await loadStoredCompletedSeasons();
    const fresh = await fetchStats(undefined, storedSeasons);
    currentStats = fresh;
    writeCache(fresh);
    renderAll();
  } catch {
    // Keep showing cached data if background refresh fails.
  }
}

/** @returns {Promise<object|null>} */
async function loadStoredCompletedSeasons() {
  try {
    const response = await fetch(COMPLETED_SEASONS_URL);
    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

/** @returns {Promise<DashboardStats>} */
async function fetchStats(_onProgress, preloadedStored = null) {
  const storedSeasons =
    preloadedStored ?? (await loadStoredCompletedSeasons());

  return mergeCompletedSeasons(createEmptyDashboardStats(), storedSeasons);
}

function renderAll() {
  if (!currentStats) {
    return;
  }

  hideError();
  showLoading(false);
  populateSeasonSelect();
  renderDashboard();
  elements.dashboard.hidden = false;
  initScrollSpy();
  syncSectionFromHash();
  if (!window.location.hash) {
    updateActiveSectionFromScroll();
  }
}

function populateSeasonSelect() {
  if (!currentStats) {
    return;
  }

  elements.seasonSelect.innerHTML = CONFIG.seasons
    .map((season) => {
      const label = season.comingSoon
        ? `${season.label} (coming soon)`
        : season.label;
      const selected = season.id === activeSeasonId ? ' selected' : '';
      const disabled = season.comingSoon ? ' disabled' : '';

      return `<option value="${escapeHtml(season.id)}"${selected}${disabled}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

/** @param {string} seasonId */
function isComingSoonSeason(seasonId) {
  return CONFIG.seasons.some((season) => season.id === seasonId && season.comingSoon);
}

/** @param {string} [message] */
function renderComingSoonPanel(message = 'Stats for this season will appear here when the season gets underway.') {
  return `<div class="empty-panel"><p class="empty-state">${escapeHtml(message)}</p></div>`;
}

function renderDashboard() {
  renderFixtures();
  renderSummary();
  renderLeaderboard();
  renderResults();
}

/** @returns {SeasonBundle|null} */
function getActiveSeasonStats() {
  if (!currentStats || isComingSoonSeason(activeSeasonId)) {
    return null;
  }

  return currentStats.previousSeasons[activeSeasonId] ?? null;
}

function renderFixtures() {
  elements.fixturesList.innerHTML = renderComingSoonPanel(
    'Fixtures for the 2026/27 season will appear here when the season gets underway.',
  );
}

function renderResults() {
  if (isComingSoonSeason(activeSeasonId)) {
    elements.resultsPanel.innerHTML = renderComingSoonPanel();
    elements.resultsPagination.hidden = true;
    return;
  }

  const stats = getActiveSeasonStats();

  if (!stats || stats.matches.length === 0) {
    elements.resultsPanel.innerHTML =
      '<div class="empty-panel"><p class="empty-state">No results found for this season.</p></div>';
    elements.resultsPagination.hidden = true;
    return;
  }

  const query = resultsSearchQuery.toLowerCase();
  const filtered = stats.matches.filter((match) => matchMatchesSearch(match, query));

  if (filtered.length === 0) {
    elements.resultsPanel.innerHTML =
      '<div class="empty-panel"><p class="empty-state">No results match that team.</p></div>';
    elements.resultsPagination.hidden = true;
    return;
  }

  const totalPages = Math.ceil(filtered.length / RESULTS_PAGE_SIZE);
  if (resultsPage >= totalPages) {
    resultsPage = Math.max(0, totalPages - 1);
  }

  const pageMatches = filtered.slice(
    resultsPage * RESULTS_PAGE_SIZE,
    resultsPage * RESULTS_PAGE_SIZE + RESULTS_PAGE_SIZE,
  );

  elements.resultsPanel.innerHTML = pageMatches
    .map((match) => renderResultCard(match))
    .join('');

  renderResultsPagination(totalPages, filtered.length);
}

/** @param {number} totalPages @param {number} totalResults */
function renderResultsPagination(totalPages, totalResults) {
  if (totalPages <= 1) {
    elements.resultsPagination.hidden = true;
    return;
  }

  elements.resultsPagination.hidden = false;
  const from = resultsPage * RESULTS_PAGE_SIZE + 1;
  const to = Math.min(totalResults, (resultsPage + 1) * RESULTS_PAGE_SIZE);

  elements.resultsPagination.innerHTML = `
    <button type="button" class="btn btn--ghost" data-page="${resultsPage - 1}"${
      resultsPage === 0 ? ' disabled' : ''
    }>Previous</button>
    <span class="pagination__info">${from}–${to} of ${totalResults}</span>
    <button type="button" class="btn btn--ghost" data-page="${resultsPage + 1}"${
      resultsPage >= totalPages - 1 ? ' disabled' : ''
    }>Next</button>
  `;
}

/** @param {MatchSummary} match */
function renderResultCard(match) {
  const date = match.date ? formatDate(match.date) : 'TBC';
  const venue = match.isHome ? 'Home' : 'Away';
  const scorers = match.goalScorers ?? [];
  const missingScorers = Math.max(0, match.goalsFor - scorers.length);

  const listedScorersHtml =
    scorers.length > 0
      ? scorers
          .map(
            (scorer) => `
        <span class="match-card__scorer">
          <span class="match-card__scorer-icon" aria-hidden="true">⚽</span>
          <span class="match-card__scorer-name">${escapeHtml(scorer.shortName)}</span>
          <span class="match-card__scorer-minute">${scorer.minute}'</span>
        </span>
      `,
          )
          .join('')
      : '';

  const missingScorersHtml =
    missingScorers > 0
      ? `<p class="match-card__scorers-note">${escapeHtml(
          missingScorers === 1
            ? '1 goal — scorer details not recorded by UCFL'
            : `${missingScorers} goals — scorer details not recorded by UCFL`,
        )}</p>`
      : '';

  const scorersHtml =
    listedScorersHtml || missingScorersHtml
      ? `<div class="match-card__scorers">${listedScorersHtml}${missingScorersHtml}</div>`
      : '';

  return `
    <article class="result-card result-${match.result.toLowerCase()}">
      <div class="result-card__main">
        <div class="result-card__info">
          <p class="result-card__opponent">${escapeHtml(match.opponent)}</p>
          <p class="result-card__meta">${escapeHtml(date)} · ${venue}</p>
        </div>
        <div class="result-card__score">
          <span class="result-badge result-badge--${match.result.toLowerCase()}">${match.result}</span>
          <span>${match.scoreline}</span>
        </div>
      </div>
      ${scorersHtml}
    </article>
  `;
}

function renderSummary() {
  if (isComingSoonSeason(activeSeasonId)) {
    elements.summaryCards.innerHTML = renderComingSoonPanel();
    return;
  }

  const stats = getActiveSeasonStats();
  if (!stats) {
    elements.summaryCards.innerHTML =
      '<div class="empty-panel"><p class="empty-state">No data for this season.</p></div>';
    return;
  }

  const { teamRecord, players } = stats;
  const topScorer = sortPlayers(players, 'goals').find((player) => player.goals > 0);

  const cards = [
    { label: 'Played', value: String(teamRecord.played) },
    {
      label: 'Record',
      value: `${teamRecord.won}-${teamRecord.drawn}-${teamRecord.lost}`,
    },
    {
      label: '⚽ For / against',
      value: `${teamRecord.goalsFor}–${teamRecord.goalsAgainst}`,
    },
    {
      label: 'Top scorer',
      value: topScorer ? `${topScorer.shortName} (${topScorer.goals})` : '—',
    },
  ];

  elements.summaryCards.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <p class="summary-card__label">${escapeHtml(card.label)}</p>
          <p class="summary-card__value">${escapeHtml(card.value)}</p>
        </article>
      `,
    )
    .join('');
}

function renderLeaderboard() {
  elements.leaderboardTabs.querySelectorAll('[data-metric]').forEach((button) => {
    button.classList.toggle(
      'is-active',
      button.getAttribute('data-metric') === activeMetric,
    );
  });

  if (isComingSoonSeason(activeSeasonId)) {
    elements.leaderboardPanel.innerHTML = renderComingSoonPanel();
    return;
  }

  const stats = getActiveSeasonStats();
  if (!stats) {
    elements.leaderboardPanel.innerHTML =
      '<div class="empty-panel"><p class="empty-state">No data for this season.</p></div>';
    return;
  }

  const metricLabels = {
    goals: 'Goals',
    appearances: 'Apps',
    minutes: 'Minutes',
    yellowCards: 'Yellows',
    redCards: 'Reds',
  };

  const query = playerSearchQuery.toLowerCase();
  const rankedPlayers = rankPlayers(
    sortPlayers(stats.players, activeMetric).filter((player) => player[activeMetric] > 0),
    activeMetric,
  ).filter(
    ({ player }) =>
      !query ||
      player.name.toLowerCase().includes(query) ||
      player.shortName.toLowerCase().includes(query),
  );

  const rows =
    rankedPlayers.length === 0
      ? `<tr class="empty-row"><td colspan="3">${
          query ? 'No players match your search.' : 'No data for this metric.'
        }</td></tr>`
      : rankedPlayers
          .map(
            ({ player, rank }) => `
              <tr>
                <td data-label="#">${rank}</td>
                <td data-label="Player"><span class="player-name">${escapeHtml(player.shortName)}</span></td>
                <td data-label="${metricLabels[activeMetric]}">${player[activeMetric]}</td>
              </tr>
            `,
          )
          .join('');

  elements.leaderboardPanel.innerHTML = `
    <table class="data-table leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>${metricLabels[activeMetric]}</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

/** @param {MatchSummary} match @param {string} query */
function matchMatchesSearch(match, query) {
  if (!query) {
    return true;
  }

  return match.opponent.toLowerCase().includes(query);
}

function showLoading(show) {
  elements.loading.hidden = !show;
}

/** @param {string} message */
function showError(message) {
  elements.error.hidden = false;
  elements.errorText.textContent = message;
}

function hideError() {
  elements.error.hidden = true;
}

/** @returns {DashboardStats|null} */
function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const ageMinutes = (Date.now() - Date.parse(parsed.cachedAt)) / 60000;
    if (ageMinutes > CONFIG.cacheTtlMinutes) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

/** @param {DashboardStats} data */
function writeCache(data) {
  sessionStorage.setItem(
    CACHE_KEY,
    JSON.stringify({
      cachedAt: new Date().toISOString(),
      data,
    }),
  );
}

/** @param {string} iso */
function formatDate(iso) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(iso));
}

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
