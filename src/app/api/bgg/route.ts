import { NextRequest, NextResponse } from 'next/server';
import {
  asRecords,
  attribute,
  childNames,
  childNumber,
  childText,
  expansionLinks,
  fetchBggItems,
  links,
  primaryName,
} from '@/lib/bgg';

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
      const items = await fetchBggItems(`thing?id=${encodeURIComponent(id)}&stats=1`);
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
        expansions: expansionLinks(item),
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
    const items = await fetchBggItems(`search?type=boardgame&query=${encodeURIComponent(query)}`);
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
