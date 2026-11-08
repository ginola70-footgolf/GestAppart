const MAX_BODY_BYTES = 2 * 1024 * 1024;
const SESSION_SECONDS = 12 * 60 * 60;

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
  return origin && allowed.includes(origin) ? origin : null;
}

function response(request, env, body, status = 200) {
  const origin = allowedOrigin(request, env);
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff'
  });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    headers.set('Access-Control-Max-Age', '86400');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}

async function verifyToken(token, secret) {
  if (!token || token.length > 256) return false;
  const [expiresText, signature, extra] = token.split('.');
  if (!expiresText || !signature || extra !== undefined) return false;
  const expires = Number(expiresText);
  if (!Number.isInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
  const expected = await sign(`gestappart:${expires}`, secret);
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return await crypto.subtle.verify('HMAC', key, fromBase64Url(signature), new TextEncoder().encode(`gestappart:${expires}`)) && signature === expected;
  } catch {
    return false;
  }
}

async function readJson(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) throw new Error('payload_too_large');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error('payload_too_large');
  return JSON.parse(text);
}

function validData(data) {
  return data && typeof data === 'object' && !Array.isArray(data)
    && Array.isArray(data.apt) && Array.isArray(data.spese) && Array.isArray(data.scadenze)
    && data.apt.length <= 5000 && data.spese.length <= 20000 && data.scadenze.length <= 20000;
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
if (request.method === "OPTIONS") {
  return new Response(null, {   // 👈 body null, non ""
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,      // l'origine specifica, non "*"
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  });
}
    if (!origin) return response(request, env, { error: 'origin_not_allowed' }, 403);
    if (!env.DB || !env.APP_PASSWORD || !env.SESSION_SECRET) {
      return response(request, env, { error: 'server_not_configured' }, 500);
    }

    const url = new URL(request.url);
    if (url.pathname === '/api/login' && request.method === 'POST') {
      let body;
      try { body = await readJson(request); } catch { return response(request, env, { error: 'invalid_request' }, 400); }
      if (!body || typeof body.password !== 'string' || body.password.length > 256) {
        return response(request, env, { error: 'invalid_credentials' }, 401);
      }
      const encoder = new TextEncoder();
      const [provided, expected] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(body.password)),
        crypto.subtle.digest('SHA-256', encoder.encode(env.APP_PASSWORD))
      ]);
      const valid = await crypto.subtle.timingSafeEqual?.(provided, expected).catch(() => false);
      // Web Crypto implementations without timingSafeEqual still compare fixed-size digests.
      let difference = 0;
      const a = new Uint8Array(provided), b = new Uint8Array(expected);
      for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
      if (!(valid ?? difference === 0)) return response(request, env, { error: 'invalid_credentials' }, 401);
      const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
      const token = `${expires}.${await sign(`gestappart:${expires}`, env.SESSION_SECRET)}`;
      return response(request, env, { token, expiresAt: expires });
    }

    if (url.pathname !== '/api/data') return response(request, env, { error: 'not_found' }, 404);
    if (!['GET', 'POST'].includes(request.method)) return response(request, env, { error: 'method_not_allowed' }, 405);
    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ') || !await verifyToken(authorization.slice(7), env.SESSION_SECRET)) {
      return response(request, env, { error: 'unauthorized' }, 401);
    }

    if (request.method === 'GET') {
      try {
        const row = await env.DB.prepare('SELECT data, updated_at FROM app_data WHERE id = 1').first();
        return response(request, env, { data: row ? JSON.parse(row.data) : null, updatedAt: row?.updated_at || null });
      } catch {
        return response(request, env, { error: 'database_error' }, 500);
      }
    }

    let data;
    try { data = await readJson(request); } catch (error) {
      return response(request, env, { error: error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_json' }, error.message === 'payload_too_large' ? 413 : 400);
    }
    if (!validData(data)) return response(request, env, { error: 'invalid_data' }, 400);
    try {
      const updatedAt = new Date().toISOString();
      await env.DB.prepare('INSERT INTO app_data (id, data, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at')
        .bind(JSON.stringify(data), updatedAt).run();
      return response(request, env, { ok: true, updatedAt });
    } catch {
      return response(request, env, { error: 'database_error' }, 500);
    }
  }
};
