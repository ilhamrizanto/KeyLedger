# KeyLedger

> **A serverless, zero-leak TOTP (Time-based One-Time Password) vault built on Cloudflare Workers, Hono, Cloudflare D1, and Web Crypto API.**
> Secret seeds are encrypted at rest with **AES-256-GCM** and **never transmitted to the browser**. Verification codes are computed server-side at the edge and can be shared with collaborators without exposing the underlying Base32 secret.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

---

### Upstream Attribution & Notice of Modification (GPL-3.0)

This project is an **independent community fork and architectural rewrite** based on [Token2 TOTPVault](https://github.com/token2/TOTPVault) originally developed by [TOKEN2 Multifactor Authentication](https://www.token2.swiss) (Switzerland), licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

In compliance with **GPL-3.0 Section 5(a)**:
- **Original work:** Token2 TOTPVault (PHP / MySQL).
- **Modifications (2026):** Rewritten from PHP/MariaDB to TypeScript, Hono, Cloudflare Workers, Cloudflare D1 (SQLite), and Web Crypto API; added persistent D1 sessions (`user_sessions`), Google Authenticator `otpauth-migration://` protobuf import, open OAuth signup support, and a redesigned Swiss Archival Ledger UI.
- **License:** This derivative work remains licensed under the **GNU General Public License v3.0** (see [LICENSE](LICENSE)).

> **Disclaimer:** This fork is independently maintained and is **not** officially affiliated with, endorsed by, or sponsored by TOKEN2 Multifactor Authentication. All original copyrights and trademarks belong to their respective owners.

---

## Core Features

- **Server-Side TOTP Generation (RFC 6238):** Supports `SHA1`, `SHA256`, and `SHA512` with 6 or 8 digits and configurable time windows. Secrets are decrypted only in Worker memory during code generation.
- **AES-256-GCM Encryption at Rest:** Uses Web Crypto API (`crypto.subtle`) with a 96-bit IV and 128-bit authentication tag (`base64(iv || tag || ciphertext)`), binary-compatible with the legacy PHP payload format.
- **Google Authenticator Export Import:** Supports both standard `otpauth://totp/...` URIs and Google Authenticator's protobuf-encoded `otpauth-migration://offline?data=...` export URIs.
- **Collaborator Delegation:** Share individual TOTP records by email with read-only or metadata-edit permissions without exposing raw Base32 seeds.
- **OAuth 2.0 / OIDC & Persistent Edge Sessions:** Supports Google, Microsoft Entra ID, GitHub, and Keycloak, backed by SHA-256 hashed sliding sessions in Cloudflare D1 (`HttpOnly`, `SameSite=Lax`, `Secure`).
- **Day & Night Themes:** Supports both light and dark modes with WCAG AA contrast ratios.

---

## Requirements

- [Node.js](https://nodejs.org/) 20+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (included in `devDependencies`)
- A free [Cloudflare](https://dash.cloudflare.com/) account (for Workers & D1 deployment)

---

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure local secrets

Copy `.dev.vars.example` to `.dev.vars` (never commit `.dev.vars`):

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set `ENCRYPTION_KEY` (and any OAuth client credentials you want to test).

### 3. Apply D1 migrations locally

```bash
npm run db:migrate:local
```

### 4. Start the local Workers dev server

```bash
npm run dev
```

Open `http://localhost:8787`. When `APP_ENV` is `"demo"` or `"development"` in `wrangler.jsonc`, you can sign in via `/auth/dev-login` (**Enter Demo Ledger**) without configuring external OAuth credentials.

---

## Deploying to Cloudflare (Free Tier)

1. **Authenticate Wrangler:**
   ```bash
   npx wrangler login
   ```
2. **Create a D1 database:**
   ```bash
   npx wrangler d1 create keyledger-db
   ```
   Copy the generated `database_id` into `wrangler.jsonc`.
3. **Apply remote D1 migrations:**
   ```bash
   npm run db:migrate:remote
   ```
4. **Configure production secrets (never put secrets in `wrangler.jsonc`):**
   ```bash
   npx wrangler secret put ENCRYPTION_KEY
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
5. **Update `wrangler.jsonc`:**
   - Set `"APP_ENV": "production"`
   - Set `"APP_URL"` to your `https://<your-worker>.workers.dev` or custom domain
   - Set `"ADMIN_EMAILS"` to your administrator email(s)
6. **Deploy:**
   ```bash
   npm run deploy
   ```

---

## Migrating Data from Legacy MariaDB

If you have existing data from the legacy PHP/MariaDB version, export it to SQLite `INSERT` statements and execute against D1:

```bash
php tools/export-mariadb-to-d1.php migrations/seed-mariadb.sql
npx wrangler d1 execute keyledger-db --remote --file=migrations/seed-mariadb.sql
```

---

## Testing & Verification

```bash
npm run types
npm run typecheck
npm test
```

---

## License

This project is licensed under the **GNU General Public License v3.0** — see [LICENSE](LICENSE) for details.
