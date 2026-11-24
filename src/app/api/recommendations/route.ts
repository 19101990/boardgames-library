import { NextRequest, NextResponse } from 'next/server';
import {
  REQUEST_LIMITS,
  SUGGESTIONS_TO_REQUEST,
  buildPrompt,
  validateRecommendationRequest,
} from '@/lib/recommendationRequest';

// AI recommender: the browser sends the visitor's choices and favourite games,
// the server checks them, builds the prompt from a fixed template and asks
// Cloudflare Workers AI. BGG checks and rate limits come in later steps.

const MODEL = '@cf/openai/gpt-oss-120b';
// Hard cap on answer length (and cost) per request. Includes the model's thinking,
// so it must leave room for that plus 8 suggestions.
const MAX_OUTPUT_TOKENS = 1500;
// With default effort the model can spend the whole token budget thinking and never
// answer (measured: 26s, no answer). Low effort measured ~12s and ~55 Neurons per request.
const REASONING_EFFORT = 'low';
const TIMEOUT_MS = 45000;

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

export async function POST(request: NextRequest) {
  const config = getCloudflareConfig();
  if (!config) {
    return NextResponse.json({ error: 'The AI service is not configured on the server.' }, { status: 503 });
  }

  // 1. Size check before parsing, so a huge request can't waste server time.
  const rawBody = await request.text();
  if (rawBody.length > REQUEST_LIMITS.bodyChars) {
    return NextResponse.json({ error: 'The request is too large.' }, { status: 413 });
  }

  // 2. Must be JSON.
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'The request must be valid JSON.' }, { status: 400 });
  }

  // 3. Every field checked; anything unexpected is rejected before the AI is called.
  const validation = validateRecommendationRequest(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const prompt = buildPrompt(validation.value);

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
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
          max_tokens: MAX_OUTPUT_TOKENS,
          reasoning_effort: REASONING_EFFORT,
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
    return NextResponse.json({ suggestions: suggestions.slice(0, SUGGESTIONS_TO_REQUEST) });
  } catch (error) {
    console.error('Cloudflare AI request error:', error);
    return NextResponse.json({ error: 'The AI service did not respond. Try again later.' }, { status: 502 });
  }
}
