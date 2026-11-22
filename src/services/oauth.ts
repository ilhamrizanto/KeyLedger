import { Env } from '../types';
import { OAuthUserInput } from './auth';

export type OAuthProviderName = 'google' | 'microsoft' | 'github' | 'keycloak';

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  redirectUri: string;
  scope: string;
}

async function resolveProviderConfig(provider: OAuthProviderName, env: Env): Promise<ProviderConfig> {
  const baseUrl = (env.APP_URL || 'http://localhost:8787').replace(/\/+$/, '');

  switch (provider) {
    case 'google':
      return {
        clientId: env.GOOGLE_CLIENT_ID || '',
        clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
        redirectUri: `${baseUrl}/auth/callback/google`,
        scope: 'openid email profile',
      };
    case 'microsoft':
      return {
        clientId: env.MICROSOFT_CLIENT_ID || '',
        clientSecret: env.MICROSOFT_CLIENT_SECRET || '',
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        userinfoUrl: 'https://graph.microsoft.com/v1.0/me',
        redirectUri: `${baseUrl}/auth/callback/microsoft`,
        scope: 'openid email profile User.Read',
      };
    case 'github':
      return {
        clientId: env.GITHUB_CLIENT_ID || '',
        clientSecret: env.GITHUB_CLIENT_SECRET || '',
        authUrl: 'https://github.com/login/oauth/authorize',
        tokenUrl: 'https://github.com/login/oauth/access_token',
        userinfoUrl: 'https://api.github.com/user',
        redirectUri: `${baseUrl}/auth/callback/github`,
        scope: 'read:user user:email',
      };
    case 'keycloak': {
      const kcBase = (env.KEYCLOAK_BASE_URL || '').replace(/\/+$/, '');
      const kcInternal = (env.KEYCLOAK_INTERNAL_BASE_URL || '').replace(/\/+$/, '') || kcBase;
      const realm = (env.KEYCLOAK_REALM || '').trim();
      if (!kcBase || !realm) {
        throw new Error('Keycloak OAuth is not configured.');
      }
      const encRealm = encodeURIComponent(realm);
      const discResp = await fetch(`${kcInternal}/realms/${encRealm}/.well-known/openid-configuration`, {
        headers: { Accept: 'application/json' },
      });
      if (!discResp.ok) {
        throw new Error('Failed to read Keycloak OpenID Connect discovery document.');
      }
      const disc = (await discResp.json()) as { token_endpoint?: string; userinfo_endpoint?: string };
      return {
        clientId: env.KEYCLOAK_CLIENT_ID || '',
        clientSecret: env.KEYCLOAK_CLIENT_SECRET || '',
        authUrl: `${kcBase}/realms/${encRealm}/protocol/openid-connect/auth`,
        tokenUrl: disc.token_endpoint || '',
        userinfoUrl: disc.userinfo_endpoint || '',
        redirectUri: `${baseUrl}/auth/callback/keycloak`,
        scope: env.KEYCLOAK_SCOPE || 'openid email profile',
      };
    }
  }
}

export function isProviderConfigured(provider: OAuthProviderName, env: Env): boolean {
  switch (provider) {
    case 'google':
      return Boolean(env.GOOGLE_CLIENT_ID);
    case 'microsoft':
      return Boolean(env.MICROSOFT_CLIENT_ID);
    case 'github':
      return Boolean(env.GITHUB_CLIENT_ID);
    case 'keycloak':
      return Boolean(env.KEYCLOAK_CLIENT_ID && env.KEYCLOAK_BASE_URL && env.KEYCLOAK_REALM);
  }
}

export async function buildOAuthAuthUrl(provider: OAuthProviderName, state: string, env: Env): Promise<string> {
  const cfg = await resolveProviderConfig(provider, env);
  if (!cfg.clientId || !cfg.authUrl || !cfg.redirectUri) {
    throw new Error(`OAuth provider ${provider} is missing required configuration.`);
  }

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: cfg.scope,
    state,
  });

  if (provider === 'google') {
    params.set('access_type', 'online');
  }

  return `${cfg.authUrl}?${params.toString()}`;
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length < 2 || !parts[1]) {
    throw new Error('Invalid OIDC ID token.');
  }
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const json = atob(padded);
  return JSON.parse(json) as Record<string, unknown>;
}

export async function handleOAuthCallback(
  provider: OAuthProviderName,
  code: string,
  env: Env
): Promise<OAuthUserInput> {
  const cfg = await resolveProviderConfig(provider, env);
  if (!cfg.tokenUrl || !cfg.clientId) {
    throw new Error(`OAuth provider ${provider} is missing token configuration.`);
  }

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code,
    redirect_uri: cfg.redirectUri,
    grant_type: 'authorization_code',
  });

  const tokenResp = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  });

  const tokenData = (await tokenResp.json()) as { access_token?: string; id_token?: string };
  if (!tokenData.access_token) {
    throw new Error('Failed to obtain OAuth access token.');
  }

  let rawUser: Record<string, unknown>;
  try {
    const userResp = await fetch(cfg.userinfoUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/json',
        'User-Agent': 'TOTPVault/3.0',
      },
    });
    if (!userResp.ok) {
      throw new Error(`Userinfo HTTP ${userResp.status}`);
    }
    rawUser = (await userResp.json()) as Record<string, unknown>;

    if (provider === 'github') {
      const emailsResp = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/json',
          'User-Agent': 'TOTPVault/3.0',
        },
      });
      if (emailsResp.ok) {
        const emails = (await emailsResp.json()) as Array<{ email: string; primary?: boolean; verified?: boolean }>;
        const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified) ?? emails[0];
        if (primary?.email) {
          rawUser.email = primary.email;
        }
      }
    }
  } catch (err) {
    if (!tokenData.id_token) {
      throw err;
    }
    rawUser = decodeJwtPayload(tokenData.id_token);
  }

  let normalized: OAuthUserInput;
  switch (provider) {
    case 'google':
      normalized = {
        provider: 'google',
        provider_id: String(rawUser.sub ?? ''),
        email: String(rawUser.email ?? ''),
        name: rawUser.name ? String(rawUser.name) : null,
        avatar_url: rawUser.picture ? String(rawUser.picture) : null,
      };
      break;
    case 'microsoft':
      normalized = {
        provider: 'microsoft',
        provider_id: String(rawUser.id ?? ''),
        email: String(rawUser.mail ?? rawUser.userPrincipalName ?? ''),
        name: rawUser.displayName ? String(rawUser.displayName) : null,
        avatar_url: null,
      };
      break;
    case 'github':
      normalized = {
        provider: 'github',
        provider_id: String(rawUser.id ?? ''),
        email: String(rawUser.email ?? ''),
        name: rawUser.name ? String(rawUser.name) : rawUser.login ? String(rawUser.login) : null,
        avatar_url: rawUser.avatar_url ? String(rawUser.avatar_url) : null,
      };
      break;
    case 'keycloak':
      normalized = {
        provider: 'keycloak',
        provider_id: String(rawUser.sub ?? ''),
        email: String(rawUser.email ?? ''),
        name: rawUser.name
          ? String(rawUser.name)
          : rawUser.preferred_username
            ? String(rawUser.preferred_username)
            : null,
        avatar_url: rawUser.picture ? String(rawUser.picture) : null,
      };
      break;
  }

  if (!normalized.provider_id) {
    throw new Error('OAuth provider did not return a stable user identifier.');
  }
  if (!normalized.email) {
    throw new Error('OAuth provider did not return an email address.');
  }

  return normalized;
}
