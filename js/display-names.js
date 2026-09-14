/**
 * Clubforce stores names as "LAST First" and short names as "LAST F.".
 * When two players share a short name (two M. Dunnes), use a natural name instead.
 */

const PLAYER_NAME_OVERRIDES = {
  229068: 'DUNNE Mick',
  564503: 'DUNNE Mark',
  65260: 'DUNNE Max',
};

/** @param {string} value */
export function normalizeShortName(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * @param {string} apiName e.g. "DUNNE Micheal"
 * @param {string} [shortName]
 */
export function naturalPlayerName(apiName, shortName = '') {
  const name = String(apiName ?? '').replace(/\s+/g, ' ').trim();
  if (!name || name === 'Unknown') {
    return shortName || 'Unknown';
  }

  const space = name.indexOf(' ');
  if (space === -1) {
    return name;
  }

  const lastName = name.slice(0, space);
  const firstName = name.slice(space + 1).trim();
  if (!firstName) {
    return name;
  }

  return `${lastName.toUpperCase()} ${firstName}`;
}

/**
 * @param {Record<string, { personId?: number, name?: string, shortName?: string, displayName?: string }>} players
 */
export function applySquadDisplayNames(players) {
  const list = Object.values(players ?? {});
  /** @type {Map<string, number>} */
  const shortNameCounts = new Map();

  for (const player of list) {
    const key = normalizeShortName(player.shortName || player.name || '');
    shortNameCounts.set(key, (shortNameCounts.get(key) ?? 0) + 1);
  }

  for (const player of list) {
    const key = normalizeShortName(player.shortName || player.name || '');
    const collided = (shortNameCounts.get(key) ?? 0) > 1;
    player.displayName =
      PLAYER_NAME_OVERRIDES[player.personId] ??
      (collided
        ? naturalPlayerName(player.name ?? '', player.shortName ?? '')
        : player.shortName || player.name || 'Unknown');
  }

  return players;
}

/**
 * @param {{ displayName?: string, shortName?: string, name?: string, personId?: number }} player
 * @param {Record<string, { displayName?: string, shortName?: string, personId?: number }>|null} [players]
 */
export function playerDisplayName(player, players = null) {
  if (player?.personId != null && players) {
    const fromSquad = players[String(player.personId)];
    if (fromSquad?.displayName) {
      return fromSquad.displayName;
    }
  }

  return player?.displayName || player?.shortName || player?.name || 'Unknown';
}
