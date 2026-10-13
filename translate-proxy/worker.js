// Translation proxy for the PDF viewer. It holds the GLM key as a Worker secret
// (GLM_API_KEY), so the static site never sees it. Only the site's own origins may
// call it, and only for the one model the viewer uses.

const ALLOWED_ORIGINS = new Set([
  'https://longpanzhou.github.io',
  'http://localhost:5173',
  'http://localhost:5174',
]);
const GLM_URL = 'https://api.z.ai/api/paas/v4/chat/completions';
const ALLOWED_MODEL = 'glm-4.5-flash';
const MAX_BODY_BYTES = 60_000;

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
});

const reply = (origin, status, text) =>
  new Response(text, { status, headers: { 'Content-Type': 'text/plain', ...cors(origin) } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    if (!ALLOWED_ORIGINS.has(origin)) return new Response('Origin not allowed', { status: 403 });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'POST') return reply(origin, 405, 'POST only');
    if (!env.GLM_API_KEY) return reply(origin, 500, 'GLM_API_KEY secret is not set');

    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) return reply(origin, 413, 'Request too large');

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return reply(origin, 400, 'Body must be JSON');
    }
    if (parsed?.model !== ALLOWED_MODEL || !Array.isArray(parsed?.messages)) {
      return reply(origin, 400, `Only model ${ALLOWED_MODEL} with messages is allowed`);
    }

    let upstream;
    try {
      upstream = await fetch(GLM_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GLM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body,
      });
    } catch {
      return reply(origin, 502, 'Could not reach GLM');
    }

    // A key GLM rejects is a problem on our side, not the caller's.
    const status = upstream.status === 401 || upstream.status === 403 ? 500 : upstream.status;
    return new Response(upstream.body, {
      status,
      headers: { 'Content-Type': 'application/json', ...cors(origin) },
    });
  },
};
