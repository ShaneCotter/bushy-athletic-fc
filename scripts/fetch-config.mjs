import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const CONFIG_PATH = join(ROOT, 'js', 'config.js');
const STORE_SLUG = 'ucfl';

const storeResponse = await fetch(`https://apicm.clubforce.com/v2/store/${STORE_SLUG}`);
if (!storeResponse.ok) {
  throw new Error(`Failed to fetch store config (${storeResponse.status})`);
}

const store = await storeResponse.json();
const apiKey = store?.comet?.api_key;
const organizationId = store?.comet?.organization_id;

if (!apiKey || !organizationId) {
  throw new Error('Store config did not include comet credentials.');
}

let configSource = readFileSync(CONFIG_PATH, 'utf8');
configSource = configSource.replace(
  /organizationId:\s*\d+/,
  `organizationId: ${organizationId}`,
);
configSource = configSource.replace(
  /apiKey:\s*'[^']+'/,
  `apiKey: '${apiKey}'`,
);

writeFileSync(CONFIG_PATH, configSource);
console.log(`Updated ${CONFIG_PATH}`);
