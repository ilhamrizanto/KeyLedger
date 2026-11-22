export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  // Non-secret vars (wrangler.jsonc)
  APP_NAME: string;
  APP_ENV: string;
  APP_URL: string;
  AUTH_OPEN_SIGNUP?: string;
  SESSION_COOKIE_NAME: string;
  REMEMBER_COOKIE_NAME: string;
  SESSION_LIFETIME: string;
  ADMIN_EMAILS: string;
  ALLOWED_EMAILS: string;
  ALLOWED_DOMAINS: string;
  MAIL_FROM_EMAIL: string;
  MAIL_FROM_NAME: string;
  KEYCLOAK_BASE_URL?: string;
  KEYCLOAK_INTERNAL_BASE_URL?: string;
  KEYCLOAK_REALM?: string;
  KEYCLOAK_SCOPE?: string;

  // Secrets (.dev.vars / wrangler secret put)
  ENCRYPTION_KEY: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  KEYCLOAK_CLIENT_ID?: string;
  KEYCLOAK_CLIENT_SECRET?: string;
  MAILERSEND_KEY?: string;
}

export interface User {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
  google_id: string | null;
  microsoft_id: string | null;
  github_id: string | null;
  created_at: string;
  updated_at: string;
  is_admin: number;
  role_label: string | null;
}

export interface OtpProfile {
  id: number;
  user_id: number;
  name: string;
  issuer: string;
  secret_encrypted: string;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: number;
  period: number;
  color: string;
  icon: string;
  hide_code: number;
  created_at: string;
  updated_at: string;
  owner_name?: string | null;
  owner_email?: string;
  is_owner?: number;
  can_edit?: number;
  initial_code?: string;
  initial_remaining?: number;
}

export interface WhitelistUser {
  id: number;
  email: string;
  name: string;
  role_label: string;
  is_admin: number;
  created_by_email: string | null;
  created_at: string;
}

export type AppContext = {
  Bindings: Env;
  Variables: {
    user: User | null;
    csrfToken: string;
  };
};
