import { OtpProfile, User } from '../types';
import { escapeHtml, formatOtpCode } from '../lib/html';
import { renderBrandMark, renderLayout } from './layout';

function renderLedgerRows(profiles: OtpProfile[]): string {
  return profiles
    .map((p, idx) => {
      const id = Number(p.id);
      const num = String(idx + 1).padStart(2, '0');
      const name = escapeHtml(p.name);
      const issuer = escapeHtml(p.issuer || 'UNSPECIFIED SERVICE');
      const period = Number(p.period || 30);
      const algo = escapeHtml(p.algorithm || 'SHA1');
      const digits = Number(p.digits || 6);
      const isOwner = Boolean(p.is_owner);
      const canEdit = Boolean(p.can_edit);
      const hideCode = Boolean(p.hide_code);
      const initCode = p.initial_code || '';
      const rem = Number(p.initial_remaining ?? period);
      const pct = Math.max(0, Math.min(100, (rem / period) * 100));
      const formatted = formatOtpCode(initCode);

      return `
      <article class="lg-row" id="card-${id}"
               data-id="${id}"
               data-num="${num}"
               data-period="${period}"
               data-algo="${algo}"
               data-digits="${digits}"
               data-owner="${isOwner ? '1' : '0'}"
               data-can-edit="${canEdit ? '1' : '0'}"
               data-hide="${hideCode ? '1' : '0'}"
               data-name="${escapeHtml((p.name || '').toLowerCase())}"
               data-issuer="${escapeHtml((p.issuer || '').toLowerCase())}"
               data-display-name="${name}"
               data-display-issuer="${issuer}">
        <div class="lg-cell-num serif">${num}</div>

        <div class="lg-cell-ident">
          <div class="lg-issuer mono">${issuer}</div>
          <h3 class="lg-account" title="${name}">${name}</h3>
        </div>

        <div class="lg-cell-meta">
          <span class="stamp ${isOwner ? '' : 'stamp-accent'}">${isOwner ? 'PERSONAL' : 'SHARED'}</span>
          <span class="stamp">${algo} · ${period}S</span>
        </div>

        <div class="lg-cell-code">
          <button type="button" class="lg-copy-trigger" onclick="copyCode(${id})" aria-label="Copy verification code for ${name}">
            <span class="lg-digits mono blur-morph" id="code-${id}" data-raw-code="${escapeHtml(initCode)}" ${hideCode ? 'data-hidden="1"' : ''}>
              ${hideCode ? '••• •••' : escapeHtml(formatted)}
            </span>
            <span class="lg-copy-action mono" id="copy-lbl-${id}">COPY</span>
          </button>
          <div class="lg-timer-wrap">
            <span class="lg-timer mono ${rem <= 5 ? 'is-low' : ''}" id="timer-${id}">${rem}S</span>
          </div>
          <div class="lg-bar-track">
            <div class="lg-bar-fill ${rem <= 5 ? 'is-low' : ''}" id="bar-${id}" style="width:${pct.toFixed(1)}%"></div>
          </div>
        </div>

        <div class="lg-cell-actions">
          <button type="button" class="btn btn-secondary btn-sm mono" onclick="openDossier(${id})" aria-label="Open dossier for ${name}">
            <span>DOSSIER</span>
          </button>
        </div>
      </article>`;
    })
    .join('');
}

