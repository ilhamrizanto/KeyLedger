import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { AppContext } from '../types';
import { checkRateLimit } from '../lib/rate-limiter';
import { isValidEmail } from '../lib/html';
import { isRequestHttps, randomHex, signToken, timingSafeEqualStrings, verifySignedToken } from '../lib/cookies';
import { findOrCreateOAuthUser, loadUserById, loginUser, logoutUser, syncEnvAdmins } from '../services/auth';
import { buildOAuthAuthUrl, handleOAuthCallback, OAuthProviderName } from '../services/oauth';
import { createMagicLink, findOrCreateMagicLinkUser, sendMagicLinkEmail, verifyMagicLink } from '../services/magic-link';
import { createProfile, shareProfile } from '../services/profile';
import { recordAuditLog } from '../services/audit';
import { renderUnauthorized } from '../views/unauthorized';

const VALID_PROVIDERS = new Set<OAuthProviderName>(['google', 'microsoft', 'github', 'keycloak']);

export const authRoutes = new Hono<AppContext>();

authRoutes.post('/magic-request', async (c) => {
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'unknown';
  const rl = await checkRateLimit(c.env.DB, `magic_req:ip_${ip}`, 10, 60);
  if (!rl.allowed) {
    c.header('Retry-After', String(rl.retryAfter));
    return c.json({ error: `Too many requests. Please wait ${rl.retryAfter} seconds.` }, 429);
  }

  let email = '';
  const contentType = c.req.header('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = (await c.req.json().catch(() => ({}))) as { email?: string };
    email = String(body.email || '');
  } else {
    const form = await c.req.parseBody();
    email = String(form.email || '');
  }
  email = email.trim().toLowerCase();

  if (!isValidEmail(email)) {
    return c.redirect('/?error=' + encodeURIComponent('Please enter a valid email address.'));
  }

  try {
    await syncEnvAdmins(c.env);
    const url = await createMagicLink(email, c.env);
    const isDev = c.env.APP_ENV === 'development' || c.env.APP_ENV === 'demo';
    if (!c.env.MAILERSEND_KEY || isDev) {
      return c.redirect(url);
    }

    const sent = await sendMagicLinkEmail(email, url, c.env);
    if (!sent) {
      throw new Error('Email could not be sent. Check your MailerSend configuration.');
    }
    return c.redirect('/?magic=sent&email=' + encodeURIComponent(email));
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Magic link request failed.';
    return c.redirect('/?error=' + encodeURIComponent(msg));
  }
});

authRoutes.get('/magic', async (c) => {
  const token = c.req.query('token') || '';
  const email = c.req.query('email') || '';

  try {
    const verifiedEmail = await verifyMagicLink(token, email, c.env);
    const dbUser = await findOrCreateMagicLinkUser(verifiedEmail, c.env);
    await loginUser(c, dbUser.id);
    await recordAuditLog(c.env, {
      actorUserId: dbUser.id,
      actorEmail: dbUser.email,
      action: 'LOGIN_MAGIC',
      target: dbUser.email,
      ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
    });
    return c.redirect('/');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid magic link.';
    return c.redirect('/?error=' + encodeURIComponent(msg));
  }
});

authRoutes.get('/login/:provider', async (c) => {
  const provider = c.req.param('provider') as OAuthProviderName;
  if (!VALID_PROVIDERS.has(provider)) {
    return c.redirect('/?error=' + encodeURIComponent(`Unknown OAuth provider: ${provider}`));
  }

  try {
    const state = randomHex(16);
    const signedState = await signToken(`${provider}:${state}`, c.env.ENCRYPTION_KEY);
    const secure = isRequestHttps(c.req.url, c.req.raw.headers, c.env.APP_URL);

    setCookie(c, 'totpvault_oauth_state', signedState, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure,
      maxAge: 600,
    });

    const authUrl = await buildOAuthAuthUrl(provider, state, c.env);
    return c.redirect(authUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth login failed.';
    return c.redirect('/?error=' + encodeURIComponent(msg));
  }
});

