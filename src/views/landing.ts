import { renderBrandMark, renderLayout } from './layout';

export interface LandingOptions {
  appEnv: string;
  googleOn: boolean;
  microsoftOn: boolean;
}

export function renderLanding(opts: LandingOptions): string {
  const isDev = opts.appEnv === 'development' || opts.appEnv === 'demo';
  const devLabel = opts.appEnv === 'demo' ? 'ENTER DEMO LEDGER' : 'ENTER DEV LEDGER';

  return (
    renderLayout('KeyLedger : Cryptographic 2FA Custody Ledger') +
    `
<style>
.ar-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

/* ── Top Architectural Metadata Bar (Full-Bleed 1px Rule) ── */
.ar-topbar {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  border-bottom: 1px solid var(--rule);
  background: var(--surface);
  min-height: 50px;
}

.ar-cell {
  display: inline-flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0 1.25rem;
  border-right: 1px solid var(--rule);
  font-size: 0.75rem;
}
.ar-cell:last-child { border-right: none; }

.ar-topbar-right {
  display: flex;
  align-items: stretch;
}
.ar-topbar-right .ar-cell {
  border-right: none;
  border-left: 1px solid var(--rule);
}

/* ── Main 12-Column Architectural Spread ── */
.ar-spread {
  flex: 1;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  border-left: 1px solid var(--rule);
  border-right: 1px solid var(--rule);
  display: grid;
  grid-template-columns: 7fr 5fr;
}

.ar-col-main {
  border-right: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.ar-hero-pad {
  padding: clamp(2rem, 5vw, 4.25rem) clamp(1.5rem, 4vw, 3.5rem);
}

.ar-kicker {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.25rem;
}

.ar-h1 {
  font-size: clamp(2.65rem, 5.4vw, 4.5rem);
  line-height: 0.98;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin-bottom: 1.5rem;
}

.ar-lead {
  font-size: 1.0625rem;
  line-height: 1.65;
  color: var(--ink-2);
  max-width: 52ch;
  margin-bottom: 2.25rem;
}

.ar-auth-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.ar-google-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 50px;
  padding: 0.85rem 1.5rem;
  background: var(--ink);
  color: var(--bg);
  border: 1px solid var(--ink);
  border-radius: var(--r-sharp);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  transition: transform 120ms var(--ease-out), background-color 140ms ease, border-color 140ms ease;
}
.ar-google-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}
.ar-google-btn:active { transform: scale(0.98); }

.ar-open-caption {
  font-size: 0.75rem;
  color: var(--ink-3);
}

/* ── Live Cryptographic Passcode Tape (Built into the Ledger Grid) ── */
.ar-tape-wrap {
  border-top: 1px solid var(--rule);
  background: var(--surface);
}

.ar-tape-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--rule);
  background: var(--surface-sub);
  font-size: 0.72rem;
}

.ar-tape-row {
  display: grid;
  grid-template-columns: 44px 1.2fr 1fr auto;
  align-items: center;
  border-bottom: 1px solid var(--rule);
  transition: background-color 140ms ease;
}
.ar-tape-row:last-child { border-bottom: none; }
.ar-tape-row:hover { background: var(--surface-sub); }

.ar-tape-num {
  padding: 1rem 0;
  text-align: center;
  border-right: 1px solid var(--rule);
  font-size: 1.25rem;
  color: var(--ink-3);
}

.ar-tape-ident {
  padding: 0.85rem 1.25rem;
  border-right: 1px solid var(--rule);
  min-width: 0;
}

.ar-tape-code-cell {
  padding: 0.85rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.ar-tape-digits {
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--ink);
}

.ar-tape-bar {
  height: 3px;
  background: var(--surface-sub);
  width: 100%;
  overflow: hidden;
}
.ar-tape-fill {
  height: 100%;
  background: var(--accent);
  transition: width 250ms linear;
}

/* ── Right Column: Vertical Specification Dossier ── */
.ar-col-dossier {
  display: flex;
  flex-direction: column;
  background: var(--surface);
}

.ar-dossier-header {
  padding: 1.25rem 1.75rem;
  border-bottom: 1px solid var(--rule);
  background: var(--surface-sub);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--ink-2);
}

.ar-dossier-entry {
  padding: 2rem 1.75rem;
  border-bottom: 1px solid var(--rule);
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 1rem;
}

.ar-entry-num {
  font-size: 2.25rem;
  line-height: 0.9;
  color: var(--accent);
}

.ar-entry-title {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 0.4rem;
}

.ar-entry-desc {
  font-size: 0.875rem;
  color: var(--ink-2);
  line-height: 1.6;
}

.ar-spec-matrix {
  margin-top: auto;
  padding: 1.5rem 1.75rem;
  background: var(--surface-sub);
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.ar-matrix-line {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--rule);
}
.ar-matrix-line:last-child { border-bottom: none; padding-bottom: 0; }

/* ── Bottom Colophon ── */
.ar-footer {
  border-top: 1px solid var(--rule);
  background: var(--surface);
  padding: 0.875rem 1.25rem;
  font-size: 0.75rem;
  color: var(--ink-3);
}
.ar-footer-inner {
  max-width: 1280px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

@media (max-width: 960px) {
  .ar-spread {
    grid-template-columns: 1fr;
    border-left: none;
    border-right: none;
  }
  .ar-col-main { border-right: none; border-bottom: 1px solid var(--rule); }
}

@media (max-width: 640px) {
  .ar-cell.hide-mobile { display: none; }
  .ar-tape-row {
    grid-template-columns: 38px 1fr;
  }
  .ar-tape-ident { border-right: none; }
  .ar-tape-code-cell {
    grid-column: 1 / -1;
    border-top: 1px solid var(--rule);
    background: var(--surface-sub);
  }
}
</style>

<div class="ar-page">
  <header class="ar-topbar">
    <div style="display:flex;align-items:stretch">
      <a href="/" class="ar-cell" style="font-weight:700;color:var(--ink)">
        ${renderBrandMark(22)}
        <span class="mono" style="letter-spacing:0.06em">KEY<span style="color:var(--accent)">LEDGER</span></span>
      </a>
      <div class="ar-cell mono hide-mobile" style="color:var(--ink-3)">
        RFC-6238 · AES-256-GCM
      </div>
    </div>

    <div class="ar-topbar-right">
      <button type="button" class="ar-cell mono" onclick="toggleTheme(event)" aria-label="Switch daylight or night ledger theme" style="background:transparent;border-top:none;border-bottom:none;border-right:none;color:var(--ink)">
        <span>MODE:</span>
        <strong data-theme-label>DAY</strong>
      </button>
      <a href="/auth/login/google" class="ar-cell mono" style="font-weight:600;background:var(--surface-sub)">
        SIGN IN
      </a>
    </div>
  </header>

  <main class="ar-spread">
    <div class="ar-col-main">
      <div class="ar-hero-pad">
        <div id="lp-error-banner" style="display:none;margin-bottom:1.5rem;padding:0.875rem 1rem;background:var(--danger-soft);border:1px solid var(--danger-rule);color:var(--danger);font-size:0.875rem"></div>

        <div class="ar-kicker mono">CRYPTOGRAPHIC CUSTODY · CLOUDFLARE EDGE</div>
        <h1 class="ar-h1 serif">
          Custody for shared <em>two-factor</em> keys without seed exposure.
        </h1>
        <p class="ar-lead">
          Store Base32 TOTP seeds sealed with AES-256-GCM inside Cloudflare D1. Team members generate live verification codes on the server without ever downloading raw secret keys.
        </p>

        <div class="ar-auth-grid">
          <a href="/auth/login/google" class="ar-google-btn">
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.5h7.11c4.16-3.83 6.56-9.47 6.56-16.15z"/><path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.51c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.69 28.19C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.19v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.89l7.35-5.7z"/><path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.11l7.35 5.7c1.73-5.2 6.58-9.06 12.31-9.06z"/></svg>
            <span>AUTHENTICATE WITH GOOGLE</span>
          </a>

          ${
            opts.microsoftOn
              ? `<a href="/auth/login/microsoft" class="btn btn-secondary btn-lg mono">
                   <span>MICROSOFT ENTRA ID</span>
                 </a>`
              : ''
          }

          ${
            isDev
              ? `<a href="/auth/dev-login" class="btn btn-secondary btn-lg mono">
                   <span>${devLabel}</span>
                 </a>`
              : ''
          }
        </div>

        <p class="ar-open-caption mono">
          OPEN CLEARANCE: Any Google account may initialize an isolated personal ledger immediately.
        </p>
      </div>

      <!-- Live Cryptographic Passcode Tape -->
      <section class="ar-tape-wrap" aria-label="Live Passcode Register Preview">
        <div class="ar-tape-head mono">
          <span>LIVE REGISTER SPECIMEN · 30S WINDOW</span>
          <span id="lp-demo-rem">30S REMAINING</span>
        </div>
        <div class="ar-tape-bar">
          <div id="lp-demo-bar" class="ar-tape-fill" style="width:100%"></div>
        </div>

        <div class="ar-tape-row">
          <div class="ar-tape-num serif">01</div>
          <div class="ar-tape-ident">
            <div class="mono" style="font-size:0.68rem;color:var(--ink-3)">CLOUDFLARE INFRASTRUCTURE</div>
            <div style="font-weight:600;font-size:0.9375rem">dns-custody@organization.ch</div>
          </div>
          <div class="ar-tape-code-cell">
            <span class="ar-tape-digits mono blur-morph" id="lp-code-0">482 910</span>
            <button type="button" class="btn btn-secondary btn-sm mono" onclick="copySpecimenCode(0)">
              <span id="lp-lbl-0">COPY</span>
            </button>
          </div>
        </div>

        <div class="ar-tape-row">
          <div class="ar-tape-num serif">02</div>
          <div class="ar-tape-ident">
            <div class="mono" style="font-size:0.68rem;color:var(--ink-3)">GITHUB ORGANIZATION</div>
            <div style="font-weight:600;font-size:0.9375rem">release-signing-authority</div>
          </div>
          <div class="ar-tape-code-cell">
            <span class="ar-tape-digits mono blur-morph" id="lp-code-1">914 205</span>
            <button type="button" class="btn btn-secondary btn-sm mono" onclick="copySpecimenCode(1)">
              <span id="lp-lbl-1">COPY</span>
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Right Column: Vertical Specification Dossier -->
    <aside class="ar-col-dossier" aria-label="Cryptographic Architecture Dossier">
      <div class="ar-dossier-header mono">
        ARCHITECTURAL DOSSIER · CUSTODY PROTOCOL
      </div>

      <div class="ar-dossier-entry">
        <div class="ar-entry-num serif">01</div>
        <div>
          <h2 class="ar-entry-title">AES-256-GCM Sealed Records</h2>
          <p class="ar-entry-desc">
            Every TOTP secret is encrypted using Web Crypto API with a unique 96-bit IV and 128-bit authentication tag before storage in Cloudflare D1.
          </p>
        </div>
      </div>

      <div class="ar-dossier-entry">
        <div class="ar-entry-num serif">02</div>
        <div>
          <h2 class="ar-entry-title">Zero-Seed Collaborator Delegation</h2>
          <p class="ar-entry-desc">
            Grant read-only or edit clearance to teammates by email. Collaborators receive computed 6-digit codes from the edge without accessing the underlying Base32 seed.
          </p>
        </div>
      </div>

      <div class="ar-dossier-entry">
        <div class="ar-entry-num serif">03</div>
        <div>
          <h2 class="ar-entry-title">30-Day Persistent Edge Custody</h2>
          <p class="ar-entry-desc">
            SHA-256 hashed session tokens stored in D1 with sliding expiration keep your browser authenticated across visits without repeated sign-in prompts.
          </p>
        </div>
      </div>

      <div class="ar-spec-matrix mono">
        <div class="ar-matrix-line">
          <span style="color:var(--ink-3)">CIPHER SUITE</span>
          <strong>AES-256-GCM (WEB CRYPTO)</strong>
        </div>
        <div class="ar-matrix-line">
          <span style="color:var(--ink-3)">HMAC ALGORITHMS</span>
          <strong>SHA-1 / SHA-256 / SHA-512</strong>
        </div>
        <div class="ar-matrix-line">
          <span style="color:var(--ink-3)">PERSISTENCE LAYER</span>
          <strong>CLOUDFLARE D1 (SQLITE)</strong>
        </div>
      </div>
    </aside>
  </main>

  <footer class="ar-footer">
    <div class="ar-footer-inner mono">
      <span>KEYLEDGER · CRYPTOGRAPHIC 2FA CUSTODY LEDGER</span>
      <div style="display:flex;gap:1.5rem">
        <a href="https://github.com/token2/TOTPVault" target="_blank" rel="noopener">UPSTREAM: TOKEN2 SWITZERLAND</a>
        <a href="https://github.com/ilhamrizanto/KeyLedger" target="_blank" rel="noopener">LICENSE: GPL-3.0</a>
      </div>
    </div>
  </footer>
</div>

<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var err = params.get('error');
  if (err) {
    var banner = document.getElementById('lp-error-banner');
    if (banner) {
      banner.textContent = err;
      banner.style.display = 'block';
    }
  }

  var mults = [2654435761, 1597334677];
  var paused = false;
  var lastStep = -1;

  window.togglePreviewTimer = function () {
    paused = !paused;
    var btn = document.getElementById('kc-pause-btn');
    var lbl = document.getElementById('kc-pause-lbl');
    if (btn) btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    if (lbl) lbl.textContent = paused ? 'RESUME' : 'PAUSE';
  };

  function tick(force) {
    if (paused && !force) return;
    var now = Math.floor(Date.now() / 1000);
    var rem = 30 - (now % 30);
    var step = Math.floor(now / 30);

    var remEl = document.getElementById('lp-demo-rem');
    var barEl = document.getElementById('lp-demo-bar');
    if (remEl) remEl.textContent = rem + 'S REMAINING';
    if (barEl) barEl.style.width = ((rem / 30) * 100).toFixed(1) + '%';

    if (step !== lastStep || force) {
      lastStep = step;
      mults.forEach(function (m, idx) {
        var el = document.getElementById('lp-code-' + idx);
        if (!el) return;
        var raw = String(Math.abs((step * m) % 1000000)).padStart(6, '0');
        el.classList.add('is-morphing');
        setTimeout(function () {
          el.textContent = raw.slice(0, 3) + ' ' + raw.slice(3);
          el.classList.remove('is-morphing');
        }, 120);
      });
    }
  }

  tick(true);
  setInterval(function () { tick(false); }, 1000);
})();

window.copySpecimenCode = function (idx) {
  var codeEl = document.getElementById('lp-code-' + idx);
  var lblEl = document.getElementById('lp-lbl-' + idx);
  if (!codeEl || !lblEl) return;
  var raw = codeEl.textContent.replace(/\\s+/g, '');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(raw).catch(function () {});
  }
  codeEl.classList.add('is-morphing');
  setTimeout(function () { codeEl.classList.remove('is-morphing'); }, 150);
  lblEl.textContent = 'COPIED';
  window.showToast('COPIED PASSCODE ' + raw, 'success');
  setTimeout(function () { lblEl.textContent = 'COPY'; }, 1400);
};
</script>
</body>
</html>`
  );
}
