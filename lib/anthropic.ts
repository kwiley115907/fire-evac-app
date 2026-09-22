const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[] | string;
}

// Thin server-only wrapper around the raw Messages API — no SDK dependency,
// never called from client code, and the key never leaves the server.
export async function callClaude(params: {
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: params.maxTokens ?? 2048,
      system: params.system,
      messages: params.messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const block = data.content?.find((c: { type: string }) => c.type === 'text');
  if (!block?.text) throw new Error('No text response from Claude');
  return block.text as string;
}

// Claude is asked to reply with JSON only, but models sometimes wrap it in
// prose or a ```json fence anyway — extract the first {...} or [...] block.
export function extractJson<T>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error('No JSON found in model response');
  const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
