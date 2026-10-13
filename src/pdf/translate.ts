// Translation through Z.ai's GLM chat API. The browser never holds a key. Local dev
// goes through Vite, which attaches the key (see vite.config.ts). The deployed site
// goes through the proxy in translate-proxy/, whose URL is set at build time as
// VITE_TRANSLATE_URL.

const GLM_URL =
  import.meta.env.VITE_TRANSLATE_URL || '/glm-api/api/paas/v4/chat/completions';
const GLM_MODEL = 'glm-4.5-flash';

export interface Language {
  code: string;
  label: string;
}

// A practical subset — any language the model understands also works through
// the "custom code" field in the UI. Kept in alphabetical order by name.
export const LANGUAGES: Language[] = [
  { code: 'ar', label: 'Arabic' },
  { code: 'bn', label: 'Bengali' },
  { code: 'zh-CN', label: 'Chinese (Simplified)' },
  { code: 'zh-TW', label: 'Chinese (Traditional)' },
  { code: 'nl', label: 'Dutch' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'el', label: 'Greek' },
  { code: 'he', label: 'Hebrew' },
  { code: 'hi', label: 'Hindi' },
  { code: 'id', label: 'Indonesian' },
  { code: 'it', label: 'Italian' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'fa', label: 'Persian' },
  { code: 'pl', label: 'Polish' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ru', label: 'Russian' },
  { code: 'es', label: 'Spanish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'th', label: 'Thai' },
  { code: 'tr', label: 'Turkish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'vi', label: 'Vietnamese' },
];

// A page sent in one request can take longer than ATTEMPT_TIMEOUT_MS, so it is
// split into batches of about this many characters.
const BATCH_CHARS = 1_500;

// Batches of one page run in parallel, since most of the wait is GLM generating
// text. GLM rate-limits around 4 to 8 parallel requests, so stay at 3.
const BATCH_CONCURRENCY = 3;

function languageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

type ChatReply = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

const MAX_ATTEMPTS = 4;
const ATTEMPT_TIMEOUT_MS = 45_000;
// Waits 10 s, 20 s, then 40 s: GLM's per-minute rate limit clears within about a minute.
const RETRY_BASE_MS = 10_000;
const RETRYABLE_STATUS = new Set([429, 503]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GLM returns 429 ("Rate limit reached for requests") and 503 under load, and the
// browser reports a request that gets no response as "Load failed" or "Failed to
// fetch". Retry those with backoff and time out each attempt. Never retry after a
// user abort.
async function postWithRetry(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    if (attempt > 1) await sleep(RETRY_BASE_MS * 2 ** (attempt - 2));
    signal?.throwIfAborted();

    const attemptCtl = new AbortController();
    const timer = setTimeout(() => attemptCtl.abort(), ATTEMPT_TIMEOUT_MS);
    const onUserAbort = () => attemptCtl.abort();
    signal?.addEventListener('abort', onUserAbort);
    try {
      const res = await fetch(url, { ...init, signal: attemptCtl.signal });
      if (!RETRYABLE_STATUS.has(res.status) || attempt === MAX_ATTEMPTS) return res;
    } catch (err) {
      if (signal?.aborted) throw err;
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `GLM did not respond after ${MAX_ATTEMPTS} attempts. Check your connection and try again.`,
        );
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onUserAbort);
    }
  }
}

// One request: a list of segments in, the same number of translations out.
async function translateBatch(
  texts: string[],
  targetLang: string,
  sourceLang: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const source =
    sourceLang === 'auto'
      ? 'Detect the source language.'
      : `The source language is ${languageName(sourceLang)}.`;

  const res = await postWithRetry(
    GLM_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GLM_MODEL,
        temperature: 0,
        // Translation doesn't need the reasoning step, and it slows every reply.
        thinking: { type: 'disabled' },
        // JSON mode: the prompt fixes the reply's shape, and the count check
        // below catches any deviation.
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              `You translate text extracted from a PDF into ${languageName(targetLang)}. ${source} ` +
              'The user message is a JSON array of segments. Reply with a JSON object whose ' +
              '"translations" array holds one translation per segment, in the same order and of ' +
              'the same length. Translate faithfully and keep the wording natural. Leave math, ' +
              'variable names, numbers, citations, URLs and code exactly as written. Do not add ' +
              'notes or commentary.',
          },
          { role: 'user', content: JSON.stringify(texts) },
        ],
      }),
    },
    signal,
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ChatReply;
    throw new Error(`GLM ${res.status}: ${err.error?.message ?? 'request failed'}`);
  }

  const json = (await res.json()) as ChatReply;
  const content = json.choices?.[0]?.message?.content ?? '';
  const parts = (JSON.parse(content) as { translations: string[] }).translations;
  if (parts.length !== texts.length) {
    throw new Error(`Expected ${texts.length} translations, got ${parts.length}`);
  }
  return parts;
}

// Runs tasks with at most `limit` in flight and returns results in task order. A
// failure, or an abort of `signal`, cancels the tasks still running and stops new
// ones from starting.
async function runPool<T>(
  tasks: ((signal: AbortSignal) => Promise<T>)[],
  limit: number,
  signal?: AbortSignal,
): Promise<T[]> {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort);
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (!ctl.signal.aborted && next < tasks.length) {
      const i = next++;
      try {
        results[i] = await tasks[i](ctl.signal);
      } catch (err) {
        ctl.abort();
        throw err;
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
    return results;
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Translate a list of independent segments and get back a list of the same
 * length, aligned 1:1. Blank segments are skipped and come back as ''.
 * `targetLang` is a language code from LANGUAGES or any free-form name;
 * `sourceLang` defaults to auto-detect.
 */
export async function translateSegments(
  segments: string[],
  targetLang: string,
  sourceLang = 'auto',
  signal?: AbortSignal,
): Promise<string[]> {
  const clean = segments.map((s) => s.replace(/\s+/g, ' ').trim());
  const todo = clean.flatMap((s, i) => (s ? [i] : []));
  const out = clean.map(() => '');
  if (!todo.length) return out;

  if (!import.meta.env.DEV && !import.meta.env.VITE_TRANSLATE_URL) {
    throw new Error('Translation is not set up on this site yet.');
  }

  // Group segments into batches of roughly BATCH_CHARS characters.
  const batches: number[][] = [];
  let current: number[] = [];
  let chars = 0;
  for (const i of todo) {
    if (current.length && chars + clean[i].length > BATCH_CHARS) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(i);
    chars += clean[i].length;
  }
  if (current.length) batches.push(current);

  const parts = await runPool(
    batches.map((batch) => (taskSignal: AbortSignal) =>
      translateBatch(batch.map((i) => clean[i]), targetLang, sourceLang, taskSignal),
    ),
    BATCH_CONCURRENCY,
    signal,
  );
  batches.forEach((batch, b) => {
    batch.forEach((i, j) => {
      out[i] = parts[b][j];
    });
  });
  return out;
}
