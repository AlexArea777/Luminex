const COOKIE_NAME = 'lx_auth';
const COOKIE_TTL = 60 * 60 * 24 * 30; // 30 days

function getEnv(env) {
  return {
    SECRET_KEY: env.SECRET_KEY || 'luminex-dev-secret-change-me',
    USERS_JSON: env.USERS || '[{"username":"admin","password":"luminex2026","name":"Admin","role":"owner"}]'
  };
}

function getUsers(usersJson) {
  try { return JSON.parse(usersJson); }
  catch (e) { return []; }
}

async function hmac(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function makeToken(secret, username, role) {
  const payload = btoa(JSON.stringify({ username, role, ts: Date.now() }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const sig = (await hmac(secret, payload)).slice(0, 32);
  return payload + '.' + sig;
}

async function verifyToken(secret, token) {
  if (!token) return null;
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = (await hmac(secret, payload)).slice(0, 32);
    if (sig !== expected) return null;
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (Date.now() - data.ts > COOKIE_TTL * 1000) return null;
    return data;
  } catch (e) { return null; }
}

function cookieStr(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}

export async function onRequest({ request, env }) {
  const { SECRET_KEY, USERS_JSON } = getEnv(env);
  const method = request.method;

  // POST — login
  if (method === 'POST') {
    let body = {};
    try { body = await request.json(); } catch (e) {}
    const username = (body.username || '').trim();
    const password = body.password || '';

    if (!username || !password) {
      return json({ ok: false, error: 'Заполни все поля' }, 400);
    }

    const users = getUsers(USERS_JSON);
    const user = users.find(u =>
      u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );

    if (!user) {
      await new Promise(r => setTimeout(r, 600));
      return json({ ok: false, error: 'Неверный логин или пароль' }, 401);
    }

    const token = await makeToken(SECRET_KEY, user.username, user.role || 'member');
    return json(
      { ok: true, user: { username: user.username, name: user.name, role: user.role } },
      200,
      { 'Set-Cookie': cookieStr(token, COOKIE_TTL) }
    );
  }

  // GET — check session
  if (method === 'GET') {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(COOKIE_NAME + '=([^;]+)'));
    const token = match ? match[1] : null;
    const payload = await verifyToken(SECRET_KEY, token);

    if (!payload) {
      return json({ ok: false, authenticated: false }, 401);
    }

    const users = getUsers(USERS_JSON);
    const found = users.find(u => u.username === payload.username);
    return json({
      ok: true, authenticated: true,
      user: { username: payload.username, name: found?.name || payload.username, role: payload.role }
    });
  }

  // DELETE — logout
  if (method === 'DELETE') {
    return json({ ok: true }, 200, { 'Set-Cookie': cookieStr('', 0) });
  }

  return json({ error: 'Method not allowed' }, 405);
}
