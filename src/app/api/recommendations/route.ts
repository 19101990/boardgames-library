import { NextResponse } from 'next/server';

// Step 1 of the AI recommender: a fixed test question, so we can see the whole
// round trip (our server -> Cloudflare Workers AI -> our server) working.
// Visitor input, favourites and BGG checks come in later steps.

const MODEL = '@cf/openai/gpt-oss-120b';
const MAX_OUTPUT_TOKENS = 600; // hard cap on answer length (and cost) per request
const TIMEOUT_MS = 30000;

// The exact JSON shape the AI must reply with. Cloudflare's JSON mode enforces it.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          year: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['title', 'year', 'reason'],
      },
    },
  },
  required: ['suggestions'],
};

interface Suggestion {
  title: string;
  year: number;
  reason: string;
}

// Server-only settings. No NEXT_PUBLIC_ prefix, so these never reach the browser.
function getCloudflareConfig(): { accountId: string; token: string } | null {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const token = process.env.CLOUDFLARE_AI_TOKEN?.trim();
  return accountId && token ? { accountId, token } : null;
}

// Never trust the AI's output: check every field before using it.
function parseSuggestions(content: unknown): Suggestion[] | null {
  let data: unknown = content;
  if (typeof content === 'string') {
    try {
      data = JSON.parse(content);
    } catch {
      return null; // e.g. the answer was cut off by MAX_OUTPUT_TOKENS mid-JSON
    }
  }

  if (typeof data !== 'object' || data === null) return null;
  const list = (data as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(list)) return null;

  return list.filter(
    (item): item is Suggestion =>
      typeof item === 'object' &&
      item !== null &&
      typeof item.title === 'string' &&
      item.title.trim().length > 0 &&
      Number.isInteger(item.year) &&
      typeof item.reason === 'string'
  );
}

export async function GET() {
  const config = getCloudflareConfig();
  if (!config) {
    return NextResponse.json({ error: 'The AI service is not configured on the server.' }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You recommend board games.' },
            {
              role: 'user',
              content: 'Suggest 3 board games similar to Wingspan. reason = one sentence why it fits.',
            },
          ],
          max_tokens: MAX_OUTPUT_TOKENS,
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'suggestions', schema: RESPONSE_SCHEMA },
          },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    const body = await response.json();
    if (!response.ok || !body.success) {
      console.error('Cloudflare AI request failed:', response.status, body.errors);
      return NextResponse.json({ error: 'The AI service is unavailable. Try again later.' }, { status: 502 });
    }

    const suggestions = parseSuggestions(body.result?.choices?.[0]?.message?.content);
    if (!suggestions || suggestions.length === 0) {
      console.error('AI returned an unusable answer:', body.result?.choices?.[0]?.finish_reason);
      return NextResponse.json({ error: 'The AI gave an unusable answer. Try again.' }, { status: 502 });
    }

    // Usage is logged on the server (for us), not sent to the visitor.
    console.log('AI usage:', body.result?.usage);
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Cloudflare AI request error:', error);
    return NextResponse.json({ error: 'The AI service did not respond. Try again later.' }, { status: 502 });
  }
}
