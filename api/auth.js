const SECRET_KEY = process.env.SECRET_KEY || 'luminex-dev-secret-change-me';
const USERS_JSON = process.env.USERS || '[]';
const COOKIE_NAME = 'lx_auth';
const COOKIE_TTL = 60 * 60 * 24 * 30;

function getUsers() {
  try { return JSON.parse(USERS_JSON); }
  catch (e) { return []; }
}
function btoa64(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function atob64(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}
function makeToken(username, role) {
  const payload = JSON.stringify({ username, role, ts: Date.now() });
  const encoded = btoa64(payload);
  const sig = btoa64(SECRET_KEY + encoded).slice(0, 24);
  return encoded + '.' + sig;
}
function verifyToken(token) {
  if (!token) return null;
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    if (btoa64(SECRET_KEY + encoded).slice(0, 24) !== sig) return null;
    const payload = JSON.parse(atob64(encoded));
    if (Date.now() - payload.ts > COOKIE_TTL * 1000) return null;
    return payload;
  } catch (e) { return null; }
}
function cookieStr(value, maxAge) {
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

module.exports = async function handler(req, res) {
  if (req.method === 'POST') {
    const { username = '', password = '' } = req.body || {};
    if (!username.trim() || !password)
      return res.status(400).json({ ok: false, error: 'Заполни все поля' });
    const user = getUsers().find(u =>
      u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
    );
    if (!user) {
      await new Promise(r => setTimeout(r, 600));
      return res.status(401).json({ ok: false, error: 'Неверный логин или пароль' });
    }
    res.setHeader('Set-Cookie', cookieStr(makeToken(user.username, user.role || 'member'), COOKIE_TTL));
    return res.status(200).json({ ok: true, user: { username: user.username, name: user.name, role: user.role } });
  }
  if (req.method === 'GET') {
    const match = (req.headers.cookie || '').match(new RegExp(COOKIE_NAME + '=([^;]+)'));
    const payload = verifyToken(match ? match[1] : null);
    if (!payload) return res.status(401).json({ ok: false, authenticated: false });
    const found = getUsers().find(u => u.username === payload.username);
    return res.status(200).json({ ok: true, authenticated: true,
      user: { username: payload.username, name: found?.name || payload.username, role: payload.role }
    });
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', cookieStr('', 0));
    return res.status(200).json({ ok: true });
  }
  return res.status(405).json({ error: 'Method not allowed' });
};
