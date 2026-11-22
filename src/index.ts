import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { AppContext } from './types';
import { isRequestHttps, randomHex, signToken, verifySignedToken } from './lib/cookies';
import { getCurrentUser } from './services/auth';
import { authRoutes } from './routes/auth';
import { apiRoutes } from './routes/api';
import { pageRoutes } from './routes/pages';

const app = new Hono<AppContext>();

// Global HTTP Security Headers & Error Handling
app.use('*', async (c, next) => {
  await next();
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

  if (isRequestHttps(c.req.url, c.req.raw.headers, c.env.APP_URL)) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Public Health Check (DevOps & Monitoring Probe)
const healthHandler = async (c: { env: AppContext['Bindings']; json: (d: unknown, s?: number) => Response }) => {
  const start = Date.now();
  let status = 'healthy';
  let dbStatus = 'connected';
  let dbError: string | null = null;
  const isDev = c.env.APP_ENV === 'development' || c.env.APP_ENV === 'demo';

  try {
    await c.env.DB.prepare('SELECT 1').first();
  } catch (err) {
    status = 'unhealthy';
    dbStatus = 'disconnected';
    dbError = isDev && err instanceof Error ? err.message : 'Database connection error';
  }

  return c.json(
    {
      status,
      app: c.env.APP_NAME || 'KeyLedger',
      version: '3.0-cf',
      environment: c.env.APP_ENV || 'production',
      database: dbStatus,
      db_error: dbError,
      latency_ms: Date.now() - start,
      runtime: 'cloudflare-workers',
      timestamp: Math.floor(Date.now() / 1000),
    },
    status === 'healthy' ? 200 : 503
  );
};

app.get('/api/health', healthHandler);
app.get('/healthz', healthHandler);
app.get('/health', healthHandler);

// Auth & CSRF Context Middleware
app.use('*', async (c, next) => {
  const user = await getCurrentUser(c);
  c.set('user', user);

  // Stateless HMAC-signed CSRF token cookie
  const csrfCookie = getCookie(c, 'totpvault_csrf');
  let csrfToken = csrfCookie ? await verifySignedToken(csrfCookie, c.env.ENCRYPTION_KEY) : null;
  if (!csrfToken) {
    csrfToken = randomHex(32);
    const signed = await signToken(csrfToken, c.env.ENCRYPTION_KEY);
    setCookie(c, 'totpvault_csrf', signed, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: isRequestHttps(c.req.url, c.req.raw.headers, c.env.APP_URL),
      maxAge: 86400 * 30,
    });
  }
  c.set('csrfToken', csrfToken);

  await next();
});

// Mount Route Groups
app.route('/auth', authRoutes);
app.route('/api', apiRoutes);
app.route('/', pageRoutes);

// Global Exception Handler
app.onError((err, c) => {
  console.error('[KeyLedger]', err.message);
  const isDev = c.env.APP_ENV === 'development' || c.env.APP_ENV === 'demo';
  if (c.req.path.startsWith('/api/')) {
    return c.json(
      { error: isDev ? err.message : 'Internal Server Error. Please contact your system administrator.' },
      500
    );
  }
  return c.html(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>500 Server Error : KeyLedger</title><link rel="icon" type="image/png" href="/favicon.png"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{background:#07080C;color:#F5F5F7;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem;box-sizing:border-box}.box{background:#14161F;border:1px solid #262A38;border-radius:20px;padding:2.25rem 2rem;max-width:440px;width:100%;text-align:center}.btn{display:inline-block;padding:.65rem 1.5rem;background:#5AC8FA;color:#07080C;text-decoration:none;border-radius:10px;font-weight:700;font-size:.875rem}</style></head><body><main class="box"><h1 style="font-size:1.35rem;font-weight:800;margin:0 0 .5rem;color:#F5F5F7">500 Server Error</h1><p style="color:#C7C7CC;font-size:.875rem;line-height:1.6;margin:0 0 1.5rem">${isDev ? err.message : 'A technical error occurred on the server.'}</p><a href="/tokens" class="btn">Return to Keychain</a></main></body></html>`,
    500
  );
});

export default app;
