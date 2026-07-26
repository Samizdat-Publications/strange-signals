// Worker entry script for the static site. Routing is asset-first (see
// wrangler.jsonc), so this only runs for paths with no matching file on disk —
// in practice, POST /api/signal. Anything else that lands here is handed to the
// static-asset binding so a stray path still gets the normal 404 page.
//
// /api/signal proxies SIGNAL Analyst requests to the Anthropic Messages API
// using the site's own key, so a visitor can try the analyst without bringing
// their own. The browser never sees the key.
//
// SPENDING IS DOUBLE OPT-IN AND OFF BY DEFAULT. This endpoint returns 503 and
// costs nothing unless BOTH exist:
//
//   1. ANTHROPIC_API_KEY   — a secret (`wrangler secret put`)
//   2. SIGNAL_QUOTA        — a KV binding declared in wrangler.jsonc
//
// The KV binding is deliberately mandatory. It is the only place a durable
// counter can live, and without a durable counter the caps below are
// unenforceable — so rather than spend without a limit, we refuse to spend.
// The client falls back to its own bring-your-own-key path on a 503.

const UPSTREAM = 'https://api.anthropic.com/v1/messages';

// Haiku 4.5 only. The client may ask for Sonnet or Opus on a user's own key;
// on the site's key the model is not negotiable.
const MODEL = 'claude-haiku-4-5';

// Per-request ceilings. These bound the cost of any single call regardless of
// what the client sends.
const MAX_TOKENS = 1024;      // output cap
const MAX_BODY_BYTES = 262144; // 256 KB — a runaway history can't be replayed at us
const MAX_MESSAGES = 40;

// Daily ceilings, overridable as plain (non-secret) environment variables.
// Defaults are deliberately conservative. Rough cost at Haiku 4.5 rates
// ($1/M input, $5/M output) with prompt caching on the system+tools prefix:
// roughly $0.03 for the first call of a conversation and ~$0.007 after, so
// 100 calls/day lands near $0.80/day worst case. Raise GLOBAL_DAILY_CALLS
// only as far as you are willing to see on a bill.
const DEFAULT_GLOBAL_DAILY = 100;
const DEFAULT_PER_IP_DAILY = 12;

function json(status, body, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({'content-type': 'application/json; charset=utf-8'}, extra || {})
  });
}

// Counter key rolls at UTC midnight. Two KV writes per served request
// (per-IP + global) keeps us well inside the free tier's 1,000 writes/day
// at any GLOBAL_DAILY_CALLS value under ~450.
function today() {
  return new Date().toISOString().slice(0, 10);
}

async function bump(kv, key, limit, ttl) {
  const current = parseInt((await kv.get(key)) || '0', 10) || 0;
  if (current >= limit) return {ok: false, used: current, limit};
  await kv.put(key, String(current + 1), {expirationTtl: ttl});
  return {ok: true, used: current + 1, limit};
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== '/api/signal') {
      // Not ours. Hand back to static assets so unknown paths still 404 the
      // way the rest of the site does.
      return env.ASSETS.fetch(request);
    }
    return handleSignal(request, env);
  }
};

async function handleSignal(request, env) {
  if (request.method !== 'POST') {
    return json(405, {error: {type: 'method_not_allowed', message: 'POST only.'}}, {allow: 'POST'});
  }
  if (!env.ANTHROPIC_API_KEY || !env.SIGNAL_QUOTA) {
    return json(503, {
      error: {type: 'proxy_disabled', message: 'No shared analyst on this deployment.'}
    });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, {error: {type: 'too_large', message: 'Conversation too large for the shared analyst.'}});
  }

  let body;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    return json(400, {error: {type: 'bad_json', message: 'Malformed request body.'}});
  }
  if (!Array.isArray(body.messages) || !body.messages.length) {
    return json(400, {error: {type: 'bad_request', message: 'No messages supplied.'}});
  }
  if (body.messages.length > MAX_MESSAGES) {
    return json(413, {error: {type: 'too_long', message: 'Conversation too long for the shared analyst. Start a new one.'}});
  }

  const day = today();
  const ttl = 172800; // 48h — comfortably past the rollover, then self-cleans
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const globalLimit = parseInt(env.GLOBAL_DAILY_CALLS || '', 10) || DEFAULT_GLOBAL_DAILY;
  const ipLimit = parseInt(env.PER_IP_DAILY_CALLS || '', 10) || DEFAULT_PER_IP_DAILY;

  // Per-IP first: a single heavy visitor should exhaust their own allowance
  // before they can eat into the global pool.
  const perIp = await bump(env.SIGNAL_QUOTA, `ip:${ip}:${day}`, ipLimit, ttl);
  if (!perIp.ok) {
    return json(429, {
      error: {
        type: 'quota_exhausted_ip',
        message: 'You have used the free analyst calls for today. Add your own API key to keep going — it is free to create and the map works fully without one.'
      }
    });
  }
  const glob = await bump(env.SIGNAL_QUOTA, `global:${day}`, globalLimit, ttl);
  if (!glob.ok) {
    return json(429, {
      error: {
        type: 'quota_exhausted_global',
        message: 'The shared analyst has hit its daily limit. Add your own API key to keep going — it is free to create and the map works fully without one.'
      }
    });
  }

  // Rebuild the upstream payload rather than forwarding the client's. Anything
  // not named here — a different model, a larger max_tokens, an injected
  // top-level field — is dropped rather than passed through.
  const payload = {
    model: MODEL,
    max_tokens: Math.min(parseInt(body.max_tokens, 10) || MAX_TOKENS, MAX_TOKENS),
    messages: body.messages,
    stream: body.stream === true
  };
  if (body.system) payload.system = body.system;
  if (Array.isArray(body.tools)) payload.tools = body.tools;

  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });

  // Stream the body straight through so token-by-token rendering still works.
  const headers = new Headers();
  headers.set('content-type', upstream.headers.get('content-type') || 'application/json');
  headers.set('cache-control', 'no-store');
  headers.set('x-signal-quota-remaining', String(Math.max(0, ipLimit - perIp.used)));
  headers.set('x-signal-quota-limit', String(ipLimit));
  return new Response(upstream.body, {status: upstream.status, headers});
}
