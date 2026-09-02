// Client-side translation with no API key and no backend.
//
// It calls public Google Translate JSON endpoints that send
// `Access-Control-Allow-Origin: *`, so they work straight from the browser,
// and falls back to MyMemory if Google rate-limits the visitor's IP.
//
// Each call is a GET, so text is chunked to keep URLs short. Newlines inside
// a chunk survive the round-trip, so many lines are translated at once and
// mapped back paragraph-by-paragraph.

const MAX_CHUNK_CHARS = 1400;
const CHUNK_DELAY_MS = 350;

export interface Language {
  code: string;
  label: string;
}

// A practical subset — any code Google supports also works through the
// "custom code" field in the UI.
export const LANGUAGES: Language[] = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ru', label: 'Russian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'it', label: 'Italian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'id', label: 'Indonesian' },
  { code: 'pl', label: 'Polish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'sv', label: 'Swedish' },
  { code: 'el', label: 'Greek' },
  { code: 'he', label: 'Hebrew' },
  { code: 'fa', label: 'Persian' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Split text into chunks under MAX_CHUNK_CHARS, breaking on line boundaries. */
function splitChunks(text: string): string[] {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  const flushLongLine = (line: string) => {
    let rest = line;
    while (rest.length > MAX_CHUNK_CHARS) {
      let cut = rest.lastIndexOf(' ', MAX_CHUNK_CHARS);
      if (cut <= 0) cut = MAX_CHUNK_CHARS;
      chunks.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    current = rest;
  };

  for (const line of lines) {
    if (line.length > MAX_CHUNK_CHARS) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      flushLongLine(line);
      continue;
    }
    if ((current + '\n' + line).length > MAX_CHUNK_CHARS) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Google "single" response: data[0] is an array of [translated, original, ...].
function parseGoogleSingle(data: unknown): string {
  const segments = Array.isArray(data) ? data[0] : null;
  if (!Array.isArray(segments)) throw new Error('bad shape');
  return segments
    .map((seg) => (Array.isArray(seg) && typeof seg[0] === 'string' ? seg[0] : ''))
    .join('');
}

// Google "dict-chrome-ex" response: [["full translated text", "detectedLang"]].
function parseGoogleDict(data: unknown): string {
  if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === 'string') {
    return data[0][0];
  }
  throw new Error('bad shape');
}

interface Provider {
  name: string;
  url: (q: string, sl: string, tl: string) => string;
  parse: (data: unknown) => string;
}

const GOOGLE_PROVIDERS: Provider[] = [
  {
    name: 'googleapis',
    url: (q, sl, tl) =>
      `https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=${sl}&tl=${tl}&q=${encodeURIComponent(q)}`,
    parse: parseGoogleSingle,
  },
  {
    name: 'clients5-single',
    url: (q, sl, tl) =>
      `https://clients5.google.com/translate_a/single?client=gtx&dt=t&sl=${sl}&tl=${tl}&q=${encodeURIComponent(q)}`,
    parse: parseGoogleSingle,
  },
  {
    name: 'clients5-dict',
    url: (q, sl, tl) =>
      `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(q)}`,
    parse: parseGoogleDict,
  },
];

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.text();
  // Rate-limit / bot pages come back as HTML, not JSON.
  if (/^\s*</.test(body)) throw new Error('blocked (non-JSON response)');
  return JSON.parse(body);
}

async function translateViaMyMemory(
  chunk: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal,
): Promise<string> {
  // MyMemory caps a request at ~500 words, so split further on lines.
  const lines = chunk.split('\n');
  const out: string[] = [];
  const pair = `${sourceLang === 'auto' ? 'en' : sourceLang}|${targetLang}`;
  for (const line of lines) {
    if (!line.trim()) {
      out.push('');
      continue;
    }
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(line)}&langpair=${encodeURIComponent(pair)}`;
    const data = (await fetchJson(url, signal)) as {
      responseData?: { translatedText?: string };
    };
    out.push(data.responseData?.translatedText ?? line);
  }
  return out.join('\n');
}

async function translateChunk(
  chunk: string,
  targetLang: string,
  sourceLang: string,
  signal?: AbortSignal,
): Promise<string> {
  let lastErr: unknown;
  for (const provider of GOOGLE_PROVIDERS) {
    try {
      const data = await fetchJson(provider.url(chunk, sourceLang, targetLang), signal);
      return provider.parse(data);
    } catch (err) {
      if (signal?.aborted) throw err;
      lastErr = err;
    }
  }
  try {
    return await translateViaMyMemory(chunk, sourceLang, targetLang, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
    lastErr = err;
  }
  throw new Error(
    `All translation providers failed (${lastErr instanceof Error ? lastErr.message : 'unknown'})`,
  );
}

/**
 * Translate a block of text. `targetLang` is any Google Translate language
 * code; `sourceLang` defaults to auto-detect.
 */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang = 'auto',
  signal?: AbortSignal,
): Promise<string> {
  if (!text.trim()) return '';
  const chunks = splitChunks(text);
  const results: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await sleep(CHUNK_DELAY_MS);
    results.push(await translateChunk(chunks[i], targetLang, sourceLang, signal));
  }
  return results.join('\n');
}

/**
 * Translate a list of independent segments and get back a list of the same
 * length, aligned 1:1. Fast path: join with newlines and translate in one
 * pass (newlines survive the round-trip). If the result doesn't split back
 * cleanly, fall back to translating each segment on its own so alignment is
 * exact.
 */
export async function translateSegments(
  segments: string[],
  targetLang: string,
  sourceLang = 'auto',
  signal?: AbortSignal,
): Promise<string[]> {
  const clean = segments.map((s) => s.replace(/\s+/g, ' ').trim());
  if (clean.every((s) => !s)) return clean;

  const joined = clean.join('\n');
  const out = await translateText(joined, targetLang, sourceLang, signal);
  const parts = out.split('\n');
  if (parts.length === clean.length) return parts;

  const result: string[] = [];
  for (const s of clean) {
    result.push(s ? await translateText(s, targetLang, sourceLang, signal) : '');
  }
  return result;
}
