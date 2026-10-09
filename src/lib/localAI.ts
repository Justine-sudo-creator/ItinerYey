// Thin client for a local Ollama server — all inference stays on this device.

function normalizeHost(raw: string | undefined): string {
  const host = (raw || '127.0.0.1:11434').replace(/\/$/, '');
  const withScheme = /^https?:\/\//.test(host) ? host : `http://${host}`;
  return withScheme.replace('://0.0.0.0', '://127.0.0.1');
}

export const OLLAMA_HOST = normalizeHost(process.env.OLLAMA_HOST);
export const CHAT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
export const VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'qwen2.5vl:3b';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  /** JSON schema to constrain output */
  format?: object;
  temperature?: number;
  timeoutMs?: number;
}

export interface ChatResult {
  content: string;
  durationMs: number;
}

export async function ollamaChat({
  model, messages, format, temperature = 0.2, timeoutMs = 120_000,
}: ChatOptions): Promise<ChatResult> {
  const started = Date.now();
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, messages, format, stream: false, keep_alive: '30m',
      options: { temperature },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  }
  const json = await res.json() as { message?: { content?: string } };
  return { content: json.message?.content ?? '', durationMs: Date.now() - started };
}

export async function ollamaJson<T>(opts: ChatOptions & { format: object }): Promise<{ data: T; durationMs: number }> {
  const { content, durationMs } = await ollamaChat(opts);
  return { data: JSON.parse(content) as T, durationMs };
}

export async function ollamaStatus(): Promise<{ ok: boolean; models: string[] }> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(2_000), cache: 'no-store' });
    if (!res.ok) return { ok: false, models: [] };
    const json = await res.json() as { models?: { name: string }[] };
    return { ok: true, models: (json.models ?? []).map(m => m.name) };
  } catch {
    return { ok: false, models: [] };
  }
}
