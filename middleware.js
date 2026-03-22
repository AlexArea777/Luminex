export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  // Everything is handled by client-side auth guard in dashboard.html
  // Middleware only protects /dashboard server-side as extra layer
  const open = ['/', '/login', '/api/auth', '/api/bot'];
  for (const p of open) {
    if (path === p || path.startsWith(p + '/')) return;
  }

  // Static assets — always allow
  if (/\.(js|css|png|jpg|svg|ico|woff2?)$/.test(path)) return;

  // /dashboard — check cookie
  const cookie = request.headers.get('cookie') || '';
  if (cookie.includes('lx_auth=')) return;

  return Response.redirect(new URL('/login', request.url), 302);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)']
};
