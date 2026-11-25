// Builds public/demo/seed.json: demo games fetched once from BoardGameGeek,
// plus generated play records with per-aspect ratings.
//
// Usage (needs BGG_API_TOKEN):
//   node --env-file=.env.local scripts/build-demo-seed.mjs
//
// Plays are generated with a fixed random seed, so the output only changes
// when the BGG data or this script changes. Contains no real user data.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { decodeHtmlEntities } from '../src/lib/decodeHtmlEntities.ts';

const OUTPUT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../public/demo/seed.json');
const RANDOM_SEED = 20261123;
const PLAYS_END_DATE = '2026-11-01'; // plays fall in the two years before this date
const PLAYS_SPAN_DAYS = 730;
const BATCH_SIZE = 20; // BGG's maximum IDs per thing request
const BATCH_PAUSE_MS = 5000;
const MAX_EXPANSIONS = 6;

// [bggId, expected title] — the title is only used to catch wrong IDs.
const OWNED = [
  // Family / gateway
  [14996, 'Ticket to Ride: Europe'], [822, 'Carcassonne'], [230802, 'Azul'], [148228, 'Splendor'],
  [204583, 'Kingdomino'], [295947, 'Cascadia'],
  // Party / social
  [178900, 'Codenames'], [254640, 'Just One'], [262543, 'Wavelength'], [128882, 'The Resistance: Avalon'],
  [92415, 'Skull'],
  // Two-player
  [173346, '7 Wonders Duel'], [54043, 'Jaipur'], [163412, 'Patchwork'], [2655, 'Hive'], [373106, 'Sky Team'],
  // Co-op
  [30549, 'Pandemic'], [284083, 'The Crew: The Quest for Planet Nine'], [162886, 'Spirit Island'],
  [291457, 'Gloomhaven: Jaws of the Lion'],
  // Medium weight
  [266192, 'Wingspan'], [199792, 'Everdell'], [68448, '7 Wonders'], [312484, 'Lost Ruins of Arnak'],
  [244521, 'The Quacks of Quedlinburg'], [366013, 'Heat: Pedal to the Metal'], [263918, 'Cartographers'],
  // Heavier
  [167791, 'Terraforming Mars'], [224517, 'Brass: Birmingham'], [342942, 'Ark Nova'],
  [316554, 'Dune: Imperium'], [169786, 'Scythe'], [237182, 'Root'], [84876, 'The Castles of Burgundy'],
  // Thematic
  [170216, 'Blood Rage'],
];

// Kept short so a game the visitor adds is easy to spot. Several are games the AI
// recommender likes to suggest, so the "Already on your Wanted list" label shows up.
const WANTED = [
  [256960, 'Pax Pamir: Second Edition'], [397598, 'Dune: Imperium – Uprising'], [251247, 'Barrage'],
  [350184, 'Earth'], [295770, 'Frosthaven'],
];

const PLAY_NOTES = [
  'Close game, decided on the last turn.',
  'Quick teach, everyone picked it up fast.',
  'Ran longer than expected.',
  'Great fit for this group.',
  'Tried a completely different strategy this time.',
  'Rematch requested straight away.',
  'One player ran away with it.',
  'Lots of table talk this time.',
  'Played the beginner setup.',
  'Everyone was a bit tired; still fun.',
  'Scores were very tight.',
  'Good choice for a weeknight.',
];
const FIRST_PLAY_NOTES = [
  'First play, needed the rulebook a few times.',
  'First play, took a while to learn.',
  'First play, learned it as we went.',
];

// ---------- BGG fetching (same mapping as src/app/api/bgg/route.ts) ----------

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

const asRecords = (value) =>
  Array.isArray(value)
    ? value.filter((item) => typeof item === 'object' && item !== null)
    : typeof value === 'object' && value !== null ? [value] : [];

const attribute = (record, name) => {
  if (typeof record !== 'object' || record === null) return undefined;
  const value = record[`@_${name}`];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
};