export function renderDashboard(
  user: User,
  profiles: OtpProfile[],
  currentView: string,
  csrfToken: string
): string {
  const viewTitles: Record<string, string> = {
    tokens: 'Safe-Deposit Ledger : KeyLedger',
    access: 'Delegation Audit : KeyLedger',
    whitelist: 'Clearance Directory : KeyLedger',
  };
  const pageTitle = viewTitles[currentView] ?? 'Safe-Deposit Ledger : KeyLedger';
  const isAdmin = Boolean(user.is_admin);
  const ownedCount = profiles.filter((p) => Boolean(p.is_owner)).length;
  const sharedCount = profiles.length - ownedCount;

  return (
    renderLayout(pageTitle) +
    `
<style>
.lg-shell {
  min-height: 100dvh;
  display: flex;
  background: var(--bg);
}

/* ── Architectural Left Sidebar (248px, 1px hairline border) ── */
.lg-sidebar {
  width: 248px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100dvh;
}

.lg-sb-brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 1.125rem 1.25rem;
  border-bottom: 1px solid var(--rule);
  font-weight: 700;
  color: var(--ink);
}

.lg-sb-section {
  padding: 1rem 0;
  border-bottom: 1px solid var(--rule);
}

.lg-sb-label {
  padding: 0 1.25rem 0.5rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--ink-3);
}

.lg-sb-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  min-height: 40px;
  padding: 0.5rem 1.25rem;
  border: none;
  border-left: 2px solid transparent;
  background: transparent;
  color: var(--ink-2);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.76rem;
  font-weight: 500;
  text-align: left;
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
}
.lg-sb-btn:hover {
  background: var(--surface-sub);
  color: var(--ink);
}
.lg-sb-btn.active {
  background: var(--surface-sub);
  color: var(--ink);
  border-left-color: var(--accent);
  font-weight: 600;
}

.lg-sb-footer {
  margin-top: auto;
  border-top: 1px solid var(--rule);
  background: var(--surface-sub);
}

.lg-sb-user {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--rule);
}

.lg-sb-controls {
  display: grid;
  grid-template-columns: 1fr;
  border-bottom: 1px solid var(--rule);
}

.lg-sb-ctrl {
  min-height: 40px;
  padding: 0.5rem;
  border: none;
  background: transparent;
  color: var(--ink-2);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  font-weight: 600;
  transition: background-color 140ms ease, color 140ms ease;
}
.lg-sb-ctrl:hover { background: var(--surface-hover); color: var(--ink); }

.lg-sb-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--ink-2);
  transition: background-color 140ms ease, color 140ms ease;
}
.lg-sb-logout:hover {
  background: var(--danger-soft);
  color: var(--danger);
}

/* ── Mobile Header & Bottom Nav (Hidden on Desktop) ── */
.lg-mob-topbar {
  display: none;
  align-items: stretch;
  justify-content: space-between;
  border-bottom: 1px solid var(--rule);
  background: var(--surface);
  min-height: 48px;
}

.lg-mob-nav {
  display: none;
}

/* ── Main Architectural Frame ── */
.lg-frame {
  flex: 1;
  min-width: 0;
  background: var(--surface);
  display: flex;
  flex-direction: column;
}

/* ── Editorial Masthead Band ── */
.lg-masthead {
  padding: 2rem 2rem 1.5rem;
  border-bottom: 1px solid var(--rule);
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem;
  background: var(--bg);
}

.lg-kicker {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--accent);
  margin-bottom: 0.35rem;
}

.lg-h1 {
  font-size: clamp(2.1rem, 3.8vw, 3.1rem);
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--ink);
}

.lg-masthead-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

/* ── Filter & Search Command Bar ── */
.lg-cmdbar {
  display: grid;
  grid-template-columns: auto 1fr;
  border-bottom: 1px solid var(--rule);
  background: var(--surface-sub);
}

.lg-filter-group {
  display: flex;
  align-items: stretch;
}

.lg-filter-btn {
  padding: 0.75rem 1.125rem;
  border: none;
  border-right: 1px solid var(--rule);
  background: transparent;
  color: var(--ink-2);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.74rem;
  font-weight: 600;
  transition: background-color 140ms ease, color 140ms ease;
}
.lg-filter-btn:hover { background: var(--surface-hover); color: var(--ink); }
.lg-filter-btn.active {
  background: var(--surface);
  color: var(--accent);
  box-shadow: inset 0 -2px 0 var(--accent);
}

.lg-search-cell {
  display: flex;
  align-items: center;
  padding: 0 1rem;
  background: var(--surface);
}

.lg-search-input {
  width: 100%;
  height: 44px;
  border: none;
  background: transparent;
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.8125rem;
}
.lg-search-input:focus {
  outline: none;
}

/* ── Ledger Column Header Strip ── */
.lg-col-headers {
  display: grid;
  grid-template-columns: 64px 1.4fr 200px 320px 130px;
  border-bottom: 1px solid var(--rule);
  background: var(--surface-sub);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.07em;
  color: var(--ink-3);
}
.lg-col-headers > div {
  padding: 0.55rem 1.125rem;
  border-right: 1px solid var(--rule);
}
.lg-col-headers > div:first-child { text-align: center; padding: 0.55rem 0; }
.lg-col-headers > div:last-child { border-right: none; text-align: right; }

/* ── Full-Width Architectural Ledger Row ── */
.lg-row {
  display: grid;
  grid-template-columns: 64px 1.4fr 200px 320px 130px;
  align-items: stretch;
  border-bottom: 1px solid var(--rule);
  background: var(--surface);
  transition: background-color 140ms ease;
}
.lg-row:hover {
  background: var(--surface-sub);
}
.lg-row.is-active {
  background: var(--accent-soft);
}

.lg-cell-num {
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--rule);
  font-size: 1.5rem;
  color: var(--ink-3);
}

.lg-cell-ident {
  padding: 1rem 1.25rem;
  border-right: 1px solid var(--rule);
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.lg-issuer {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
  margin-bottom: 0.15rem;
}

.lg-account {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lg-cell-meta {
  padding: 1rem 1.125rem;
  border-right: 1px solid var(--rule);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}

.lg-cell-code {
  position: relative;
  border-right: 1px solid var(--rule);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
}

.lg-copy-trigger {
  display: inline-flex;
  align-items: baseline;
  gap: 0.75rem;
  background: transparent;
  border: none;
  color: var(--ink);
  padding: 0.85rem 0;
  text-align: left;
  transition: transform 100ms var(--ease-out);
}
.lg-copy-trigger:active { transform: scale(0.975); }

.lg-digits {
  font-size: 1.65rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  line-height: 1;
}

.lg-copy-action {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--ink-3);
  letter-spacing: 0.05em;
}
.lg-copy-trigger:hover .lg-copy-action {
  color: var(--accent);
}

.lg-timer {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--ink-3);
}
.lg-timer.is-low, .mono.is-low {
  color: var(--accent);
}

.lg-bar-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: transparent;
}
.lg-bar-fill {
  height: 100%;
  background: var(--ink-3);
  opacity: 0.45;
  transition: width 250ms linear;
}
.lg-bar-fill.is-low {
  background: var(--accent);
  opacity: 1;
}

.lg-cell-actions {
  padding: 0 1.125rem;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

/* ── Slide-Over Dossier Drawer (Emil Kowalski --ease-drawer) ── */
.dr-backdrop {
  position: fixed;
  inset: 0;
  z-index: 750;
  background: rgba(14, 14, 12, 0.48);
  opacity: 0;
  pointer-events: none;
  transition: opacity 220ms var(--ease-out);
}
.dr-backdrop.is-open {
  opacity: 1;
  pointer-events: auto;
}

.dr-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 800;
  width: 100%;
  max-width: 440px;
  background: var(--surface);
  border-left: 1px solid var(--rule);
  box-shadow: var(--shadow-drawer);
  display: flex;
  flex-direction: column;
  transform: translateX(100%);
  transition: transform 260ms var(--ease-drawer);
}
.dr-panel.is-open {
  transform: translateX(0);
}

.dr-head {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--rule);
  background: var(--surface-sub);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dr-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.dr-readout-box {
  border: 1px solid var(--rule);
  background: var(--bg);
  padding: 1.25rem;
}

.dr-big-code {
  font-size: 2.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.05;
  margin: 0.35rem 0 1rem;
}

/* ── Hold-to-Delete Button with clip-path Overlay (emil-design-eng) ── */
.hold-del-btn {
  position: relative;
  overflow: hidden;
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--danger-rule);
  border-radius: var(--r-sharp);
  background: var(--danger-soft);
  color: var(--danger);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  user-select: none;
  -webkit-user-select: none;
  transition: transform 120ms var(--ease-out);
}
.hold-del-btn:active { transform: scale(0.985); }

.hold-del-overlay {
  position: absolute;
  inset: 0;
  background: var(--danger);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  clip-path: inset(0 100% 0 0);
  transition: clip-path 180ms var(--ease-out);
  pointer-events: none;
}
.hold-del-btn.is-holding .hold-del-overlay {
  clip-path: inset(0 0 0 0);
  transition: clip-path 1100ms linear;
}

/* ── Admin Audit Tables ── */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.data-table th, .data-table td {
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--rule);
  text-align: left;
}
.data-table th {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-3);
  background: var(--surface-sub);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-bottom: 1px solid var(--rule);
}
.metric-cell {
  padding: 1.5rem;
  border-right: 1px solid var(--rule);
}
.metric-cell:last-child { border-right: none; }
.metric-num { font-size: 2.25rem; line-height: 1; }
.metric-cap { font-size: 0.7rem; color: var(--ink-3); margin-top: 0.35rem; }

@media (max-width: 960px) {
  .lg-shell { flex-direction: column; height: 100dvh; overflow: hidden; }
  .lg-sidebar { display: none; }
  .lg-mob-topbar { display: flex; flex-shrink: 0; }
  .lg-frame {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg);
    padding-bottom: 0;
  }
  #view-tokens:not([style*="display:none"]):not([style*="display: none"]) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  #view-tokens .lg-masthead,
  #view-tokens .lg-cmdbar { flex-shrink: 0; }
  #ledger-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 0.75rem 0.75rem calc(68px + env(safe-area-inset-bottom));
  }
  #view-access,
  #view-whitelist {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding-bottom: calc(68px + env(safe-area-inset-bottom));
  }
  .lg-mob-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 500;
    display: flex;
    align-items: stretch;
    background: var(--surface);
    border-top: 1px solid var(--rule);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .lg-mob-btn {
    flex: 1;
    min-height: 52px;
    border: none;
    border-right: 1px solid var(--rule);
    background: transparent;
    color: var(--ink-2);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.7rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .lg-mob-btn:last-child { border-right: none; }
  .lg-mob-btn.active { background: var(--surface-sub); color: var(--accent); }
  .lg-col-headers { display: none; }
  .lg-row {
    grid-template-columns: 44px 1fr auto;
    margin-bottom: 0.75rem;
    border: 1px solid var(--rule);
    border-radius: var(--r-sharp);
    box-shadow: 0 1px 2px rgba(18, 18, 16, 0.04);
  }
  .lg-row:last-child { margin-bottom: 0; }
  .lg-cell-meta { display: none; }
  .lg-cell-ident { border-right: none; min-width: 0; }
  .lg-cell-actions { grid-row: 1; grid-column: 3; border-left: 1px solid var(--rule); }
  .lg-cell-code {
    grid-column: 1 / -1;
    border-right: none;
    border-top: 1px solid var(--rule);
    background: var(--surface-sub);
    padding: 0.45rem 0.875rem;
  }
  .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .lg-masthead { padding: 1.25rem 1rem; }
  .lg-cmdbar { grid-template-columns: 1fr; }
  .lg-filter-group { border-bottom: 1px solid var(--rule); overflow-x: auto; }
  .dr-panel {
    top: auto;
    left: 0;
    right: 0;
    bottom: 0;
    max-width: 100%;
    max-height: 88dvh;
    border-left: none;
    border-top: 1px solid var(--rule);
    transform: translateY(100%);
  }
  .dr-panel.is-open { transform: translateY(0); }
}
</style>

<div class="lg-shell">
  <!-- Architectural Left Sidebar -->
  <aside class="lg-sidebar" aria-label="Workspace navigation">
    <a href="/" class="lg-sb-brand">
      ${renderBrandMark(28)}
      <div>
        <div class="mono" style="font-size:0.9375rem;letter-spacing:0.06em;line-height:1.1">KEY<span style="color:var(--accent)">LEDGER</span></div>
        <div class="mono" style="font-size:0.62rem;color:var(--ink-3);letter-spacing:0.06em;margin-top:0.15rem">RFC-6238 LEDGER</div>
      </div>
    </a>

    <nav class="lg-sb-section" aria-label="Primary sections">
      <div class="lg-sb-label">NAVIGATION</div>
      <button type="button" class="lg-sb-btn ${currentView === 'tokens' ? 'active' : ''}" onclick="switchView('tokens')">
        <span><span style="color:var(--ink-3);margin-right:0.45rem">01</span>LEDGER</span>
        <span class="stamp">${profiles.length}</span>
      </button>
      ${
        isAdmin
          ? `<button type="button" class="lg-sb-btn ${currentView === 'access' ? 'active' : ''}" onclick="switchView('access')">
               <span><span style="color:var(--ink-3);margin-right:0.45rem">02</span>AUDIT</span>
             </button>
             <button type="button" class="lg-sb-btn ${currentView === 'whitelist' ? 'active' : ''}" onclick="switchView('whitelist')">
               <span><span style="color:var(--ink-3);margin-right:0.45rem">03</span>ROLES</span>
             </button>`
          : ''
      }
    </nav>

    <div class="lg-sb-footer">
      <div class="lg-sb-user">
        <div style="font-size:0.8125rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(user.name || 'Custodian')}</div>
        <div class="mono" style="font-size:0.68rem;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(user.email)}</div>
      </div>
      <div class="lg-sb-controls">
        <button type="button" class="lg-sb-ctrl" onclick="toggleTheme(event)" aria-label="Switch daylight or night ledger theme">
          MODE: <span data-theme-label>DAY</span>
        </button>
      </div>
      <a href="/auth/logout" class="lg-sb-logout">SIGN OUT</a>
    </div>
  </aside>

  <!-- Mobile Top Bar -->
  <header class="lg-mob-topbar">
    <a href="/" style="display:inline-flex;align-items:center;gap:0.5rem;padding:0 1rem;font-weight:700">
      ${renderBrandMark(22)}
      <span class="mono" style="font-size:0.8125rem;letter-spacing:0.05em">KEY<span style="color:var(--accent)">LEDGER</span></span>
    </a>
    <div style="display:flex;align-items:stretch">
      <button type="button" class="lg-sb-ctrl" onclick="toggleTheme(event)" style="border-left:1px solid var(--rule);border-right:1px solid var(--rule);padding:0 0.875rem">
        <span data-theme-label>DAY</span>
      </button>
      <a href="/auth/logout" class="lg-sb-logout" style="padding:0 0.875rem">OUT</a>
    </div>
  </header>

  <main class="lg-frame">
    <!-- ── VIEW 01: SAFE-DEPOSIT KEY LEDGER ── -->
    <section id="view-tokens" style="${currentView !== 'tokens' ? 'display:none' : ''}">
      <div class="lg-masthead">
        <div>
          <div class="lg-kicker mono">CUSTODIAN · ${escapeHtml(user.email.toUpperCase())}</div>
          <h1 class="lg-h1 serif" id="topbar-title">Safe-Deposit Key Ledger.</h1>
        </div>
        <div class="lg-masthead-actions">
          <button type="button" class="btn btn-secondary btn-sm mono" onclick="openImportModal()">
            <span>IMPORT URI</span>
          </button>
          <a href="/api/export-profiles" class="btn btn-secondary btn-sm mono">
            <span>EXPORT CSV</span>
          </a>
          <button type="button" class="btn btn-primary btn-sm mono" onclick="openAddModal()" id="topbar-add-btn">
            <span>+ NEW KEY RECORD</span>
          </button>
        </div>
      </div>

      <div class="lg-cmdbar">
        <div class="lg-filter-group" role="group" aria-label="Filter records by custody scope">
          <button type="button" class="lg-filter-btn active" onclick="setFilter('all', this)">ALL (${profiles.length})</button>
          <button type="button" class="lg-filter-btn" onclick="setFilter('mine', this)">PERSONAL (${ownedCount})</button>
          <button type="button" class="lg-filter-btn" onclick="setFilter('shared', this)">SHARED (${sharedCount})</button>
        </div>
        <div class="lg-search-cell">
          <label for="search-input" class="sr-only">Search ledger records</label>
          <input id="search-input" type="search" class="lg-search-input" placeholder="FILTER BY SERVICE OR ACCOUNT [PRESS /]..." oninput="applyFilters()">
        </div>
      </div>

      ${
        profiles.length === 0
          ? `<div style="padding:4.5rem 2rem;text-align:center">
               <div class="mono" style="font-size:0.72rem;color:var(--ink-3);letter-spacing:0.08em;margin-bottom:0.5rem">REGISTER EMPTY · 00 RECORDS</div>
               <h2 class="serif" style="font-size:2.25rem;margin-bottom:0.5rem">No cryptographic seeds recorded.</h2>
               <p style="font-size:0.875rem;color:var(--ink-2);max-width:42ch;margin:0 auto 1.75rem">
                 Initialize your first TOTP record or batch-import existing otpauth:// URIs into your sealed ledger.
               </p>
               <button type="button" class="btn btn-primary btn-lg mono" onclick="openAddModal()">+ INITIALIZE FIRST KEY RECORD</button>
             </div>`
          : `<div class="lg-col-headers" aria-hidden="true">
               <div>NO.</div>
               <div>SERVICE &amp; ACCOUNT</div>
               <div>CUSTODY &amp; SPEC</div>
               <div>VERIFICATION CODE (CLICK TO COPY)</div>
               <div>DOSSIER</div>
             </div>
             <div id="token-grid">${renderLedgerRows(profiles)}</div>`
      }
    </section>

    ${
      isAdmin
        ? `
    <!-- ── VIEW 02: DELEGATION AUDIT (ADMIN) ── -->
    <section id="view-access" style="${currentView !== 'access' ? 'display:none' : ''}">
      <div class="lg-masthead">
        <div>
          <div class="lg-kicker mono">ADMINISTRATIVE OVERSIGHT · DELEGATION LEDGER</div>
          <h2 class="lg-h1 serif">Active Share Audit.</h2>
        </div>
      </div>

      <div class="metrics-grid">
        <div class="metric-cell"><div class="metric-num serif" id="m-tokens">-</div><div class="metric-cap mono">TOTAL KEYS</div></div>
        <div class="metric-cell"><div class="metric-num serif" id="m-shares">-</div><div class="metric-cap mono">ACTIVE SHARES</div></div>
        <div class="metric-cell"><div class="metric-num serif" id="m-collab">-</div><div class="metric-cap mono">COLLABORATORS</div></div>
        <div class="metric-cell"><div class="metric-num serif" id="m-users">-</div><div class="metric-cap mono">ROLE RECORDS</div></div>
      </div>

      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Key Record</th>
              <th>Custodian</th>
              <th>Delegated To</th>
              <th>Clearance</th>
              <th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody id="access-shares-body">
            <tr><td colspan="5" class="mono" style="color:var(--ink-3)">LOADING DELEGATION RECORDS...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── VIEW 03: CLEARANCE ROLES (ADMIN) ── -->
    <section id="view-whitelist" style="${currentView !== 'whitelist' ? 'display:none' : ''}">
      <div class="lg-masthead">
        <div>
          <div class="lg-kicker mono">OPEN GOOGLE AUTHENTICATION ACTIVE</div>
          <h2 class="lg-h1 serif">Clearance &amp; Role Directory.</h2>
        </div>
        <button type="button" class="btn btn-primary btn-sm mono" onclick="openRoleModal()">
          <span>+ ASSIGN ROLE</span>
        </button>
      </div>

      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Email Identity</th>
              <th>Display Name</th>
              <th>Clearance Level</th>
              <th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody id="whitelist-body">
            <tr><td colspan="4" class="mono" style="color:var(--ink-3)">LOADING DIRECTORY...</td></tr>
          </tbody>
        </table>
      </div>
    </section>`
        : ''
    }
  </main>

  <!-- Mobile Bottom Navigation -->
  <nav class="lg-mob-nav" aria-label="Mobile navigation">
    <button type="button" class="lg-mob-btn ${currentView === 'tokens' ? 'active' : ''}" onclick="switchView('tokens')">LEDGER</button>
    ${
      isAdmin
        ? `<button type="button" class="lg-mob-btn ${currentView === 'access' ? 'active' : ''}" onclick="switchView('access')">AUDIT</button>
           <button type="button" class="lg-mob-btn ${currentView === 'whitelist' ? 'active' : ''}" onclick="switchView('whitelist')">ROLES</button>`
        : ''
    }
  </nav>
</div>

<!-- Slide-Over Key Dossier Drawer -->
<div id="dossier-backdrop" class="dr-backdrop" onclick="closeDossier()"></div>
<aside id="dossier-drawer" class="dr-panel" role="dialog" aria-modal="true" aria-labelledby="dr-title">
  <div class="dr-head">
    <div class="mono" style="font-size:0.72rem;font-weight:600;letter-spacing:0.06em" id="dr-num">RECORD 01</div>
    <button type="button" class="btn btn-secondary btn-sm mono" onclick="closeDossier()">CLOSE [ESC]</button>
  </div>

  <div class="dr-body">
    <div>
      <div class="mono" style="font-size:0.72rem;color:var(--ink-3);text-transform:uppercase" id="dr-issuer">SERVICE</div>
      <h2 class="serif" style="font-size:2rem;line-height:1.05;margin-top:0.2rem;word-break:break-word" id="dr-title">Account</h2>
      <div style="display:flex;gap:0.4rem;margin-top:0.625rem">
        <span class="stamp" id="dr-scope">PERSONAL</span>
        <span class="stamp" id="dr-spec">SHA1 · 6 DIGITS · 30S</span>
      </div>
    </div>

    <div class="dr-readout-box">
      <div class="mono" style="font-size:0.68rem;color:var(--ink-3);letter-spacing:0.06em">LIVE VERIFICATION CODE</div>
      <div class="dr-big-code mono blur-morph" id="dr-code">------</div>
      <button type="button" class="btn btn-primary mono" style="width:100%" onclick="copyDossierCode()">
        <span id="dr-copy-lbl">COPY PASSCODE</span>
      </button>
    </div>

    <!-- Inline Collaborator Sharing (Owner Only) -->
    <div id="dr-share-section" style="border-top:1px solid var(--rule);padding-top:1.25rem">
      <div class="field-label">DELEGATE COLLABORATOR ACCESS</div>
      <form onsubmit="submitShare(event)" style="display:flex;flex-direction:column;gap:0.625rem;margin-bottom:1rem">
        <input type="hidden" id="sf-profile-id" value="">
        <label for="sf-email" class="sr-only">Collaborator Email</label>
        <input id="sf-email" type="email" class="input mono" required placeholder="collaborator@organization.com">
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8125rem;color:var(--ink-2)">
          <input id="sf-can-edit" type="checkbox">
          <span>Grant metadata edit clearance</span>
        </label>
        <button type="submit" class="btn btn-secondary btn-sm mono">GRANT CLEARANCE</button>
      </form>
      <div class="field-label">ACTIVE COLLABORATORS</div>
      <div id="sf-list" class="mono" style="display:flex;flex-direction:column;gap:0.4rem;font-size:0.78rem;color:var(--ink-3)"></div>
    </div>

    <!-- Record Maintenance & Hold-to-Delete -->
    <div style="margin-top:auto;border-top:1px solid var(--rule);padding-top:1.25rem;display:flex;flex-direction:column;gap:0.625rem">
      <button type="button" class="btn btn-secondary mono" id="dr-edit-btn" onclick="editDossierRecord()" style="width:100%">
        EDIT RECORD METADATA
      </button>

      <button type="button" class="hold-del-btn" id="dr-hold-del"
              onpointerdown="startHoldDelete(event)"
              onpointerup="cancelHoldDelete()"
              onpointerleave="cancelHoldDelete()"
              onpointercancel="cancelHoldDelete()"
              onkeydown="if(event.key==='Enter'||event.key===' '){startHoldDelete(event)}"
              onkeyup="cancelHoldDelete()">
        <span>HOLD 1.2S TO PURGE RECORD</span>
        <span class="hold-del-overlay" aria-hidden="true">PURGING RECORD...</span>
      </button>
    </div>
  </div>
</aside>

<!-- Add / Edit Token Modal -->
<div id="token-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="token-modal-title">
  <div class="modal-panel">
    <div class="modal-header">
      <h2 id="token-modal-title" class="modal-title">Initialize Key Record.</h2>
      <button type="button" class="btn btn-secondary btn-sm mono" onclick="closeModal('token-modal')" aria-label="Close dialog">ESC</button>
    </div>
    <form id="token-form" onsubmit="submitTokenForm(event)">
      <input type="hidden" id="tf-id" value="">
      <div style="display:flex;flex-direction:column;gap:0.875rem">
        <div>
          <label for="tf-uri" class="field-label">Quick Parse otpauth:// URI (Optional)</label>
          <input id="tf-uri" type="text" class="input mono" placeholder="otpauth://totp/..." oninput="parseOtpAuthUri(this.value)">
        </div>
        <div>
          <label for="tf-name" class="field-label">Account Identifier *</label>
          <input id="tf-name" type="text" class="input" required placeholder="e.g. ops-custody@organization.ch">
        </div>
        <div>
          <label for="tf-issuer" class="field-label">Service / Authority</label>
          <input id="tf-issuer" type="text" class="input" placeholder="e.g. Cloudflare, GitHub, AWS">
        </div>
        <div>
          <label for="tf-secret" class="field-label">Base32 Cryptographic Seed *</label>
          <div style="display:flex;gap:0.5rem">
            <input id="tf-secret" type="text" class="input mono" placeholder="JBSWY3DPEHPK3PXP">
            <button type="button" class="btn btn-secondary btn-sm mono" onclick="genRandomSecret()">GENERATE</button>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0.5rem">
          <div>
            <label for="tf-algo" class="field-label">HMAC</label>
            <select id="tf-algo" class="select mono">
              <option value="SHA1">SHA1</option>
              <option value="SHA256">SHA256</option>
              <option value="SHA512">SHA512</option>
            </select>
          </div>
          <div>
            <label for="tf-digits" class="field-label">Digits</label>
            <select id="tf-digits" class="select mono">
              <option value="6">6</option>
              <option value="8">8</option>
            </select>
          </div>
          <div>
            <label for="tf-period" class="field-label">Window (s)</label>
            <input id="tf-period" type="number" class="input mono" value="30" min="10" max="120">
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8125rem;color:var(--ink-2)">
          <input id="tf-hide" type="checkbox">
          <span>Redact passcode on ledger until copied</span>
        </label>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary mono" onclick="closeModal('token-modal')">CANCEL</button>
        <button type="submit" class="btn btn-primary mono">COMMIT RECORD</button>
      </div>
    </form>
  </div>
</div>

<!-- Import Modal -->
<div id="import-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
  <div class="modal-panel">
    <div class="modal-header">
      <h2 id="import-modal-title" class="modal-title">Batch URI Ingestion.</h2>
      <button type="button" class="btn btn-secondary btn-sm mono" onclick="closeModal('import-modal')" aria-label="Close dialog">ESC</button>
    </div>
    <form onsubmit="submitBatchImport(event)">
      <label for="imp-text" class="field-label">Paste otpauth:// or otpauth-migration:// URIs (One Per Line)</label>
      <textarea id="imp-text" class="textarea mono" rows="6" placeholder="otpauth://totp/GitHub:user@example.com?secret=...&#10;otpauth-migration://offline?data=..."></textarea>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary mono" onclick="closeModal('import-modal')">CANCEL</button>
        <button type="submit" class="btn btn-primary mono">INGEST RECORDS</button>
      </div>
    </form>
  </div>
</div>

<!-- Assign Role Modal (Admin) -->
<div id="role-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="role-modal-title">
  <div class="modal-panel">
    <div class="modal-header">
      <h2 id="role-modal-title" class="modal-title">Assign Clearance Role.</h2>
      <button type="button" class="btn btn-secondary btn-sm mono" onclick="closeModal('role-modal')" aria-label="Close dialog">ESC</button>
    </div>
    <form onsubmit="submitRole(event)" style="display:flex;flex-direction:column;gap:0.875rem">
      <div>
        <label for="rf-email" class="field-label">Email Identity *</label>
        <input id="rf-email" type="email" class="input mono" required placeholder="user@organization.com">
      </div>
      <div>
        <label for="rf-name" class="field-label">Custodian Name</label>
        <input id="rf-name" type="text" class="input" placeholder="Optional">
      </div>
      <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8125rem;color:var(--ink-2)">
        <input id="rf-admin" type="checkbox">
        <span>Grant Administrator clearance</span>
      </label>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary mono" onclick="closeModal('role-modal')">CANCEL</button>
        <button type="submit" class="btn btn-primary mono">COMMIT ROLE</button>
      </div>
    </form>
  </div>
</div>

<script>
const CSRF = ${JSON.stringify(csrfToken)};
const IS_ADMIN = ${JSON.stringify(isAdmin)};
const CURRENT_EMAIL = ${JSON.stringify(user.email.toLowerCase())};
let activeView = ${JSON.stringify(currentView)};
let currentFilter = 'all';
let dossierId = 0;
let tickerPaused = false;
let holdTimer = null;

function formatCode(code) {
  if (!code) return '------';
  if (code.length === 6) return code.slice(0, 3) + ' ' + code.slice(3);
  if (code.length === 8) return code.slice(0, 4) + ' ' + code.slice(4);
  return code;
}

// Instant keyboard shortcut '/' to focus search (zero animation per emil-design-eng)
document.addEventListener('keydown', function (e) {
  if (e.key === '/' && document.activeElement && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    e.preventDefault();
    var s = document.getElementById('search-input');
    if (s) s.focus();
  }
  if (e.key === 'Escape') {
    closeDossier();
    document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(function (m) {
      if (m.id !== 'confirm-dialog') m.classList.add('hidden');
    });
  }
});

window.toggleLiveTicker = function () {
  tickerPaused = !tickerPaused;
  var btn = document.getElementById('ticker-pause-btn');
  var lbl = document.getElementById('ticker-pause-lbl');
  if (btn) btn.setAttribute('aria-pressed', tickerPaused ? 'true' : 'false');
  if (lbl) lbl.textContent = tickerPaused ? 'PAUSED' : 'ACTIVE';
};

window.openDossier = function (id) {
  dossierId = Number(id);
  var row = document.getElementById('card-' + dossierId);
  if (!row) return;

  document.querySelectorAll('.lg-row').forEach(function (r) {
    r.classList.toggle('is-active', Number(r.getAttribute('data-id')) === dossierId);
  });

  var isOwner = row.getAttribute('data-owner') === '1';
  var canEdit = row.getAttribute('data-can-edit') === '1';
  var hide = row.getAttribute('data-hide') === '1';
  var codeEl = document.getElementById('code-' + dossierId);
  var raw = codeEl ? (codeEl.getAttribute('data-raw-code') || '') : '';

  document.getElementById('dr-num').textContent = 'RECORD ' + (row.getAttribute('data-num') || '01');
  document.getElementById('dr-issuer').textContent = row.getAttribute('data-display-issuer') || 'SERVICE';
  document.getElementById('dr-title').textContent = row.getAttribute('data-display-name') || '';
  document.getElementById('dr-scope').textContent = isOwner ? 'PERSONAL CUSTODY' : 'SHARED CLEARANCE';
  document.getElementById('dr-spec').textContent =
    (row.getAttribute('data-algo') || 'SHA1') + ' · ' +
    (row.getAttribute('data-digits') || '6') + ' DIGITS · ' +
    (row.getAttribute('data-period') || '30') + 'S';
  document.getElementById('dr-code').textContent = hide ? '••• •••' : formatCode(raw);

  document.getElementById('sf-profile-id').value = String(dossierId);
  document.getElementById('dr-share-section').style.display = isOwner ? '' : 'none';
  document.getElementById('dr-edit-btn').style.display = canEdit ? '' : 'none';
  document.getElementById('dr-hold-del').style.display = isOwner ? '' : 'none';

  if (isOwner) loadShareList(dossierId);

  document.getElementById('dossier-backdrop').classList.add('is-open');
  document.getElementById('dossier-drawer').classList.add('is-open');
};

window.closeDossier = function () {
  cancelHoldDelete();
  var b = document.getElementById('dossier-backdrop');
  var d = document.getElementById('dossier-drawer');
  if (b) b.classList.remove('is-open');
  if (d) d.classList.remove('is-open');
  document.querySelectorAll('.lg-row.is-active').forEach(function (r) { r.classList.remove('is-active'); });
};

window.copyDossierCode = function () {
  if (dossierId) window.copyCode(dossierId);
};

window.editDossierRecord = function () {
  if (dossierId) window.openEditModal(dossierId);
};

// Hold-to-Delete interaction (1.1s clip-path fill)
window.startHoldDelete = function (e) {
  if (e && e.button && e.button !== 0) return;
  var btn = document.getElementById('dr-hold-del');
  if (!btn || !dossierId) return;
  cancelHoldDelete();
  btn.classList.add('is-holding');
  holdTimer = setTimeout(function () {
    btn.classList.remove('is-holding');
    fetch('/api/profiles/' + dossierId, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
      body: JSON.stringify({}),
    }).then(function () { window.location.reload(); });
  }, 1100);
};

window.cancelHoldDelete = function () {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  var btn = document.getElementById('dr-hold-del');
  if (btn) btn.classList.remove('is-holding');
};

// Blur-Crossfade Copy Feedback (emil-design-eng)
window.copyCode = function (id) {
  var codeEl = document.getElementById('code-' + id);
  if (!codeEl) return;
  var raw = codeEl.getAttribute('data-raw-code') || '';
  if (!raw) return;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(raw).catch(function () {});
  }

  codeEl.classList.add('is-morphing');
  setTimeout(function () {
    codeEl.textContent = formatCode(raw);
    codeEl.classList.remove('is-morphing');
  }, 130);

  var lbl = document.getElementById('copy-lbl-' + id);
  if (lbl) {
    lbl.textContent = 'COPIED';
    setTimeout(function () { lbl.textContent = 'COPY'; }, 1400);
  }

  if (Number(id) === dossierId) {
    var drCode = document.getElementById('dr-code');
    var drLbl = document.getElementById('dr-copy-lbl');
    if (drCode) {
      drCode.classList.add('is-morphing');
      setTimeout(function () {
        drCode.textContent = formatCode(raw);
        drCode.classList.remove('is-morphing');
      }, 130);
    }
    if (drLbl) {
      drLbl.textContent = 'COPIED TO CLIPBOARD';
      setTimeout(function () { drLbl.textContent = 'COPY PASSCODE'; }, 1400);
    }
  }

  window.showToast('COPIED PASSCODE ' + formatCode(raw), 'success');
};

window.switchView = function (view) {
  activeView = view;
  closeDossier();
  ['tokens', 'access', 'whitelist'].forEach(function (v) {
    var sec = document.getElementById('view-' + v);
    if (sec) sec.style.display = v === view ? '' : 'none';
  });
  document.querySelectorAll('.lg-sb-section .lg-sb-btn:not(.lg-scope-link), .lg-mob-btn').forEach(function (btn) {
    var txt = btn.getAttribute('onclick') || '';
    btn.classList.toggle('active', txt.indexOf("'" + view + "'") !== -1);
  });
  if (view === 'access' && IS_ADMIN) loadAccessView();
  if (view === 'whitelist' && IS_ADMIN) loadRolesView();
};

window.setFilterFromSidebar = function (filter) {
  if (activeView !== 'tokens') switchView('tokens');
  currentFilter = filter;
  document.querySelectorAll('.lg-scope-link').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-scope') === filter);
  });
  document.querySelectorAll('.lg-filter-btn').forEach(function (b) {
    var txt = b.getAttribute('onclick') || '';
    b.classList.toggle('active', txt.indexOf("'" + filter + "'") !== -1);
  });
  applyFilters();
};

window.setFilter = function (filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.lg-filter-btn').forEach(function (b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.lg-scope-link').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-scope') === filter);
  });
  applyFilters();
};

window.applyFilters = function () {
  var q = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
  document.querySelectorAll('.lg-row').forEach(function (el) {
    var owner = el.getAttribute('data-owner') === '1';
    var name = el.getAttribute('data-name') || '';
    var issuer = el.getAttribute('data-issuer') || '';
    var matchFilter = currentFilter === 'all' || (currentFilter === 'mine' && owner) || (currentFilter === 'shared' && !owner);
    var matchSearch = !q || name.indexOf(q) !== -1 || issuer.indexOf(q) !== -1;
    el.style.display = matchFilter && matchSearch ? '' : 'none';
  });
};

function refreshProfileOtp(id) {
  fetch('/api/otp/' + id)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data || !data.code) return;
      var el = document.getElementById('code-' + id);
      if (!el) return;
      el.classList.add('is-morphing');
      setTimeout(function () {
        el.setAttribute('data-raw-code', data.code);
        el.textContent = el.getAttribute('data-hidden') === '1' ? '••• •••' : formatCode(data.code);
        el.classList.remove('is-morphing');
      }, 130);

      if (Number(id) === dossierId) {
        var drCode = document.getElementById('dr-code');
        if (drCode) drCode.textContent = formatCode(data.code);
      }
    })
    .catch(function () {});
}

// Live 1-second TOTP countdown
(function () {
  var lastStepMap = {};
  setInterval(function () {
    if (tickerPaused) return;
    var now = Math.floor(Date.now() / 1000);
    document.querySelectorAll('.lg-row').forEach(function (row) {
      var id = Number(row.getAttribute('data-id'));
      var period = Number(row.getAttribute('data-period') || 30);
      var rem = period - (now % period);
      var step = Math.floor(now / period);

      if (lastStepMap[id] !== undefined && lastStepMap[id] !== step) {
        refreshProfileOtp(id);
      }
      lastStepMap[id] = step;

      var timerEl = document.getElementById('timer-' + id);
      var barEl = document.getElementById('bar-' + id);
      if (timerEl) {
        timerEl.textContent = rem + 'S';
        timerEl.classList.toggle('is-low', rem <= 5);
      }
      if (barEl) {
        barEl.style.width = ((rem / period) * 100).toFixed(1) + '%';
        barEl.classList.toggle('is-low', rem <= 5);
      }
    });
  }, 1000);
})();

// ── Modals ──
window.openModal = function (id) {
  var m = document.getElementById(id);
  if (m) m.classList.remove('hidden');
};
window.closeModal = function (id) {
  var m = document.getElementById(id);
  if (m) m.classList.add('hidden');
};
document.querySelectorAll('.modal-backdrop').forEach(function (m) {
  if (m.id === 'confirm-dialog') return;
  m.addEventListener('click', function (e) {
    if (e.target === m) m.classList.add('hidden');
  });
});

window.openAddModal = function () {
  document.getElementById('token-modal-title').textContent = 'Initialize Key Record.';
  document.getElementById('tf-id').value = '';
  document.getElementById('tf-uri').value = '';
  document.getElementById('tf-name').value = '';
  document.getElementById('tf-issuer').value = '';
  document.getElementById('tf-secret').value = '';
  document.getElementById('tf-secret').required = true;
  document.getElementById('tf-algo').value = 'SHA1';
  document.getElementById('tf-digits').value = '6';
  document.getElementById('tf-period').value = '30';
  document.getElementById('tf-hide').checked = false;
  openModal('token-modal');
};

window.openEditModal = function (id) {
  fetch('/api/profiles/' + id)
    .then(function (r) { return r.json(); })
    .then(function (p) {
      document.getElementById('token-modal-title').textContent = 'Modify Key Record.';
      document.getElementById('tf-id').value = p.id;
      document.getElementById('tf-uri').value = '';
      document.getElementById('tf-name').value = p.name || '';
      document.getElementById('tf-issuer').value = p.issuer || '';
      document.getElementById('tf-secret').value = '';
      document.getElementById('tf-secret').required = false;
      document.getElementById('tf-algo').value = p.algorithm || 'SHA1';
      document.getElementById('tf-digits').value = String(p.digits || 6);
      document.getElementById('tf-period').value = String(p.period || 30);
      document.getElementById('tf-hide').checked = Boolean(p.hide_code);
      openModal('token-modal');
    });
};

window.parseOtpAuthUri = function (val) {
  if (!val || !val.startsWith('otpauth://')) return;
  try {
    var u = new URL(val);
    var label = decodeURIComponent(u.pathname.replace(/^\\/totp\\//i, '').replace(/^\\//, ''));
    var issuer = u.searchParams.get('issuer') || '';
    var name = label;
    if (label.indexOf(':') !== -1) {
      var parts = label.split(':');
      if (!issuer) issuer = parts[0].trim();
      name = parts.slice(1).join(':').trim();
    }
    if (name) document.getElementById('tf-name').value = name;
    if (issuer) document.getElementById('tf-issuer').value = issuer;
    if (u.searchParams.get('secret')) document.getElementById('tf-secret').value = u.searchParams.get('secret');
    if (u.searchParams.get('algorithm')) document.getElementById('tf-algo').value = u.searchParams.get('algorithm').toUpperCase();
    if (u.searchParams.get('digits')) document.getElementById('tf-digits').value = u.searchParams.get('digits');
    if (u.searchParams.get('period')) document.getElementById('tf-period').value = u.searchParams.get('period');
  } catch (e) {}
};

window.genRandomSecret = function () {
  fetch('/api/generate-secret')
    .then(function (r) { return r.json(); })
    .then(function (d) { if (d.secret) document.getElementById('tf-secret').value = d.secret; });
};

window.submitTokenForm = function (e) {
  e.preventDefault();
  var id = document.getElementById('tf-id').value;
  var payload = {
    name: document.getElementById('tf-name').value.trim(),
    issuer: document.getElementById('tf-issuer').value.trim(),
    algorithm: document.getElementById('tf-algo').value,
    digits: Number(document.getElementById('tf-digits').value),
    period: Number(document.getElementById('tf-period').value),
    hide_code: document.getElementById('tf-hide').checked ? 1 : 0,
  };
  var sec = document.getElementById('tf-secret').value.trim();
  if (sec) payload.secret = sec;

  fetch(id ? '/api/profiles/' + id : '/api/profiles', {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify(payload),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { window.showToast(d.error, 'error'); return; }
      window.location.reload();
    });
};

function loadShareList(profileId) {
  var list = document.getElementById('sf-list');
  list.textContent = 'LOADING...';
  fetch('/api/profiles/' + profileId + '/shares')
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      if (!rows.length) { list.textContent = 'NO COLLABORATORS DELEGATED.'; return; }
      list.innerHTML = '';
      rows.forEach(function (s) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.5rem 0.625rem;background:var(--surface-sub);border:1px solid var(--rule)';
        var info = document.createElement('span');
        info.textContent = s.shared_with_email + (s.can_edit ? ' [EDIT]' : ' [READ]');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-danger btn-sm mono';
        btn.textContent = 'REVOKE';
        btn.onclick = function () {
          fetch('/api/profiles/' + profileId + '/shares', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
            body: JSON.stringify({ email: s.shared_with_email }),
          }).then(function () { loadShareList(profileId); });
        };
        row.appendChild(info);
        row.appendChild(btn);
        list.appendChild(row);
      });
    });
}

window.submitShare = function (e) {
  e.preventDefault();
  var pid = document.getElementById('sf-profile-id').value;
  fetch('/api/profiles/' + pid + '/shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify({
      email: document.getElementById('sf-email').value.trim(),
      can_edit: document.getElementById('sf-can-edit').checked,
    }),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { window.showToast(d.error, 'error'); return; }
      document.getElementById('sf-email').value = '';
      loadShareList(pid);
      window.showToast('CLEARANCE GRANTED', 'success');
    });
};

window.openImportModal = function () { openModal('import-modal'); };
window.submitBatchImport = async function (e) {
  e.preventDefault();
  var lines = (document.getElementById('imp-text').value || '').split(/\\r?\\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  var profiles = [];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.toLowerCase().startsWith('otpauth-migration://')) {
      try {
        var mResp = await fetch('/api/parse-migration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
          body: JSON.stringify({ uri: line }),
        });
        var mData = await mResp.json();
        if (mData && Array.isArray(mData.profiles)) {
          profiles = profiles.concat(mData.profiles);
        }
      } catch (err) {}
    } else if (line.toLowerCase().startsWith('otpauth://')) {
      try {
        var u = new URL(line);
        var label = decodeURIComponent(u.pathname.replace(/^\\/totp\\//i, '').replace(/^\\//, ''));
        var issuer = u.searchParams.get('issuer') || '';
        var name = label;
        if (label.indexOf(':') !== -1) {
          var parts = label.split(':');
          if (!issuer) issuer = parts[0].trim();
          name = parts.slice(1).join(':').trim();
        }
        var secret = u.searchParams.get('secret') || '';
        if (name && secret) {
          profiles.push({
            name: name,
            issuer: issuer,
            secret: secret,
            algorithm: (u.searchParams.get('algorithm') || 'SHA1').toUpperCase(),
            digits: Number(u.searchParams.get('digits') || 6),
            period: Number(u.searchParams.get('period') || 30),
          });
        }
      } catch (err) {}
    }
  }

  if (!profiles.length) { window.showToast('NO VALID OTPAUTH OR MIGRATION URIS FOUND', 'error'); return; }
  fetch('/api/profiles/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify({ profiles: profiles }),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { window.showToast(d.error, 'error'); return; }
      window.location.reload();
    });
};

// ── Admin Views ──
function loadAccessView() {
  fetch('/api/access/metrics')
    .then(function (r) { return r.json(); })
    .then(function (m) {
      document.getElementById('m-tokens').textContent = m.total_tokens ?? 0;
      document.getElementById('m-shares').textContent = m.total_shares ?? 0;
      document.getElementById('m-collab').textContent = m.total_collaborators ?? 0;
      document.getElementById('m-users').textContent = m.total_users ?? 0;
    });
  fetch('/api/access/shares')
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      var tbody = document.getElementById('access-shares-body');
      tbody.innerHTML = '';
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="mono" style="color:var(--ink-3)">NO ACTIVE SHARES RECORDED.</td></tr>';
        return;
      }
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td><strong>' + escapeStr(r.profile_name) + '</strong></td>' +
          '<td class="mono">' + escapeStr(r.owner_email) + '</td>' +
          '<td class="mono">' + escapeStr(r.shared_with_email) + '</td>' +
          '<td><span class="stamp">' + (r.can_edit ? 'EDIT' : 'READ-ONLY') + '</span></td>' +
          '<td style="text-align:right"></td>';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-danger btn-sm mono';
        btn.textContent = 'REVOKE';
        btn.onclick = function () {
          fetch('/api/access/bulk-revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
            body: JSON.stringify({ share_ids: [r.share_id] }),
          }).then(function () { loadAccessView(); });
        };
        tr.lastElementChild.appendChild(btn);
        tbody.appendChild(tr);
      });
    });
}

function loadRolesView() {
  fetch('/api/whitelist')
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      var tbody = document.getElementById('whitelist-body');
      tbody.innerHTML = '';
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="mono" style="color:var(--ink-3)">NO ROLES CONFIGURED.</td></tr>';
        return;
      }
      rows.forEach(function (u) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td class="mono">' + escapeStr(u.email) + '</td>' +
          '<td>' + escapeStr(u.name || '-') + '</td>' +
          '<td><span class="stamp ' + (u.is_admin ? 'stamp-accent' : '') + '">' + (u.is_admin ? 'ADMINISTRATOR' : escapeStr(u.role_label || 'MEMBER')) + '</span></td>' +
          '<td style="text-align:right"></td>';
        if (String(u.email).toLowerCase() !== CURRENT_EMAIL) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-danger btn-sm mono';
          btn.textContent = 'REMOVE';
          btn.onclick = function () {
            fetch('/api/whitelist/' + u.id, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
              body: JSON.stringify({}),
            }).then(function () { loadRolesView(); });
          };
          tr.lastElementChild.appendChild(btn);
        }
        tbody.appendChild(tr);
      });
    });
}

window.openRoleModal = function () {
  document.getElementById('rf-email').value = '';
  document.getElementById('rf-name').value = '';
  document.getElementById('rf-admin').checked = false;
  openModal('role-modal');
};

window.submitRole = function (e) {
  e.preventDefault();
  fetch('/api/whitelist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify({
      email: document.getElementById('rf-email').value.trim(),
      name: document.getElementById('rf-name').value.trim(),
      is_admin: document.getElementById('rf-admin').checked ? 1 : 0,
    }),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { window.showToast(d.error, 'error'); return; }
      closeModal('role-modal');
      loadRolesView();
      window.showToast('ROLE COMMITTED', 'success');
    });
};

function escapeStr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (activeView === 'access' && IS_ADMIN) loadAccessView();
if (activeView === 'whitelist' && IS_ADMIN) loadRolesView();
</script>
</body>
</html>`
  );
}
