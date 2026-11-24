// Shared BoardGameGeek XML API helpers, used by /api/bgg and /api/recommendations.
// The token stays on the server (BGG_API_TOKEN, no NEXT_PUBLIC_ prefix).

import { XMLParser } from 'fast-xml-parser';
import { decodeHtmlEntities } from '@/lib/decodeHtmlEntities';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

export type XmlRecord = Record<string, unknown>;

export function asRecords(value: unknown): XmlRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is XmlRecord => typeof item === 'object' && item !== null);
  }
  return typeof value === 'object' && value !== null ? [value as XmlRecord] : [];
}

export function attribute(record: unknown, name: string): string | undefined {
  if (typeof record !== 'object' || record === null) return undefined;
  const value = (record as XmlRecord)[`@_${name}`];
  return typeof value === 'string' || typeof value === 'number' ? decodeHtmlEntities(String(value)) : undefined;
}

export function childText(record: XmlRecord, name: string): string | undefined {
  const value = record[name];
  if (typeof value === 'string' || typeof value === 'number') return decodeHtmlEntities(String(value));
  if (typeof value === 'object' && value !== null && '#text' in value) {
    const text = (value as XmlRecord)['#text'];
    return typeof text === 'string' || typeof text === 'number' ? decodeHtmlEntities(String(text)) : undefined;
  }
  return undefined;
}

export function childNumber(record: XmlRecord, name: string): number | undefined {
  const value = attribute(record[name], 'value');
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function childNames(record: XmlRecord): string[] {
  const value = record.name;
  return asRecords(value)
    .map((name) => attribute(name, 'value'))
    .filter((name): name is string => Boolean(name));
}

export function primaryName(record: XmlRecord): string | undefined {
  const names = asRecords(record.name);
  const primary = names.find((name) => attribute(name, 'type') === 'primary');
  return (primary && attribute(primary, 'value')) ?? (names[0] && attribute(names[0], 'value'));
}

export function links(record: XmlRecord, type: string): string[] {
  return asRecords(record.link)
    .filter((link) => attribute(link, 'type') === type)
    .map((link) => attribute(link, 'value'))
    .filter((value): value is string => Boolean(value));
}

export function expansionLinks(record: XmlRecord): { bgg_id: number; title: string }[] {
  return asRecords(record.link)
    .filter((link) => attribute(link, 'type') === 'boardgameexpansion')
    .map((link) => ({
      bgg_id: Number(attribute(link, 'id')),
      title: attribute(link, 'value') ?? '',
    }))
    .filter((expansion) =>
      Number.isSafeInteger(expansion.bgg_id) && expansion.bgg_id > 0 && expansion.title.length > 0
    );
}

function getToken(): string | null {
  return process.env.BGG_API_TOKEN?.trim() || null;
}

async function fetchBgg(path: string): Promise<Response> {
  const token = getToken();
  if (!token) {
    throw new Error('BGG_API_TOKEN is not configured on the server.');
  }

  return fetch(`https://boardgamegeek.com/xmlapi2/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/xml',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
}

async function parseResponse(response: Response): Promise<XmlRecord> {
  if (response.status === 202) {
    throw new Error('BGG is processing this request. Try again shortly.');
  }
  if (response.status === 429) {
    throw new Error('BGG rate limit reached. Try again later.');
  }
  if (!response.ok) {
    throw new Error(`BGG returned HTTP ${response.status}. Check the API token and try again.`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml) as XmlRecord;
  if (typeof parsed.items !== 'object' || parsed.items === null) {
    throw new Error('BGG returned an unexpected response.');
  }
  return parsed.items as XmlRecord;
}

export async function fetchBggItems(path: string): Promise<XmlRecord> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetchBgg(path);
    if (response.status !== 202 || attempt === 4) return parseResponse(response);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('BGG request could not be completed.');
}

// ---------- Used by the AI recommender ----------

/** BGG IDs whose name matches the query. exact=true asks BGG for exact name matches only. */
export async function searchBggIds(query: string, exact: boolean): Promise<{ id: number; name: string }[]> {
  const items = await fetchBggItems(
    `search?type=boardgame${exact ? '&exact=1' : ''}&query=${encodeURIComponent(query)}`
  );
  return asRecords(items.item)
    .map((item) => ({ id: Number(attribute(item, 'id')), name: primaryName(item) ?? '' }))
    .filter((item) => Number.isSafeInteger(item.id) && item.id > 0 && item.name.length > 0);
}

export interface PlayerCountVotes {
  best: number;
  recommended: number;
  notRecommended: number;
}

export interface BggGameDetails {
  bggId: number;
  /** 'boardgame' for base games, 'boardgameexpansion' for expansions. */
  type: string;
  title: string;
  year: number | null;
  image: string | null;
  thumbnail: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  minPlaytime: number | null;
  maxPlaytime: number | null;
  rating: number | null;
  weight: number | null;
  usersRated: number;
  /** Community votes per player count, keyed like BGG: "1", "2", ..., "4+". */
  playerCountVotes: Record<string, PlayerCountVotes>;
}

function parsePlayerCountVotes(item: XmlRecord): Record<string, PlayerCountVotes> {
  const poll = asRecords(item.poll).find((entry) => attribute(entry, 'name') === 'suggested_numplayers');
  const votes: Record<string, PlayerCountVotes> = {};
  if (!poll) return votes;

  for (const results of asRecords(poll.results)) {
    const numPlayers = attribute(results, 'numplayers');
    if (!numPlayers) continue;
    const count = (value: string) =>
      Number(attribute(asRecords(results.result).find((r) => attribute(r, 'value') === value), 'numvotes') ?? 0);
    votes[numPlayers] = {
      best: count('Best'),
      recommended: count('Recommended'),
      notRecommended: count('Not Recommended'),
    };
  }
  return votes;
}

const BGG_MAX_IDS_PER_REQUEST = 20;

/** Details for many games, fetched in batches of 20 (BGG's limit per request). */
export async function fetchBggGameDetails(ids: number[]): Promise<BggGameDetails[]> {
  const details: BggGameDetails[] = [];
  for (let start = 0; start < ids.length; start += BGG_MAX_IDS_PER_REQUEST) {
    const batch = ids.slice(start, start + BGG_MAX_IDS_PER_REQUEST);
    const items = await fetchBggItems(`thing?id=${batch.join(',')}&stats=1`);

    for (const item of asRecords(items.item)) {
      const ratings = asRecords(asRecords(item.statistics)[0]?.ratings)[0];
      details.push({
        bggId: Number(attribute(item, 'id')),
        type: attribute(item, 'type') ?? '',
        title: primaryName(item) ?? '',
        year: childNumber(item, 'yearpublished') ?? null,
        image: childText(item, 'image') ?? null,
        thumbnail: childText(item, 'thumbnail') ?? null,
        minPlayers: childNumber(item, 'minplayers') ?? null,
        maxPlayers: childNumber(item, 'maxplayers') ?? null,
        minPlaytime: childNumber(item, 'minplaytime') ?? null,
        maxPlaytime: childNumber(item, 'maxplaytime') ?? null,
        rating: ratings ? (childNumber(ratings, 'average') ?? null) : null,
        weight: ratings ? (childNumber(ratings, 'averageweight') ?? null) : null,
        usersRated: ratings ? (childNumber(ratings, 'usersrated') ?? 0) : 0,
        playerCountVotes: parsePlayerCountVotes(item),
      });
    }
  }
  return details;
}