authRoutes.get('/callback/:provider', async (c) => {
  const provider = c.req.param('provider') as OAuthProviderName;
  if (!VALID_PROVIDERS.has(provider)) {
    return c.redirect('/?error=' + encodeURIComponent(`Unknown OAuth provider: ${provider}`));
  }

  try {
    const errParam = c.req.query('error');
    if (errParam) {
      throw new Error(c.req.query('error_description') || errParam);
    }

    const code = c.req.query('code') || '';
    const state = c.req.query('state') || '';
    const stateCookie = getCookie(c, 'totpvault_oauth_state') || '';
    deleteCookie(c, 'totpvault_oauth_state', { path: '/' });

    const verifiedPayload = await verifySignedToken(stateCookie, c.env.ENCRYPTION_KEY);
    if (!verifiedPayload || !timingSafeEqualStrings(verifiedPayload, `${provider}:${state}`)) {
      throw new Error('OAuth state mismatch: possible CSRF attack.');
    }

    await syncEnvAdmins(c.env);
    const userData = await handleOAuthCallback(provider, code, c.env);
    const dbUser = await findOrCreateOAuthUser(userData, c.env);
    await loginUser(c, dbUser.id);
    await recordAuditLog(c.env, {
      actorUserId: dbUser.id,
      actorEmail: dbUser.email,
      action: `LOGIN_${provider.toUpperCase()}`,
      target: dbUser.email,
      ipAddress: c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? '',
    });
    return c.redirect('/');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth callback failed.';
    if (msg.includes('not registered in the system whitelist') || msg.includes('Access Denied')) {
      const match = msg.match(/\(([^)]+)\)/);
      return c.html(renderUnauthorized(match?.[1] || '', msg), 403);
    }
    return c.redirect('/?error=' + encodeURIComponent(msg));
  }
});

authRoutes.get('/unauthorized', (c) => {
  const email = c.req.query('email') || '';
  const message = c.req.query('message') || 'Your account is not registered in the system whitelist.';
  return c.html(renderUnauthorized(email, message), 403);
});

authRoutes.get('/logout', async (c) => {
  await logoutUser(c);
  return c.redirect('/');
});

