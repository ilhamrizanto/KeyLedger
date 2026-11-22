import { Context, Hono } from 'hono';
import { AppContext } from '../types';
import { generateProfileOTP, listProfilesForUser } from '../services/profile';
import { isProviderConfigured } from '../services/oauth';
import { renderLanding } from '../views/landing';
import { renderDashboard } from '../views/dashboard';
import { renderNotFound } from '../views/not-found';

export const pageRoutes = new Hono<AppContext>();

pageRoutes.get('/', (c) => {
  const user = c.get('user');
  if (user) {
    return c.redirect('/dashboard');
  }
  return c.html(
    renderLanding({
      appEnv: c.env.APP_ENV || 'production',
      googleOn: isProviderConfigured('google', c.env),
      microsoftOn: isProviderConfigured('microsoft', c.env),
    })
  );
});

pageRoutes.get('/landing', (c) => {
  return c.html(
    renderLanding({
      appEnv: c.env.APP_ENV || 'production',
      googleOn: isProviderConfigured('google', c.env),
      microsoftOn: isProviderConfigured('microsoft', c.env),
    })
  );
});

async function renderUserDashboard(c: Context<AppContext>, viewName: 'tokens' | 'whitelist' | 'access') {
  const user = c.get('user');
  if (!user) {
    return c.redirect('/');
  }
  if ((viewName === 'whitelist' || viewName === 'access') && !user.is_admin) {
    return c.redirect('/tokens');
  }

  const profiles = await listProfilesForUser(user.id, c.env);
  if (viewName === 'tokens') {
    await Promise.all(
      profiles.map(async (p) => {
        try {
          const otp = await generateProfileOTP(p.id, user.id, c.env);
          p.initial_code = otp.code;
          p.initial_remaining = otp.remaining;
        } catch {
          p.initial_code = '';
          p.initial_remaining = p.period || 30;
        }
      })
    );
  }

  const csrfToken = c.get('csrfToken');
  return c.html(renderDashboard(user, profiles, viewName, csrfToken));
}

pageRoutes.get('/dashboard', (c) => renderUserDashboard(c, 'tokens'));
pageRoutes.get('/tokens', (c) => renderUserDashboard(c, 'tokens'));
pageRoutes.get('/whitelist', (c) => renderUserDashboard(c, 'whitelist'));
pageRoutes.get('/roles', (c) => renderUserDashboard(c, 'whitelist'));
pageRoutes.get('/access', (c) => renderUserDashboard(c, 'access'));
pageRoutes.get('/audit', (c) => renderUserDashboard(c, 'access'));

pageRoutes.notFound((c) => {
  const user = c.get('user');
  return c.html(renderNotFound(user), 404);
});
