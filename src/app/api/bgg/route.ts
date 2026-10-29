import { NextRequest, NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

type XmlRecord = Record<string, unknown>;

function asRecords(value: unknown): XmlRecord[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is XmlRecord => typeof item === 'object' && item !== null);
  }
  return typeof value === 'object' && value !== null ? [value as XmlRecord] : [];
}

function attribute(record: unknown, name: string): string | undefined {
  if (typeof record !== 'object' || record === null) return undefined;
  const value = (record as XmlRecord)[`@_${name}`];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function childText(record: XmlRecord, name: string): string | undefined {
  const value = record[name];
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object' && value !== null && '#text' in value) {
    const text = (value as XmlRecord)['#text'];
    return typeof text === 'string' || typeof text === 'number' ? String(text) : undefined;
  }
  return undefined;
}

function childNumber(record: XmlRecord, name: string): number | undefined {
  const value = attribute(record[name], 'value');
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function childNames(record: XmlRecord): string[] {
  const value = record.name;
  return asRecords(value)
    .map((name) => attribute(name, 'value'))
    .filter((name): name is string => Boolean(name));
}

function primaryName(record: XmlRecord): string | undefined {
  const names = asRecords(record.name);
  const primary = names.find((name) => attribute(name, 'type') === 'primary');
  return (primary && attribute(primary, 'value')) ?? (names[0] && attribute(names[0], 'value'));
}

function links(record: XmlRecord, type: string): string[] {
  return asRecords(record.link)
    .filter((link) => attribute(link, 'type') === type)
    .map((link) => attribute(link, 'value'))
    .filter((value): value is string => Boolean(value));
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

function errorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'BGG request failed.';
  const status = message.includes('not configured') ? 503 : 502;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');
  const query = searchParams.get('q')?.trim();

  if (id !== null) {
    if (!/^\d+$/.test(id) || Number(id) < 1) {
      return NextResponse.json({ error: 'A valid BGG game ID is required.' }, { status: 400 });
    }

    try {
      const items = await parseResponse(await fetchBgg(`thing?id=${encodeURIComponent(id)}&stats=1`));
      const item = asRecords(items.item)[0];
      if (!item) {
        return NextResponse.json({ error: 'BGG did not return that game.' }, { status: 404 });
      }

      const statistics = asRecords(item.statistics)[0];
      const ratings = statistics ? asRecords(statistics.ratings)[0] : undefined;
      const game = {
        bgg_id: Number(id),
        title: primaryName(item) ?? childNames(item)[0] ?? `BGG game ${id}`,
        year_published: childNumber(item, 'yearpublished') ?? null,
        min_players: childNumber(item, 'minplayers') ?? 1,
        max_players: childNumber(item, 'maxplayers') ?? 4,
        min_playtime: childNumber(item, 'minplaytime') ?? null,
        max_playtime: childNumber(item, 'maxplaytime') ?? null,
        bgg_rating: ratings ? childNumber(ratings, 'average') ?? null : null,
        complexity_weight: ratings ? childNumber(ratings, 'averageweight') ?? null : null,
        description: childText(item, 'description') ?? null,
        image_url: childText(item, 'image') ?? null,
        thumbnail_url: childText(item, 'thumbnail') ?? null,
        categories: links(item, 'boardgamecategory'),
        mechanics: links(item, 'boardgamemechanic'),
      };

      return NextResponse.json(game);
    } catch (error) {
      return errorResponse(error);
    }
  }

  if (!query || query.length > 120) {
    return NextResponse.json(
      { error: 'Enter a game title (up to 120 characters) to search BGG.' },
      { status: 400 },
    );
  }

  try {
    const items = await parseResponse(
      await fetchBgg(`search?type=boardgame&query=${encodeURIComponent(query)}`),
    );
    const results = asRecords(items.item)
      .map((item) => ({
        bgg_id: Number(attribute(item, 'id')),
        title: primaryName(item) ?? childNames(item)[0],
        year_published: childNumber(item, 'yearpublished') ?? null,
      }))
      .filter((item) => Number.isSafeInteger(item.bgg_id) && item.bgg_id > 0 && item.title);

    return NextResponse.json({ results });
  } catch (error) {
    return errorResponse(error);
  }
}