authRoutes.get('/dev-login', async (c) => {
  const isDev = c.env.APP_ENV === 'development' || c.env.APP_ENV === 'demo';
  if (!isDev) {
    return c.redirect('/');
  }

  await syncEnvAdmins(c.env);

  let loginId = Number(c.req.query('id') || 1);
  let targetUser = await loadUserById(loginId, c.env);

  if (!targetUser) {
    // Fallback: create a demo admin user if DB is fresh
    const adminEmail = (c.env.ADMIN_EMAILS || 'demo@totpvault.local').split(',')[0]!.trim().toLowerCase();
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1')
      .bind(adminEmail)
      .first<{ id: number }>();

    if (existing) {
      loginId = existing.id;
    } else {
      const ins = await c.env.DB.prepare('INSERT INTO users (email, name) VALUES (?, ?)')
        .bind(adminEmail, 'Demo Administrator')
        .run();
      loginId = Number(ins.meta.last_row_id);
    }
    targetUser = await loadUserById(loginId, c.env);
  }

  if (!targetUser) {
    return c.redirect('/?error=' + encodeURIComponent('No demo user available.'));
  }

  // Auto-seed realistic demo data once if ledger is empty so all menus (Personal, Shared, Audit, Roles) are populated
  const existingProfiles = await c.env.DB.prepare('SELECT COUNT(*) AS cnt FROM otp_profiles').first<{ cnt: number }>();
  if ((existingProfiles?.cnt ?? 0) === 0) {
    try {
      const teammates = [
        { email: 'nadia.ops@organization.ch', name: 'Nadia Kusuma', role: 'Operations Lead', admin: 0 },
        { email: 'rizky.dev@organization.ch', name: 'Rizky Pratama', role: 'Principal Engineer', admin: 0 },
        { email: 'sara.sec@organization.ch', name: 'Sara Wijaya', role: 'Security Auditor', admin: 1 },
        { email: 'bima.fin@organization.ch', name: 'Bima Santoso', role: 'Finance Controller', admin: 0 },
      ];

      for (const tm of teammates) {
        await c.env.DB.prepare(`INSERT OR IGNORE INTO users (email, name) VALUES (?, ?)`)
          .bind(tm.email, tm.name)
          .run();
        await c.env.DB.prepare(
          `INSERT OR IGNORE INTO whitelist_users (email, name, role_label, is_admin, created_by_email)
           VALUES (?, ?, ?, ?, ?)`
        )
          .bind(tm.email, tm.name, tm.role, tm.admin, targetUser.email)
          .run();
      }

      const nadia = await c.env.DB.prepare("SELECT id FROM users WHERE email = 'nadia.ops@organization.ch'").first<{
        id: number;
      }>();
      const rizky = await c.env.DB.prepare("SELECT id FROM users WHERE email = 'rizky.dev@organization.ch'").first<{
        id: number;
      }>();

      // 6 Personal keys owned by Demo Admin
      const cfId = await createProfile(
        targetUser.id,
        {
          name: 'dns-custody@organization.ch',
          issuer: 'Cloudflare Production',
          secret: 'JBSWY3DPEHPK3PXP',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        },
        c.env
      );
      const ghId = await createProfile(
        targetUser.id,
        {
          name: 'release-signing-authority',
          issuer: 'GitHub Organization',
          secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
          algorithm: 'SHA256',
          digits: 6,
          period: 30,
        },
        c.env
      );
      const awsId = await createProfile(
        targetUser.id,
        {
          name: 'infra-root@organization.ch',
          issuer: 'AWS Root Console',
          secret: 'MFRGGZDFMZTWQ2LK',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        },
        c.env
      );
      const gwId = await createProfile(
        targetUser.id,
        {
          name: 'superadmin@organization.ch',
          issuer: 'Google Workspace',
          secret: 'NB2W45DFOIZA',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        },
        c.env
      );
      await createProfile(
        targetUser.id,
        {
          name: 'vault-master@organization.ch',
          issuer: '1Password Business',
          secret: 'ORSXG5BAMV4GC3LQ',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        },
        c.env
      );
      await createProfile(
        targetUser.id,
        {
          name: 'deploy-prod@organization.ch',
          issuer: 'Vercel Enterprise',
          secret: 'KRSXG5CTMVRXEZLU',
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        },
        c.env
      );

      // Share keys to teammates (populates Delegation Audit & Dossier Collaborators)
      await shareProfile(cfId, targetUser.id, 'nadia.ops@organization.ch', true, c.env);
      await shareProfile(cfId, targetUser.id, 'sara.sec@organization.ch', false, c.env);
      await shareProfile(ghId, targetUser.id, 'rizky.dev@organization.ch', false, c.env);
      await shareProfile(awsId, targetUser.id, 'sara.sec@organization.ch', false, c.env);
      await shareProfile(gwId, targetUser.id, 'nadia.ops@organization.ch', false, c.env);

      // 3 Shared keys owned by teammates & shared with Demo Admin (populates SHARED tab)
      if (nadia?.id) {
        const stripeId = await createProfile(
          nadia.id,
          {
            name: 'treasury-payouts@organization.ch',
            issuer: 'Stripe Live Treasury',
            secret: 'KRSXG5CTMVRXEZLU',
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
          },
          c.env
        );
        await shareProfile(stripeId, nadia.id, targetUser.email, false, c.env);
      }
      if (rizky?.id) {
        const linearId = await createProfile(
          rizky.id,
          {
            name: 'engineering@organization.ch',
            issuer: 'Linear Workspace',
            secret: 'MZXW6YTBOI',
            algorithm: 'SHA1',
            digits: 6,
            period: 30,
          },
          c.env
        );
        const figmaId = await createProfile(
          rizky.id,
          {
            name: 'design-systems@organization.ch',
            issuer: 'Figma Organization',
            secret: 'JBSWY3DPEHPK3PXP',
            algorithm: 'SHA256',
            digits: 6,
            period: 30,
          },
          c.env
        );
        await shareProfile(linearId, rizky.id, targetUser.email, true, c.env);
        await shareProfile(figmaId, rizky.id, targetUser.email, false, c.env);
      }
    } catch (seedErr) {
      console.error('[demo-seed]', seedErr);
    }
  }

  await loginUser(c, targetUser.id);
  return c.redirect('/tokens');
});