const childText = (record, name) => {
  const value = record[name];
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object' && value !== null && '#text' in value) {
    const text = value['#text'];
    return typeof text === 'string' || typeof text === 'number' ? String(text) : undefined;
  }
  return undefined;
};

const childNumber = (record, name) => {
  const value = attribute(record[name], 'value');
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const primaryName = (record) => {
  const names = asRecords(record.name);
  const primary = names.find((name) => attribute(name, 'type') === 'primary');
  return (primary && attribute(primary, 'value')) ?? (names[0] && attribute(names[0], 'value'));
};

const links = (record, type) =>
  asRecords(record.link)
    .filter((link) => attribute(link, 'type') === type)
    .map((link) => ({ id: Number(attribute(link, 'id')), value: decodeHtmlEntities(attribute(link, 'value') ?? '') }))
    .filter((link) => link.value.length > 0);

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function fetchThings(ids) {
  const token = process.env.BGG_API_TOKEN?.trim();
  if (!token) throw new Error('BGG_API_TOKEN is not set. Run with --env-file=.env.local');

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${ids.join(',')}&stats=1`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/xml' },
      signal: AbortSignal.timeout(30000),
    });
    if (response.status === 202 || response.status === 429) {
      const wait = 5000 * (attempt + 1);
      console.log(`  BGG returned ${response.status}, waiting ${wait / 1000}s...`);
      await sleep(wait);
      continue;
    }
    if (!response.ok) throw new Error(`BGG returned HTTP ${response.status}`);
    const parsed = parser.parse(await response.text());
    return asRecords(parsed.items?.item);
  }
  throw new Error('BGG kept asking to retry; try again later.');
}

function mapItem(item) {
  const bggId = Number(attribute(item, 'id'));
  const ratings = asRecords(asRecords(item.statistics)[0]?.ratings)[0];
  const round = (value, digits) => (value == null ? null : Number(value.toFixed(digits)));
  return {
    bgg_id: bggId,
    title: decodeHtmlEntities(primaryName(item) ?? `BGG game ${bggId}`),
    year_published: childNumber(item, 'yearpublished') ?? null,
    image_url: childText(item, 'image') ?? null,
    thumbnail_url: childText(item, 'thumbnail') ?? null,
    description: (() => { const text = childText(item, 'description'); return text ? decodeHtmlEntities(text) : null; })(),
    min_players: childNumber(item, 'minplayers') ?? 1,
    max_players: childNumber(item, 'maxplayers') ?? 4,
    min_playtime: childNumber(item, 'minplaytime') ?? 30,
    max_playtime: childNumber(item, 'maxplaytime') ?? 60,
    rating: round(ratings ? childNumber(ratings, 'average') : null, 2),
    weight: round(ratings ? childNumber(ratings, 'averageweight') : null, 2),
    categories: links(item, 'boardgamecategory').map((link) => link.value),
    mechanics: links(item, 'boardgamemechanic').map((link) => link.value),
    expansionLinks: links(item, 'boardgameexpansion').filter((link) => Number.isSafeInteger(link.id) && link.id > 0),
  };
}

const normalise = (title) =>
  title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const titlesMatch = (expected, actual) => {
  const a = normalise(expected);
  const b = normalise(actual);
  return a === b || a.includes(b) || b.includes(a);
};

// ---------- Deterministic generation ----------

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(RANDOM_SEED);
const randomInt = (min, max) => min + Math.floor(random() * (max - min + 1));
const chance = (probability) => random() < probability;
const pick = (items) => items[Math.floor(random() * items.length)];
const clampRating = (value) => Math.min(5, Math.max(1, Math.round(value)));
const noise = (spread) => (random() * 2 - 1) * spread;

const HIGH_INTERACTION = ['Party Game', 'Negotiation', 'Bluffing', 'Wargame', 'Fighting', 'Deduction'];
const HIGH_INTERACTION_MECHANICS = ['Area Majority / Influence', 'Take That', 'Trading', 'Hidden Roles', 'Auction/Bidding', 'Team-Based Game'];
const LOW_INTERACTION_MECHANICS = ['Solo / Solitaire Game', 'Roll / Spin and Move', 'Paper-and-Pencil'];

function interactionBase(game) {
  let base = 2.8;
  if (game.categories.some((name) => HIGH_INTERACTION.includes(name))) base += 1;
  if (game.mechanics.some((name) => HIGH_INTERACTION_MECHANICS.includes(name))) base += 0.6;
  if (game.mechanics.some((name) => LOW_INTERACTION_MECHANICS.includes(name))) base -= 0.6;
  if (game.mechanics.includes('Cooperative Game')) base += 0.3;
  return base;
}

function pickPlayerCount(game) {
  const min = Math.max(1, game.min_players);
  const max = Math.max(min, Math.min(game.max_players, 8));
  const favoured = [];
  for (let count = min; count <= max; count += 1) {
    const weight = count === 2 || count === 3 ? 4 : count === 4 ? 3 : count === 1 ? 1 : 2;
    for (let i = 0; i < weight; i += 1) favoured.push(count);
  }
  return pick(favoured);
}

function dateDaysBefore(endDate, days) {
  const date = new Date(`${endDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function generatePlays(game, startIndex) {
  const roll = random();
  const isFavourite = roll > 0.85;
  const count = roll < 0.1 ? 0 : isFavourite ? randomInt(15, 30) : randomInt(1, 10);
  if (count === 0) return [];

  const dates = Array.from({ length: count }, () => dateDaysBefore(PLAYS_END_DATE, randomInt(0, PLAYS_SPAN_DAYS)))
    .sort(); // oldest first, so the first entry is the first play

  // Overall taste for this game: mostly follows the BGG average, with a personal twist.
  const gameTaste = ((game.rating ?? 7) - 5) * 1.1 + noise(0.8) + (isFavourite ? 0.6 : 0);
  const weight = game.weight ?? 2.5;
  const longGame = (game.max_playtime ?? 60) >= 120;

  const plays = dates.map((playDate, index) => {
    const isFirstPlay = index === 0;
    const ratings = {};
    if (chance(0.85)) ratings.overall = clampRating(gameTaste + noise(1));
    if (chance(0.6)) ratings.pacing = clampRating((longGame ? 3.2 : 4) + noise(1.2));
    if (chance(0.5)) ratings.energy_fit = clampRating(3.6 + noise(1.4));
    if (chance(0.5)) ratings.interaction = clampRating(interactionBase(game) + noise(0.7));
    if (chance(isFirstPlay ? 0.8 : 0.4)) {
      ratings.teach_effort = clampRating(weight + (isFirstPlay ? 0.6 : -0.3) + noise(0.6));
    }

    let notes = null;
    if (isFirstPlay && chance(0.5)) notes = pick(FIRST_PLAY_NOTES);
    else if (chance(0.3)) notes = pick(PLAY_NOTES);

    return {
      game_id: game.id,
      play_date: playDate,
      player_count: pickPlayerCount(game),
      notes,
      ratings: Object.keys(ratings).length > 0 ? ratings : null,
      created_at: `${playDate}T20:00:00Z`,
    };
  });

  return plays.map((play, index) => ({
    id: `demo-play-${String(startIndex + index + 1).padStart(4, '0')}`,
    ...play,
  }));
}

function pickLanguage() {
  const roll = random();
  return roll < 0.8 ? 'EN' : roll < 0.92 ? 'DE' : 'PL';
}

// ---------- Main ----------

async function main() {
  const entries = [
    ...OWNED.map(([bggId, title]) => ({ bggId, title, status: 'owned' })),
    ...WANTED.map(([bggId, title]) => ({ bggId, title, status: 'wishlist' })),
  ];
  const duplicateIds = entries.map((e) => e.bggId).filter((id, i, all) => all.indexOf(id) !== i);
  if (duplicateIds.length > 0) throw new Error(`Duplicate BGG IDs in list: ${duplicateIds.join(', ')}`);

  console.log(`Fetching ${entries.length} games from BGG (${OWNED.length} owned, ${WANTED.length} wanted)...`);
  const fetched = new Map();
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    console.log(`  Batch ${i / BATCH_SIZE + 1}/${Math.ceil(entries.length / BATCH_SIZE)}`);
    for (const item of await fetchThings(batch.map((entry) => entry.bggId))) {
      const mapped = mapItem(item);
      fetched.set(mapped.bgg_id, mapped);
    }
    if (i + BATCH_SIZE < entries.length) await sleep(BATCH_PAUSE_MS);
  }

  const missing = [];
  const mismatched = [];
  const games = [];
  const expansions = [];

  entries.forEach((entry, index) => {
    const data = fetched.get(entry.bggId);
    if (!data) {
      missing.push(`${entry.bggId} (${entry.title})`);
      return;
    }
    if (!titlesMatch(entry.title, data.title)) {
      mismatched.push(`${entry.bggId}: expected "${entry.title}", BGG says "${data.title}"`);
    }

    const id = `demo-bgg-${data.bgg_id}`;
    const { expansionLinks, ...gameFields } = data;
    games.push({
      id,
      ...gameFields,
      status: entry.status,
      language: entry.status === 'owned' ? pickLanguage() : null,
      // Spread "added" dates so sorting by date added looks natural.
      created_at: `${dateDaysBefore(PLAYS_END_DATE, 900 - index * 7)}T12:00:00Z`,
    });

    // BGG's expansion links are unranked and include fan/promo items; keep ones named after the base game.
    const baseName = normalise(data.title.split(/[:–—(]/)[0]);
    const relevantExpansions = expansionLinks
      .filter((link) => {
        const name = normalise(link.value);
        return name.includes(baseName) && !/\b(fan|promo|promos|adventskalender|advent|calendar|kickstarter)\b/.test(name);
      })
      .sort((a, b) => Number(normalise(b.value).startsWith(baseName)) - Number(normalise(a.value).startsWith(baseName)));
    for (const link of relevantExpansions.slice(0, MAX_EXPANSIONS)) {
      expansions.push({
        id: `demo-exp-${data.bgg_id}-${link.id}`,
        game_id: id,
        bgg_id: link.id,
        title: link.value,
        is_owned: entry.status === 'owned' && chance(0.2),
      });
    }
  });

  const plays = [];
  for (const game of games.filter((g) => g.status === 'owned')) {
    plays.push(...generatePlays(game, plays.length));
  }

  const seed = {
    schema_version: 2, // bump when the content changes: browsers holding an older version re-seed
    source: 'BoardGameGeek XML API2 (game data); plays are generated sample data',
    random_seed: RANDOM_SEED,
    plays_end_date: PLAYS_END_DATE,
    games,
    expansions,
    plays,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');

  const playCounts = games.filter((g) => g.status === 'owned').map((g) => plays.filter((p) => p.game_id === g.id).length);
  console.log('\nWrote', OUTPUT_PATH);
  console.log(`Games: ${games.length} (${games.filter((g) => g.status === 'owned').length} owned, ${games.filter((g) => g.status === 'wishlist').length} wanted)`);
  console.log(`Expansions: ${expansions.length}`);
  console.log(`Plays: ${plays.length} (owned games with 0 plays: ${playCounts.filter((c) => c === 0).length}, max per game: ${Math.max(...playCounts)})`);
  if (missing.length) console.log(`\nMISSING from BGG response (${missing.length}):\n  ${missing.join('\n  ')}`);
  if (mismatched.length) console.log(`\nTITLE MISMATCHES (${mismatched.length}):\n  ${mismatched.join('\n  ')}`);
  if (!missing.length && !mismatched.length) console.log('All IDs matched their expected titles.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
