import { OtpProfile, User } from '../types';
import { escapeAttr, escapeHtml, formatOtpCode } from '../lib/html';
import { renderBrandMark, renderLayout } from './layout';

function renderUserAvatar(name: string | null | undefined, email: string, avatarUrl: string | null | undefined, size = 34): string {
  if (avatarUrl) {
    return `<img src="${escapeAttr(avatarUrl)}" alt="${escapeAttr(name || email)}" width="${size}" height="${size}" referrerpolicy="no-referrer" style="width:${size}px;height:${size}px;object-fit:cover;border:1px solid var(--rule);border-radius:var(--r-sharp);flex-shrink:0;display:block">`;
  }
  const source = (name || email || 'K').trim();
  const initials = source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || 'K';
  return `<span class="mono" aria-hidden="true" style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;background:var(--surface);border:1px solid var(--rule);border-radius:var(--r-sharp);font-size:${Math.round(size * 0.36)}px;font-weight:700;color:var(--ink-2);flex-shrink:0">${escapeHtml(initials)}</span>`;
}

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
      const canShare = Boolean(p.can_share);
      const isPinned = Boolean(p.is_pinned);
      const hideCode = Boolean(p.hide_code);
      const sharedSource = !isOwner
        ? p.shared_via_group
          ? `VIA GROUP: ${p.shared_via_group}`
          : p.owner_email
            ? `FROM: ${p.owner_email}`
            : 'SHARED'
        : '';
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
               data-can-share="${canShare ? '1' : '0'}"
               data-pinned="${isPinned ? '1' : '0'}"
               data-hide="${hideCode ? '1' : '0'}"
               data-name="${escapeHtml((p.name || '').toLowerCase())}"
               data-issuer="${escapeHtml((p.issuer || '').toLowerCase())}"
               data-display-name="${name}"
               data-display-issuer="${issuer}">
        <div class="lg-cell-num serif">${num}</div>

        <div class="lg-cell-ident">
          <div class="lg-issuer mono" style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">
            <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${issuer}${sharedSource ? ` · <span style="color:var(--accent)">${escapeHtml(sharedSource)}</span>` : ''}</span>
            <button type="button" onclick="togglePin(${id})" aria-label="${isPinned ? 'Unpin' : 'Pin'} ${name}" title="${isPinned ? 'Pinned to top' : 'Pin to top'}" style="border:none;background:transparent;padding:0 0.15rem;font-size:0.9rem;line-height:1;flex-shrink:0;color:${isPinned ? 'var(--accent)' : 'var(--ink-3)'}">${isPinned ? '★' : '☆'}</button>
          </div>
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
    groups: 'Custody Groups : KeyLedger',
    access: 'Delegation Audit : KeyLedger',
    whitelist: 'Custodian Directory : KeyLedger',
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
  pointer-events: none;
  transform: translateX(100%);
  transition: transform 260ms var(--ease-drawer);
}
.dr-panel.is-open {
  pointer-events: auto;
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
  #view-tokens:not([style*="display:none"]):not([style*="display: none"]),
  #view-groups:not([style*="display:none"]):not([style*="display: none"]),
  #view-access:not([style*="display:none"]):not([style*="display: none"]),
  #view-whitelist:not([style*="display:none"]):not([style*="display: none"]) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .lg-masthead {
    flex-shrink: 0;
    padding: 0.85rem 1rem;
    gap: 0.65rem;
    align-items: center;
    background: var(--surface);
  }
  .lg-kicker {
    font-size: 0.62rem;
    margin-bottom: 0.15rem;
  }
  .lg-h1 {
    font-size: 1.45rem;
  }
  .lg-masthead-actions {
    width: 100%;
    display: grid;
    grid-template-columns: auto auto 1fr;
    gap: 0.4rem;
  }
  .lg-masthead-actions .btn {
    justify-content: center;
    min-height: 36px;
    padding: 0 0.65rem;
    font-size: 0.68rem;
  }
  .lg-cmdbar {
    flex-shrink: 0;
    grid-template-columns: 1fr;
    background: var(--surface);
  }
  .lg-filter-group {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border-bottom: 1px solid var(--rule);
    background: var(--surface-sub);
  }
  .lg-filter-btn {
    padding: 0.6rem 0.35rem;
    font-size: 0.68rem;
    text-align: center;
    justify-content: center;
  }
  .lg-filter-btn:last-child { border-right: none; }
  .lg-search-cell { padding: 0 0.875rem; }
  .lg-search-input { height: 40px; font-size: 16px; }

  #token-grid,
  .lg-scroll-region {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 0.75rem;
    background: var(--bg);
  }

  .lg-mob-nav {
    flex-shrink: 0;
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
  .lg-mob-btn.active {
    background: var(--surface-sub);
    color: var(--accent);
    box-shadow: inset 0 2px 0 var(--accent);
  }

  /* ── 01 LEDGER: Swiss Pocket Passbook Cards ── */
  .lg-col-headers { display: none; }
  .lg-row {
    grid-template-columns: 42px 1fr auto;
    margin-bottom: 0.75rem;
    border: 1px solid var(--rule);
    border-left: 3px solid var(--rule-strong);
    border-radius: var(--r-sharp);
    background: var(--surface);
    box-shadow: 0 2px 6px rgba(18, 18, 16, 0.05);
    overflow: hidden;
  }
  .lg-row[data-owner="0"] {
    border-left-color: var(--accent);
  }
  .lg-row:last-child { margin-bottom: 0; }
  .lg-cell-num {
    grid-row: 1;
    grid-column: 1;
    font-size: 1.1rem;
    background: var(--surface-sub);
    border-right: 1px solid var(--rule);
  }
  .lg-cell-ident {
    grid-row: 1;
    grid-column: 2;
    padding: 0.65rem 0.75rem;
    border-right: none;
    min-width: 0;
  }
  .lg-issuer { font-size: 0.62rem; margin-bottom: 0.1rem; }
  .lg-account { font-size: 0.925rem; }
  .lg-cell-meta { display: none; }
  .lg-cell-actions {
    grid-row: 1;
    grid-column: 3;
    padding: 0 0.625rem;
    border-left: 1px solid var(--rule);
    background: var(--surface);
  }
  .lg-cell-code {
    grid-row: 2;
    grid-column: 1 / -1;
    border-right: none;
    border-top: 1px solid var(--rule);
    background: var(--surface-sub);
    padding: 0.25rem 0.875rem 0.35rem;
  }
  .lg-copy-trigger {
    flex: 1;
    padding: 0.45rem 0;
    justify-content: space-between;
    padding-right: 0.75rem;
  }
  .lg-digits { font-size: 1.5rem; letter-spacing: 0.1em; }

  /* ── 02 AUDIT & 03 ROLES: Compact Telemetry & Mobile Archival Cards ── */
  .metrics-grid {
    flex-shrink: 0;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    background: var(--surface);
  }
  .metric-cell {
    padding: 0.6rem 0.35rem;
    text-align: center;
  }
  .metric-num { font-size: 1.35rem; }
  .metric-cap {
    font-size: 0.56rem;
    letter-spacing: 0.03em;
    margin-top: 0.2rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .data-table,
  .data-table tbody {
    display: block;
    width: 100%;
  }
  .data-table thead { display: none; }
  .data-table tr {
    display: block;
    background: var(--surface);
    border: 1px solid var(--rule);
    border-left: 3px solid var(--rule-strong);
    border-radius: var(--r-sharp);
    margin-bottom: 0.75rem;
    box-shadow: 0 2px 6px rgba(18, 18, 16, 0.05);
    overflow: hidden;
  }
  .data-table tr:last-child { margin-bottom: 0; }
  .data-table td {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.875rem;
    border-bottom: 1px solid var(--rule);
    font-size: 0.8125rem;
    text-align: right;
    min-width: 0;
  }
  .data-table td:last-child {
    border-bottom: none;
    background: var(--surface-sub);
  }
  .data-table td::before {
    content: attr(data-label);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-3);
    text-align: left;
    flex-shrink: 0;
  }
  .data-table td > span,
  .data-table td > strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

@media (max-width: 640px) {
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
      <button type="button" class="lg-sb-btn ${currentView === 'groups' ? 'active' : ''}" onclick="switchView('groups')">
        <span><span style="color:var(--ink-3);margin-right:0.45rem">02</span>GROUPS</span>
      </button>
      ${
        isAdmin
          ? `<button type="button" class="lg-sb-btn ${currentView === 'access' ? 'active' : ''}" onclick="switchView('access')">
               <span><span style="color:var(--ink-3);margin-right:0.45rem">03</span>AUDIT</span>
             </button>
             <button type="button" class="lg-sb-btn ${currentView === 'whitelist' ? 'active' : ''}" onclick="switchView('whitelist')">
               <span><span style="color:var(--ink-3);margin-right:0.45rem">04</span>ROLES</span>
             </button>`
          : ''
      }
    </nav>

    <div class="lg-sb-footer">
      <div class="lg-sb-user">
        <div style="display:flex;align-items:center;gap:0.65rem">
          ${renderUserAvatar(user.name, user.email, user.avatar_url, 34)}
          <div style="min-width:0;flex:1">
            <div style="font-size:0.8125rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(user.name || 'Custodian')}</div>
            <div class="mono" style="font-size:0.68rem;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(user.email)}</div>
          </div>
        </div>
      </div>
      <div class="lg-sb-controls" style="grid-template-columns:1fr 1fr">
        <button type="button" class="lg-sb-ctrl" onclick="toggleTheme(event)" aria-label="Switch daylight or night ledger theme" style="border-right:1px solid var(--rule)">
          MODE: <span data-theme-label>DAY</span>
        </button>
        <button type="button" class="lg-sb-ctrl" onclick="openSessionsModal()" aria-label="Manage active sessions">
          SESSIONS
        </button>
      </div>
      <a href="/auth/logout" class="lg-sb-logout">SIGN OUT</a>
    </div>
  </aside>

  <!-- Mobile Top Bar -->
  <header class="lg-mob-topbar">
    <a href="/" style="display:inline-flex;align-items:center;gap:0.5rem;padding:0 0.875rem;font-weight:700">
      ${renderBrandMark(22)}
      <span class="mono" style="font-size:0.8125rem;letter-spacing:0.05em">KEY<span style="color:var(--accent)">LEDGER</span></span>
    </a>
    <div style="display:flex;align-items:stretch">
      <button type="button" onclick="openSessionsModal()" aria-label="Manage active sessions" style="display:inline-flex;align-items:center;padding:0 0.5rem;border:none;border-left:1px solid var(--rule);background:transparent">
        ${renderUserAvatar(user.name, user.email, user.avatar_url, 26)}
      </button>
      <button type="button" class="lg-sb-ctrl" onclick="toggleTheme(event)" style="border-left:1px solid var(--rule);border-right:1px solid var(--rule);padding:0 0.75rem">
        <span data-theme-label>DAY</span>
      </button>
      <a href="/auth/logout" class="lg-sb-logout" style="padding:0 0.75rem">OUT</a>
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

    <!-- ── VIEW 02: DYNAMIC CUSTODY GROUPS ── -->
    <section id="view-groups" style="${currentView !== 'groups' ? 'display:none' : ''}">
      <div class="lg-masthead">
        <div>
          <div class="lg-kicker mono">TEAM DELEGATION · DYNAMIC ACCESS</div>
          <h2 class="lg-h1 serif">Custody Groups.</h2>
        </div>
        <button type="button" class="btn btn-primary btn-sm mono" onclick="openGroupModal()">
          <span>+ NEW GROUP</span>
        </button>
      </div>

      <div id="groups-list" class="lg-scroll-region" style="padding:1rem;display:flex;flex-direction:column;gap:0.875rem">
        <div class="mono" style="font-size:0.78rem;color:var(--ink-3)">LOADING CUSTODY GROUPS...</div>
      </div>
    </section>

    ${
      isAdmin
        ? `
    <!-- ── VIEW 03: DELEGATION AUDIT (ADMIN) ── -->
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

      <div class="lg-cmdbar" style="grid-template-columns:1fr">
        <div class="lg-filter-group" style="grid-template-columns:repeat(4,1fr);overflow-x:auto" role="tablist" aria-label="Audit sections">
          <button type="button" class="lg-filter-btn active" data-audit-tab="direct" onclick="switchAuditTab('direct', this)">DIRECT SHARES</button>
          <button type="button" class="lg-filter-btn" data-audit-tab="groups" onclick="switchAuditTab('groups', this)">GROUP SHARES</button>
          <button type="button" class="lg-filter-btn" data-audit-tab="logs" onclick="switchAuditTab('logs', this)">ACTIVITY LOG</button>
          <button type="button" class="lg-filter-btn" data-audit-tab="matrix" onclick="switchAuditTab('matrix', this)">BULK MATRIX</button>
        </div>
      </div>

      <div id="audit-pane-direct" class="lg-scroll-region" style="overflow-x:auto">
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

      <div id="audit-pane-groups" class="lg-scroll-region" style="display:none;overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Key Record</th>
              <th>Custodian</th>
              <th>Target Group</th>
              <th>Clearance</th>
              <th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody id="access-group-shares-body">
            <tr><td colspan="5" class="mono" style="color:var(--ink-3)">LOADING GROUP DELEGATIONS...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="audit-pane-logs" class="lg-scroll-region" style="display:none;overflow-x:auto">
        <div style="padding:0.75rem;border-bottom:1px solid var(--rule);background:var(--surface);display:flex;gap:0.5rem">
          <input id="audit-log-search" type="search" class="input mono" placeholder="Search logs by actor, action, target..." oninput="loadAuditLogs()">
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody id="audit-logs-body">
            <tr><td colspan="5" class="mono" style="color:var(--ink-3)">LOADING ACTIVITY LOGS...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="audit-pane-matrix" class="lg-scroll-region" style="display:none;padding:1rem">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem">
          <div style="border:1px solid var(--rule);background:var(--surface);padding:1rem">
            <div class="field-label">1. SELECT TOKENS</div>
            <div id="bm-tokens" style="display:flex;flex-direction:column;gap:0.4rem;max-height:260px;overflow-y:auto;font-size:0.8125rem"></div>
          </div>
          <div style="border:1px solid var(--rule);background:var(--surface);padding:1rem">
            <div class="field-label">2. SELECT TARGET ACCOUNTS</div>
            <div id="bm-users" style="display:flex;flex-direction:column;gap:0.4rem;max-height:260px;overflow-y:auto;font-size:0.8125rem"></div>
          </div>
        </div>
        <div style="margin-top:1rem;display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;padding:0.875rem;border:1px solid var(--rule);background:var(--surface)">
          <label style="display:flex;align-items:center;gap:0.45rem;font-size:0.8125rem">
            <input id="bm-can-edit" type="checkbox">
            <span>Grant metadata edit clearance</span>
          </label>
          <div style="margin-left:auto;display:flex;gap:0.5rem">
            <button type="button" class="btn btn-primary btn-sm mono" onclick="submitBulkMatrix('grant')">GRANT SELECTED</button>
            <button type="button" class="btn btn-danger btn-sm mono" onclick="submitBulkMatrix('revoke')">REVOKE SELECTED</button>
          </div>
        </div>
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

      <div class="lg-scroll-region" style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Custodian</th>
              <th>Email Identity</th>
              <th>Status</th>
              <th>Clearance Level</th>
              <th style="text-align:right">Action</th>
            </tr>
          </thead>
          <tbody id="whitelist-body">
            <tr><td colspan="5" class="mono" style="color:var(--ink-3)">LOADING DIRECTORY...</td></tr>
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
    <button type="button" class="lg-mob-btn ${currentView === 'groups' ? 'active' : ''}" onclick="switchView('groups')">GROUPS</button>
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

    <!-- Inline Collaborator & Group Sharing (Owner Only) -->
    <div id="dr-share-section" style="border-top:1px solid var(--rule);padding-top:1.25rem">
      <div class="field-label">DELEGATE TO CUSTODY GROUP</div>
      <form onsubmit="submitGroupShare(event)" style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem">
        <div style="display:flex;gap:0.5rem">
          <select id="sf-group-id" class="select mono" style="flex:1">
            <option value="">Select a group...</option>
          </select>
          <button type="submit" class="btn btn-secondary btn-sm mono">SHARE GROUP</button>
        </div>
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.78rem;color:var(--ink-2)">
          <input id="sf-group-can-edit" type="checkbox">
          <span>Grant metadata edit clearance to group</span>
        </label>
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.78rem;color:var(--ink-2)">
          <input id="sf-group-can-share" type="checkbox">
          <span>Grant forward / group delegation clearance</span>
        </label>
      </form>
      <div id="sf-group-list" class="mono" style="display:flex;flex-direction:column;gap:0.4rem;font-size:0.78rem;color:var(--ink-3);margin-bottom:1.25rem"></div>

      <div class="field-label">DELEGATE COLLABORATOR ACCESS</div>
      <form onsubmit="submitShare(event)" style="display:flex;flex-direction:column;gap:0.625rem;margin-bottom:1rem">
        <input type="hidden" id="sf-profile-id" value="">
        <label for="sf-email" class="sr-only">Collaborator Email</label>
        <input id="sf-email" type="email" class="input mono" required placeholder="collaborator@organization.com">
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8125rem;color:var(--ink-2)">
          <input id="sf-can-edit" type="checkbox">
          <span>Grant metadata edit clearance</span>
        </label>
        <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8125rem;color:var(--ink-2)">
          <input id="sf-can-share" type="checkbox">
          <span>Grant forward / group delegation clearance</span>
        </label>
        <button type="submit" class="btn btn-secondary btn-sm mono">GRANT CLEARANCE</button>
      </form>
      <div class="field-label">ACTIVE COLLABORATORS</div>
      <div id="sf-list" class="mono" style="display:flex;flex-direction:column;gap:0.4rem;font-size:0.78rem;color:var(--ink-3)"></div>
    </div>

    <!-- Record Maintenance & Hold-to-Delete -->
    <div style="margin-top:auto;border-top:1px solid var(--rule);padding-top:1.25rem;display:flex;flex-direction:column;gap:0.625rem">
      <button type="button" class="btn btn-secondary mono" id="dr-qr-btn" onclick="toggleOwnerQr()" style="width:100%">
        REVEAL SETUP QR (OWNER ONLY)
      </button>
      <div id="dr-qr-box" style="display:none;padding:1rem;border:1px solid var(--rule);background:#FFFFFF;text-align:center">
        <canvas id="dr-qr-canvas" style="max-width:200px;width:100%;height:auto;margin:0 auto;display:block"></canvas>
        <div class="mono" style="font-size:0.65rem;color:#3D3B36;margin-top:0.5rem">SCAN WITH ANOTHER AUTHENTICATOR APP</div>
      </div>

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
          <label for="tf-uri" class="field-label">Quick Parse otpauth:// URI or Scan QR</label>
          <input id="tf-uri" type="text" class="input mono" placeholder="otpauth://totp/..." oninput="parseOtpAuthUri(this.value)">
          <div style="display:flex;gap:0.5rem;margin-top:0.5rem;flex-wrap:wrap">
            <button type="button" class="btn btn-secondary btn-sm mono" onclick="startQrCamera()">SCAN QR CAMERA</button>
            <label class="btn btn-secondary btn-sm mono" style="margin:0">
              <span>UPLOAD QR IMAGE</span>
              <input type="file" accept="image/*" style="display:none" onchange="scanQrFile(this)">
            </label>
          </div>
          <div id="qr-video-wrap" style="display:none;margin-top:0.625rem;border:1px solid var(--rule);background:#000;position:relative">
            <video id="qr-video" playsinline muted style="width:100%;max-height:220px;object-fit:cover;display:block"></video>
            <button type="button" class="btn btn-danger btn-sm mono" onclick="stopQrCamera()" style="position:absolute;top:0.4rem;right:0.4rem">STOP</button>
          </div>
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

<!-- Active Sessions Modal -->
<div id="sessions-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="sessions-modal-title">
  <div class="modal-panel" style="max-width:520px">
    <div class="modal-header">
      <h2 id="sessions-modal-title" class="modal-title">Active Device Sessions.</h2>
      <button type="button" class="btn btn-secondary btn-sm mono" onclick="closeModal('sessions-modal')" aria-label="Close dialog">ESC</button>
    </div>
    <div id="sessions-list" style="display:flex;flex-direction:column;gap:0.625rem;max-height:55dvh;overflow-y:auto">
      <div class="mono" style="font-size:0.75rem;color:var(--ink-3)">LOADING SESSIONS...</div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-danger btn-sm mono" onclick="revokeOtherSessions()">SIGN OUT OTHER DEVICES</button>
      <button type="button" class="btn btn-secondary mono" onclick="closeModal('sessions-modal')">CLOSE</button>
    </div>
  </div>
</div>

<!-- Create Custody Group Modal -->
<div id="group-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="group-modal-title">
  <div class="modal-panel">
    <div class="modal-header">
      <h2 id="group-modal-title" class="modal-title">Create Custody Group.</h2>
      <button type="button" class="btn btn-secondary btn-sm mono" onclick="closeModal('group-modal')" aria-label="Close dialog">ESC</button>
    </div>
    <form onsubmit="submitGroup(event)" style="display:flex;flex-direction:column;gap:0.875rem">
      <div>
        <label for="gf-name" class="field-label">Group Name *</label>
        <input id="gf-name" type="text" class="input" required placeholder="e.g. DevOps Team, Finance">
      </div>
      <div>
        <label for="gf-desc" class="field-label">Description</label>
        <input id="gf-desc" type="text" class="input" placeholder="Optional purpose">
      </div>
      <div>
        <label for="gf-members" class="field-label">Member Emails (comma or newline separated)</label>
        <textarea id="gf-members" class="textarea mono" rows="3" placeholder="alice@company.com, bob@company.com"></textarea>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary mono" onclick="closeModal('group-modal')">CANCEL</button>
        <button type="submit" class="btn btn-primary mono">CREATE GROUP</button>
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
  var canShare = row.getAttribute('data-can-share') === '1';
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
  document.getElementById('dr-share-section').style.display = (isOwner || canShare) ? '' : 'none';
  document.getElementById('dr-qr-btn').style.display = isOwner ? '' : 'none';
  document.getElementById('dr-qr-box').style.display = 'none';
  document.getElementById('dr-edit-btn').style.display = canEdit ? '' : 'none';
  document.getElementById('dr-hold-del').style.display = isOwner ? '' : 'none';

  if (isOwner || canShare) {
    loadShareList(dossierId);
    loadProfileGroupShares(dossierId);
    populateGroupSelect();
  }

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
  ['tokens', 'groups', 'access', 'whitelist'].forEach(function (v) {
    var sec = document.getElementById('view-' + v);
    if (sec) sec.style.display = v === view ? '' : 'none';
  });
  document.querySelectorAll('.lg-sb-section .lg-sb-btn:not(.lg-scope-link), .lg-mob-btn').forEach(function (btn) {
    var txt = btn.getAttribute('onclick') || '';
    btn.classList.toggle('active', txt.indexOf("'" + view + "'") !== -1);
  });
  if (view === 'groups') loadGroupsView();
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
  if (id === 'token-modal') stopQrCamera();
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
        info.textContent = s.shared_with_email + (s.can_edit ? ' [EDIT]' : ' [READ]') + (s.can_share ? ' [FWD]' : '');
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
      can_share: document.getElementById('sf-can-share').checked,
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
        tr.innerHTML = '<td data-label="KEY RECORD"><strong>' + escapeStr(r.profile_name) + '</strong></td>' +
          '<td data-label="CUSTODIAN" class="mono"><span>' + escapeStr(r.owner_email) + '</span></td>' +
          '<td data-label="DELEGATED TO" class="mono"><span>' + escapeStr(r.shared_with_email) + '</span></td>' +
          '<td data-label="CLEARANCE"><span class="stamp">' + (r.can_edit ? 'EDIT' : 'READ-ONLY') + '</span></td>' +
          '<td data-label="ACTION" style="text-align:right"></td>';
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

function avatarHtmlClient(name, email, avatarUrl, size) {
  var sz = size || 28;
  if (avatarUrl) {
    return '<img src="' + escapeStr(avatarUrl) + '" alt="' + escapeStr(name || email) + '" width="' + sz + '" height="' + sz + '" referrerpolicy="no-referrer" style="width:' + sz + 'px;height:' + sz + 'px;object-fit:cover;border:1px solid var(--rule);border-radius:var(--r-sharp);flex-shrink:0;display:block">';
  }
  var src = String(name || email || 'K').trim();
  var parts = src.split(/[\\s@._-]+/).filter(Boolean);
  var ini = parts.slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || 'K';
  return '<span class="mono" style="width:' + sz + 'px;height:' + sz + 'px;display:inline-flex;align-items:center;justify-content:center;background:var(--surface-sub);border:1px solid var(--rule);border-radius:var(--r-sharp);font-size:' + Math.round(sz * 0.38) + 'px;font-weight:700;color:var(--ink-2);flex-shrink:0">' + escapeStr(ini) + '</span>';
}

function populateGroupSelect() {
  var sel = document.getElementById('sf-group-id');
  if (!sel) return;
  fetch('/api/groups')
    .then(function (r) { return r.json(); })
    .then(function (groups) {
      sel.innerHTML = '<option value="">Select a group...</option>';
      (groups || []).forEach(function (g) {
        var opt = document.createElement('option');
        opt.value = String(g.id);
        opt.textContent = g.name + ' (' + (g.members ? g.members.length : 0) + ' members)';
        sel.appendChild(opt);
      });
    });
}

function loadProfileGroupShares(profileId) {
  var list = document.getElementById('sf-group-list');
  if (!list) return;
  list.textContent = '';
  fetch('/api/profiles/' + profileId + '/group-shares')
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      if (!rows || !rows.length) { list.textContent = 'NO GROUPS DELEGATED.'; return; }
      list.innerHTML = '';
      rows.forEach(function (gs) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.5rem;padding:0.5rem 0.625rem;background:var(--surface-sub);border:1px solid var(--rule)';
        var info = document.createElement('span');
        info.textContent = gs.group_name + ' (' + gs.member_count + ') ' + (gs.can_edit ? '[EDIT]' : '[READ]') + (gs.can_share ? ' [FWD]' : '');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-danger btn-sm mono';
        btn.textContent = 'REVOKE';
        btn.onclick = function () {
          fetch('/api/profiles/' + profileId + '/group-shares', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
            body: JSON.stringify({ group_id: gs.group_id }),
          }).then(function () { loadProfileGroupShares(profileId); });
        };
        row.appendChild(info);
        row.appendChild(btn);
        list.appendChild(row);
      });
    });
}

window.submitGroupShare = function (e) {
  e.preventDefault();
  var pid = document.getElementById('sf-profile-id').value;
  var gid = Number(document.getElementById('sf-group-id').value || 0);
  if (!gid) { window.showToast('SELECT A GROUP FIRST', 'error'); return; }
  fetch('/api/profiles/' + pid + '/group-shares', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify({
      group_id: gid,
      can_edit: document.getElementById('sf-group-can-edit').checked,
      can_share: document.getElementById('sf-group-can-share').checked,
    }),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { window.showToast(d.error, 'error'); return; }
      loadProfileGroupShares(pid);
      window.showToast('GROUP CLEARANCE GRANTED', 'success');
    });
};

window.openGroupModal = function () {
  document.getElementById('gf-name').value = '';
  document.getElementById('gf-desc').value = '';
  document.getElementById('gf-members').value = '';
  openModal('group-modal');
};

window.submitGroup = function (e) {
  e.preventDefault();
  fetch('/api/groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify({
      name: document.getElementById('gf-name').value.trim(),
      description: document.getElementById('gf-desc').value.trim(),
      members: document.getElementById('gf-members').value,
    }),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { window.showToast(d.error, 'error'); return; }
      closeModal('group-modal');
      loadGroupsView();
      window.showToast('CUSTODY GROUP CREATED', 'success');
    });
};

function loadGroupsView() {
  var container = document.getElementById('groups-list');
  if (!container) return;
  fetch('/api/groups')
    .then(function (r) { return r.json(); })
    .then(function (groups) {
      container.innerHTML = '';
      if (!groups || !groups.length) {
        container.innerHTML = '<div style="padding:3rem 1.5rem;text-align:center;border:1px solid var(--rule);background:var(--surface)"><div class="mono" style="font-size:0.72rem;color:var(--ink-3);margin-bottom:0.4rem">00 GROUPS</div><h3 class="serif" style="font-size:1.75rem;margin-bottom:0.5rem">No custody groups yet.</h3><p style="font-size:0.85rem;color:var(--ink-2);margin-bottom:1.25rem">Create a group to share TOTP records with multiple teammates at once.</p><button type="button" class="btn btn-primary btn-sm mono" onclick="openGroupModal()">+ NEW GROUP</button></div>';
        return;
      }
      groups.forEach(function (g) {
        var card = document.createElement('article');
        card.style.cssText = 'background:var(--surface);border:1px solid var(--rule);border-left:3px solid ' + (g.is_owner ? 'var(--rule-strong)' : 'var(--accent)') + ';border-radius:var(--r-sharp);padding:1rem';
        var membersHtml = (g.members || []).map(function (m) {
          var rmBtn = g.is_owner
            ? '<button type="button" class="mono" data-rm-group="' + g.id + '" data-rm-email="' + escapeStr(m.member_email) + '" style="border:none;background:transparent;color:var(--danger);font-weight:700;padding:0 0.25rem;font-size:0.75rem" aria-label="Remove ' + escapeStr(m.member_email) + '">×</button>'
            : '';
          return '<span class="stamp" style="display:inline-flex;align-items:center;gap:0.35rem">' + escapeStr(m.member_email) + rmBtn + '</span>';
        }).join('');
        if (!membersHtml) membersHtml = '<span class="mono" style="font-size:0.72rem;color:var(--ink-3)">NO MEMBERS ADDED</span>';

        var ownerActions = g.is_owner
          ? '<form onsubmit="addGroupMemberInline(event,' + g.id + ')" style="display:flex;gap:0.5rem;margin-top:0.875rem;flex-wrap:wrap">' +
              '<input type="text" class="input mono" id="gm-add-' + g.id + '" placeholder="Add email(s), comma separated" style="flex:1;min-width:200px;height:36px">' +
              '<button type="submit" class="btn btn-secondary btn-sm mono">ADD MEMBER</button>' +
              '<button type="button" class="btn btn-danger btn-sm mono" onclick="deleteGroupInline(' + g.id + ')">DELETE</button>' +
            '</form>'
          : '';

        card.innerHTML =
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;margin-bottom:0.5rem">' +
            '<div>' +
              '<div class="mono" style="font-size:0.65rem;color:var(--ink-3);letter-spacing:0.06em">' + (g.is_owner ? 'OWNER' : 'MEMBER · BY ' + escapeStr(g.owner_email)) + '</div>' +
              '<h3 class="serif" style="font-size:1.5rem;line-height:1.1">' + escapeStr(g.name) + '</h3>' +
              (g.description ? '<p style="font-size:0.8125rem;color:var(--ink-2);margin-top:0.2rem">' + escapeStr(g.description) + '</p>' : '') +
            '</div>' +
            '<span class="stamp">' + (g.members ? g.members.length : 0) + ' MEMBERS</span>' +
          '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;margin-top:0.625rem">' + membersHtml + '</div>' +
          ownerActions;

        card.querySelectorAll('[data-rm-group]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var gid = Number(btn.getAttribute('data-rm-group'));
            var em = btn.getAttribute('data-rm-email');
            fetch('/api/groups/' + gid + '/members', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
              body: JSON.stringify({ email: em }),
            }).then(function () { loadGroupsView(); });
          });
        });

        container.appendChild(card);
      });
    });
}

window.addGroupMemberInline = function (e, groupId) {
  e.preventDefault();
  var inp = document.getElementById('gm-add-' + groupId);
  var val = inp ? inp.value.trim() : '';
  if (!val) return;
  fetch('/api/groups/' + groupId + '/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify({ emails: val }),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { window.showToast(d.error, 'error'); return; }
      loadGroupsView();
      window.showToast('MEMBERS UPDATED', 'success');
    });
};

window.deleteGroupInline = function (groupId) {
  fetch('/api/groups/' + groupId, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify({}),
  }).then(function () {
    loadGroupsView();
    window.showToast('GROUP DELETED', 'success');
  });
};

function loadRolesView() {
  fetch('/api/whitelist')
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      var tbody = document.getElementById('whitelist-body');
      tbody.innerHTML = '';
      if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="mono" style="color:var(--ink-3)">NO ACCOUNTS FOUND.</td></tr>';
        return;
      }
      rows.forEach(function (u) {
        var tr = document.createElement('tr');
        var isSelf = String(u.email).toLowerCase() === CURRENT_EMAIL;
        var avatar = avatarHtmlClient(u.name, u.email, u.avatar_url, 28);
        var statusBadge = u.registered
          ? '<span class="stamp">REGISTERED</span>'
          : '<span class="stamp" style="opacity:0.7">INVITED</span>';
        tr.innerHTML =
          '<td data-label="CUSTODIAN"><div style="display:inline-flex;align-items:center;gap:0.55rem">' + avatar + '<span>' + escapeStr(u.name || '-') + '</span></div></td>' +
          '<td data-label="EMAIL IDENTITY" class="mono"><span>' + escapeStr(u.email) + '</span></td>' +
          '<td data-label="STATUS">' + statusBadge + '</td>' +
          '<td data-label="CLEARANCE"><span class="stamp ' + (u.is_admin ? 'stamp-accent' : '') + '">' + (u.is_admin ? 'ADMINISTRATOR' : escapeStr(u.role_label || 'MEMBER')) + '</span></td>' +
          '<td data-label="ACTION" style="text-align:right"><div style="display:inline-flex;gap:0.35rem;flex-wrap:wrap;justify-content:flex-end">' + (isSelf ? '<span class="mono" style="font-size:0.68rem;color:var(--ink-3)">ACTIVE SESSION</span>' : '') + '</div></td>';

        if (!isSelf) {
          var actionsWrap = tr.lastElementChild.firstElementChild;

          var roleBtn = document.createElement('button');
          roleBtn.type = 'button';
          roleBtn.className = 'btn btn-secondary btn-sm mono';
          roleBtn.textContent = u.is_admin ? 'DEMOTE' : 'MAKE ADMIN';
          roleBtn.onclick = function () {
            fetch('/api/admin/toggle-admin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
              body: JSON.stringify({ email: u.email, name: u.name || '', is_admin: u.is_admin ? 0 : 1 }),
            }).then(function () {
              loadRolesView();
              window.showToast('ROLE UPDATED', 'success');
            });
          };
          actionsWrap.appendChild(roleBtn);

          if (u.registered) {
            var loBtn = document.createElement('button');
            loBtn.type = 'button';
            loBtn.className = 'btn btn-secondary btn-sm mono';
            loBtn.textContent = 'LOGOUT';
            loBtn.onclick = function () {
              fetch('/api/admin/force-logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
                body: JSON.stringify({ email: u.email }),
              }).then(function (r) { return r.json(); }).then(function (d) {
                window.showToast('TERMINATED ' + (d.revoked || 0) + ' SESSION(S)', 'success');
              });
            };
            actionsWrap.appendChild(loBtn);
          }

          var offBtn = document.createElement('button');
          offBtn.type = 'button';
          offBtn.className = 'btn btn-danger btn-sm mono';
          offBtn.textContent = 'OFFBOARD';
          offBtn.onclick = function () {
            window.confirmAction({
              title: 'Offboard Custodian?',
              message: 'Revoke all direct shares, remove from all groups, delete role clearance, and terminate active sessions for ' + u.email + '?',
              confirmText: 'OFFBOARD USER',
              danger: true,
            }).then(function (ok) {
              if (!ok) return;
              fetch('/api/admin/offboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
                body: JSON.stringify({ email: u.email }),
              }).then(function () {
                loadRolesView();
                window.showToast('USER OFFBOARDED', 'success');
              });
            });
          };
          actionsWrap.appendChild(offBtn);
        }
        tbody.appendChild(tr);
      });
    });
}

// ── Pin / Favorite ──
window.togglePin = function (id) {
  fetch('/api/profiles/' + id + '/pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify({}),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { window.showToast(d.error, 'error'); return; }
      window.location.reload();
    });
};

// ── Lazy CDN Script Loader (Zero render-blocking) ──
function loadExternalScript(url, globalName) {
  return new Promise(function (resolve, reject) {
    if (window[globalName]) { resolve(window[globalName]); return; }
    var s = document.createElement('script');
    s.src = url;
    s.async = true;
    s.onload = function () { resolve(window[globalName]); };
    s.onerror = function () { reject(new Error('Failed to load ' + globalName)); };
    document.head.appendChild(s);
  });
}

// ── Owner Setup QR Reveal ──
window.toggleOwnerQr = async function () {
  var box = document.getElementById('dr-qr-box');
  if (!box || !dossierId) return;
  if (box.style.display !== 'none') {
    box.style.display = 'none';
    return;
  }
  try {
    var resp = await fetch('/api/profiles/' + dossierId + '/qr-uri');
    var data = await resp.json();
    if (!resp.ok || !data.uri) {
      window.showToast(data.error || 'Unable to reveal QR', 'error');
      return;
    }
    var QRCode = await loadExternalScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.4/build/qrcode.min.js', 'QRCode');
    box.style.display = 'block';
    await QRCode.toCanvas(document.getElementById('dr-qr-canvas'), data.uri, { width: 200, margin: 1 });
  } catch (err) {
    window.showToast('QR generator unavailable', 'error');
  }
};

// ── QR Scanner (Camera & File Upload) ──
var qrStream = null;
var qrScanRaf = null;

function handleScannedQrText(text) {
  var val = String(text || '').trim();
  if (!val) return false;
  if (val.toLowerCase().startsWith('otpauth-migration://')) {
    stopQrCamera();
    closeModal('token-modal');
    document.getElementById('imp-text').value = val;
    openModal('import-modal');
    window.showToast('GOOGLE AUTH EXPORT QR DETECTED', 'success');
    return true;
  }
  if (val.toLowerCase().startsWith('otpauth://')) {
    stopQrCamera();
    document.getElementById('tf-uri').value = val;
    parseOtpAuthUri(val);
    window.showToast('OTPAUTH QR PARSED', 'success');
    return true;
  }
  return false;
}

window.stopQrCamera = function () {
  if (qrScanRaf) { cancelAnimationFrame(qrScanRaf); qrScanRaf = null; }
  if (qrStream) {
    qrStream.getTracks().forEach(function (t) { t.stop(); });
    qrStream = null;
  }
  var wrap = document.getElementById('qr-video-wrap');
  if (wrap) wrap.style.display = 'none';
};

window.startQrCamera = async function () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    window.showToast('Camera unavailable in this browser. Use Upload QR Image.', 'error');
    return;
  }
  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    var video = document.getElementById('qr-video');
    var wrap = document.getElementById('qr-video-wrap');
    video.srcObject = qrStream;
    wrap.style.display = 'block';
    await video.play();

    var detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    var jsQR = detector ? null : await loadExternalScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', 'jsQR');
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    async function tick() {
      if (!qrStream) return;
      if (video.readyState >= 2) {
        try {
          if (detector) {
            var codes = await detector.detect(video);
            if (codes && codes.length && handleScannedQrText(codes[0].rawValue)) return;
          } else if (jsQR && video.videoWidth > 0) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var res = jsQR(imgData.data, imgData.width, imgData.height);
            if (res && handleScannedQrText(res.data)) return;
          }
        } catch (e) {}
      }
      qrScanRaf = requestAnimationFrame(tick);
    }
    tick();
  } catch (err) {
    window.showToast('Camera permission denied or unavailable', 'error');
  }
};

window.scanQrFile = async function (input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  try {
    var img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise(function (res, rej) { img.onload = res; img.onerror = rej; });
    var canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);

    var decoded = '';
    if ('BarcodeDetector' in window) {
      var codes = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(canvas);
      if (codes && codes.length) decoded = codes[0].rawValue;
    }
    if (!decoded) {
      var jsQR = await loadExternalScript('https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', 'jsQR');
      var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var res = jsQR(imgData.data, imgData.width, imgData.height);
      if (res) decoded = res.data;
    }
    if (!handleScannedQrText(decoded)) {
      window.showToast('No valid otpauth QR found in image', 'error');
    }
  } catch (err) {
    window.showToast('Failed to read QR image', 'error');
  } finally {
    input.value = '';
  }
};

// ── Self-Service Active Sessions ──
window.openSessionsModal = function () {
  openModal('sessions-modal');
  loadSessions();
};

function loadSessions() {
  var box = document.getElementById('sessions-list');
  if (!box) return;
  box.innerHTML = '<div class="mono" style="font-size:0.75rem;color:var(--ink-3)">LOADING SESSIONS...</div>';
  fetch('/api/sessions')
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      box.innerHTML = '';
      if (!rows || !rows.length) {
        box.innerHTML = '<div class="mono" style="font-size:0.75rem;color:var(--ink-3)">NO ACTIVE SESSIONS.</div>';
        return;
      }
      rows.forEach(function (s) {
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:0.75rem;padding:0.75rem;border:1px solid var(--rule);background:var(--surface-sub)';
        row.innerHTML =
          '<div style="min-width:0;flex:1">' +
            '<div class="mono" style="font-size:0.72rem;font-weight:600">' + escapeStr(s.ip_address) + (s.is_current ? ' <span class="stamp stamp-accent">CURRENT</span>' : '') + '</div>' +
            '<div style="font-size:0.75rem;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0.2rem">' + escapeStr(s.user_agent) + '</div>' +
            '<div class="mono" style="font-size:0.65rem;color:var(--ink-3);margin-top:0.15rem">LAST ACTIVE: ' + escapeStr(s.last_used_at) + '</div>' +
          '</div>';
        if (!s.is_current) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn btn-danger btn-sm mono';
          btn.textContent = 'REVOKE';
          btn.onclick = function () {
            fetch('/api/sessions/' + s.id, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
              body: JSON.stringify({}),
            }).then(function () { loadSessions(); });
          };
          row.appendChild(btn);
        }
        box.appendChild(row);
      });
    });
}

window.revokeOtherSessions = function () {
  fetch('/api/sessions/revoke-others', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify({}),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      loadSessions();
      window.showToast('SIGNED OUT ' + (d.revoked || 0) + ' OTHER DEVICE(S)', 'success');
    });
};

// ── Admin Audit Sub-Tabs (Direct, Groups, Logs, Bulk Matrix) ──
window.switchAuditTab = function (tab, btn) {
  ['direct', 'groups', 'logs', 'matrix'].forEach(function (t) {
    var pane = document.getElementById('audit-pane-' + t);
    if (pane) pane.style.display = t === tab ? '' : 'none';
  });
  document.querySelectorAll('[data-audit-tab]').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-audit-tab') === tab);
  });
  if (tab === 'direct') loadAccessView();
  if (tab === 'groups') loadGroupSharesAudit();
  if (tab === 'logs') loadAuditLogs();
  if (tab === 'matrix') loadBulkMatrix();
};

function loadGroupSharesAudit() {
  fetch('/api/access/group-shares')
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      var tbody = document.getElementById('access-group-shares-body');
      tbody.innerHTML = '';
      if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="mono" style="color:var(--ink-3)">NO GROUP SHARES RECORDED.</td></tr>';
        return;
      }
      rows.forEach(function (r) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td data-label="KEY RECORD"><strong>' + escapeStr(r.profile_name) + '</strong></td>' +
          '<td data-label="CUSTODIAN" class="mono"><span>' + escapeStr(r.owner_email) + '</span></td>' +
          '<td data-label="TARGET GROUP"><strong>' + escapeStr(r.group_name) + ' (' + r.member_count + ')</strong></td>' +
          '<td data-label="CLEARANCE"><span class="stamp">' + (r.can_edit ? 'EDIT' : 'READ-ONLY') + (r.can_share ? ' · FWD' : '') + '</span></td>' +
          '<td data-label="ACTION" style="text-align:right"></td>';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-danger btn-sm mono';
        btn.textContent = 'REVOKE';
        btn.onclick = function () {
          fetch('/api/access/revoke-group-share', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
            body: JSON.stringify({ share_id: r.share_id }),
          }).then(function () { loadGroupSharesAudit(); });
        };
        tr.lastElementChild.appendChild(btn);
        tbody.appendChild(tr);
      });
    });
}

window.loadAuditLogs = function () {
  var q = (document.getElementById('audit-log-search')?.value || '').trim();
  fetch('/api/audit-logs?q=' + encodeURIComponent(q))
    .then(function (r) { return r.json(); })
    .then(function (rows) {
      var tbody = document.getElementById('audit-logs-body');
      tbody.innerHTML = '';
      if (!rows || !rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="mono" style="color:var(--ink-3)">NO ACTIVITY LOGS RECORDED.</td></tr>';
        return;
      }
      rows.forEach(function (l) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td data-label="TIMESTAMP" class="mono"><span>' + escapeStr(l.created_at) + '</span></td>' +
          '<td data-label="ACTOR" class="mono"><span>' + escapeStr(l.actor_email) + '</span></td>' +
          '<td data-label="ACTION"><span class="stamp">' + escapeStr(l.action) + '</span></td>' +
          '<td data-label="TARGET" class="mono"><span>' + escapeStr(l.target || '-') + '</span></td>' +
          '<td data-label="IP" class="mono"><span>' + escapeStr(l.ip_address || '-') + '</span></td>';
        tbody.appendChild(tr);
      });
    });
};

function loadBulkMatrix() {
  Promise.all([
    fetch('/api/access/all-tokens').then(function (r) { return r.json(); }),
    fetch('/api/whitelist').then(function (r) { return r.json(); }),
  ]).then(function (res) {
    var tokens = res[0] || [];
    var users = res[1] || [];
    var tBox = document.getElementById('bm-tokens');
    var uBox = document.getElementById('bm-users');
    tBox.innerHTML = '';
    uBox.innerHTML = '';

    tokens.forEach(function (t) {
      var lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0';
      lbl.innerHTML = '<input type="checkbox" class="bm-tok-cb" value="' + t.id + '"><span><strong>' + escapeStr(t.issuer || 'Service') + '</strong> · ' + escapeStr(t.name) + '</span>';
      tBox.appendChild(lbl);
    });
    users.forEach(function (u) {
      var lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.3rem 0';
      lbl.innerHTML = '<input type="checkbox" class="bm-usr-cb" value="' + escapeStr(u.email) + '"><span class="mono">' + escapeStr(u.email) + '</span>';
      uBox.appendChild(lbl);
    });
  });
}

window.submitBulkMatrix = function (action) {
  var pids = Array.from(document.querySelectorAll('.bm-tok-cb:checked')).map(function (el) { return Number(el.value); });
  var emails = Array.from(document.querySelectorAll('.bm-usr-cb:checked')).map(function (el) { return el.value; });
  if (!pids.length || !emails.length) {
    window.showToast('SELECT AT LEAST ONE TOKEN AND ONE ACCOUNT', 'error');
    return;
  }
  fetch('/api/access/bulk-multi-share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': CSRF },
    body: JSON.stringify({
      profile_ids: pids,
      emails: emails,
      action: action,
      can_edit: document.getElementById('bm-can-edit').checked,
    }),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) { window.showToast(d.error, 'error'); return; }
      window.showToast('BULK ' + action.toUpperCase() + ' COMPLETE', 'success');
      loadAccessView();
    });
};

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

if (activeView === 'groups') loadGroupsView();
if (activeView === 'access' && IS_ADMIN) loadAccessView();
if (activeView === 'whitelist' && IS_ADMIN) loadRolesView();
</script>
</body>
</html>`
  );
}
