import { escapeHtml } from '../lib/html';

/**
 * Swiss Archival Safe-Deposit Ledger Design System
 * Design Read: cryptographic 2FA custody ledger & portal for technical teams,
 * in a Swiss private-banking archival editorial & exposed 1px hairline grid language,
 * dial ENERGY 2 / RHYTHM 3 / MOTION 2.
 *
 * Written Purpose Reasons (R-31):
 * - Color (R-01, R-29): Warm archival cotton paper (#F6F4EE light) & deep carbon (#0E0E0C dark) with 1 deliberate sealing-wax Vermilion accent (#A82A1E light / #F06A5B dark) to mark active cryptographic custody & destructive actions.
 * - Typography (R-06): Instrument Serif provides editorial authority for titles & index numerals (01, 02); IBM Plex Mono (tabular-nums) guarantees fixed-width alignment for rotating 6-digit passcodes; Inter handles compact UI labels.
 * - Layout (R-05, R-11): Exposed 1px solid structural hairline grid with sharp 2px corners replaces generic SaaS rounded cards and floating pill navbars.
 * - Motion (R-19): Emil Kowalski custom easings (--ease-out, --ease-drawer), blur-crossfade on copy, and clip-path hold-to-delete.
 */
export function renderBrandMark(size = 24): string {
  return `<img src="/logo.png" alt="KeyLedger" width="${size}" height="${size}" fetchpriority="high" class="brand-mark-img" style="width:${size}px;height:${size}px;object-fit:contain;display:block;flex-shrink:0">`;
}

export function renderLayout(
  pageTitle = 'KeyLedger : Cryptographic 2FA Custody Ledger'
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="theme-color" content="#0E0E0C" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F6F4EE" media="(prefers-color-scheme: light)">
<title>${escapeHtml(pageTitle)}</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="apple-touch-icon" href="/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script>
(function () {
  try {
    var saved = localStorage.getItem('keyledger_theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = saved === 'light' || saved === 'dark' ? saved : (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
</script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root, [data-theme="light"] {
  --bg:             #F6F4EE;
  --surface:        #FCFBF8;
  --surface-sub:    #EFECE4;
  --surface-hover:  #E7E3D8;
  --rule:           #D6D1C4;
  --rule-strong:    #787367;
  --ink:            #121210;
  --ink-2:          #3D3B36;
  --ink-3:          #59564F;
  --accent:         #A82A1E;
  --accent-hover:   #8C2117;
  --accent-fg:      #FCFBF8;
  --accent-soft:    rgba(168, 42, 30, 0.09);
  --accent-rule:    rgba(168, 42, 30, 0.38);
  --danger:         #A82A1E;
  --danger-soft:    #FDF2F0;
  --danger-rule:    #E5A39B;
  --shadow-drawer:  -24px 0 48px -12px rgba(18, 18, 16, 0.14);
  --r-sharp:        2px;
  --ease-out:       cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out:    cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer:    cubic-bezier(0.32, 0.72, 0, 1);
}

[data-theme="dark"] {
  --bg:             #0E0E0C;
  --surface:        #151512;
  --surface-sub:    #1D1D19;
  --surface-hover:  #25241F;
  --rule:           #2B2A24;
  --rule-strong:    #7D796E;
  --ink:            #EDEAE2;
  --ink-2:          #C2BEB4;
  --ink-3:          #969288;
  --accent:         #F06A5B;
  --accent-hover:   #E05546;
  --accent-fg:      #0E0E0C;
  --accent-soft:    rgba(240, 106, 91, 0.13);
  --accent-rule:    rgba(240, 106, 91, 0.45);
  --danger:         #F06A5B;
  --danger-soft:    rgba(240, 106, 91, 0.13);
  --danger-rule:    rgba(240, 106, 91, 0.45);
  --shadow-drawer:  -28px 0 60px -12px rgba(0, 0, 0, 0.78);
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  background: var(--bg);
  color: var(--ink);
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--rule) transparent;
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--rule) transparent;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--rule);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--rule-strong);
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg);
  color: var(--ink);
  line-height: 1.5;
  min-height: 100vh;
  min-height: 100dvh;
}

.serif {
  font-family: 'Instrument Serif', Georgia, 'Times New Roman', serif;
  font-weight: 400;
}

.mono {
  font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* ── Accessible Base Affordances (R-39) ── */
a[href],
button:not(:disabled),
select:not(:disabled),
summary,
label[for],
input[type="checkbox"]:not(:disabled),
input[type="radio"]:not(:disabled),
[role="button"]:not([aria-disabled="true"]),
[role="tab"]:not([aria-disabled="true"]) {
  cursor: pointer;
}

button:disabled,
input:disabled,
select:disabled,
[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.5;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

a { color: inherit; text-decoration: none; }

/* ── Architectural Buttons (Sharp 2px Edge, Tactile Press) ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1;
  min-height: 40px;
  padding: 0.625rem 1rem;
  border-radius: var(--r-sharp);
  border: 1px solid var(--rule-strong);
  background: var(--surface);
  color: var(--ink);
  transition: transform 120ms var(--ease-out), background-color 140ms ease, border-color 140ms ease, color 140ms ease;
  white-space: nowrap;
}

.btn:active:not(:disabled) {
  transform: scale(0.975);
}

.btn-primary {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
}
.btn-primary:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}

.btn-accent {
  background: var(--accent);
  color: var(--accent-fg);
  border-color: var(--accent);
}
.btn-accent:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.btn-secondary {
  background: var(--surface);
  color: var(--ink);
  border-color: var(--rule-strong);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--surface-sub);
}

.btn-ghost {
  background: transparent;
  color: var(--ink-2);
  border-color: transparent;
}
.btn-ghost:hover:not(:disabled) {
  background: var(--surface-sub);
  color: var(--ink);
}

.btn-danger {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: var(--danger-rule);
}

.btn-sm { min-height: 34px; padding: 0.4rem 0.75rem; font-size: 0.75rem; }
.btn-lg { min-height: 48px; padding: 0.8rem 1.35rem; font-size: 0.875rem; }
.btn-icon { width: 40px; min-width: 40px; padding: 0; }

/* ── Form Controls ── */
.field-label {
  display: block;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-2);
  margin-bottom: 0.375rem;
}

.input, .select, .textarea {
  width: 100%;
  min-height: 42px;
  padding: 0.5625rem 0.75rem;
  font-family: inherit;
  font-size: 0.875rem;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--rule-strong);
  border-radius: var(--r-sharp);
  transition: border-color 140ms ease;
}

.input:focus, .select:focus, .textarea:focus {
  border-color: var(--accent);
  outline: 2px solid var(--accent-soft);
  outline-offset: 0;
}

/* ── Ledger Stamps (Replacing Pill Badges) ── */
.stamp, .badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.18rem 0.48rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: var(--r-sharp);
  border: 1px solid var(--rule);
  background: var(--surface-sub);
  color: var(--ink-2);
}

.stamp-accent, .badge-accent {
  background: var(--accent-soft);
  border-color: var(--accent-rule);
  color: var(--accent);
}

/* ── Blur-Crossfade State Morph (emil-design-eng) ── */
.blur-morph {
  transition: filter 150ms var(--ease-out), opacity 150ms var(--ease-out);
}
.blur-morph.is-morphing {
  filter: blur(2.5px);
  opacity: 0.45;
}

/* ── Modals & Dialogs ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(14, 14, 12, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.modal-backdrop.hidden { display: none; }

.modal-panel {
  width: 100%;
  max-width: 460px;
  max-height: 90dvh;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--r-sharp);
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.35);
  padding: 1.5rem;
}

.modal-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.875rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--rule);
}

.modal-title {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1.1;
  color: var(--ink);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.625rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--rule);
}

/* ── Toast Stack ── */
#toast-region {
  position: fixed;
  bottom: 1.25rem;
  right: 1.25rem;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-width: calc(100vw - 2.5rem);
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: var(--ink);
  color: var(--bg);
  border: 1px solid var(--ink);
  border-radius: var(--r-sharp);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
  font-weight: 500;
  transition: transform 200ms var(--ease-out), opacity 200ms var(--ease-out);
}
.toast-item.toast-error {
  background: var(--danger);
  border-color: var(--danger);
  color: #FFFFFF;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

.brand-mark-img {
  filter: brightness(0);
}
[data-theme="dark"] .brand-mark-img {
  filter: none;
}

/* ── Aesthetic View Transition Circular Reveal for Day/Night Toggle ── */
::view-transition-old(root),
::view-transition-new(root) {
  animation: none;
  mix-blend-mode: normal;
}
::view-transition-old(root) { z-index: 1; }
::view-transition-new(root) { z-index: 9999; }
</style>
</head>
<body>
<div id="toast-region" aria-live="polite" aria-atomic="true"></div>

<div id="confirm-dialog" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
  <div class="modal-panel" style="max-width:400px">
    <div class="modal-header">
      <h2 id="confirm-dialog-title" class="modal-title">Confirm Action</h2>
    </div>
    <p id="confirm-dialog-msg" style="font-size:0.875rem;color:var(--ink-2);line-height:1.55"></p>
    <div class="modal-footer">
      <button type="button" id="confirm-cancel-btn" class="btn btn-secondary">Cancel</button>
      <button type="button" id="confirm-ok-btn" class="btn btn-primary">Confirm</button>
    </div>
  </div>
</div>

<script>
window.toggleTheme = function (evt) {
  var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  var next = cur === 'dark' ? 'light' : 'dark';

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem('keyledger_theme', next); } catch (e) {}
    document.querySelectorAll('[data-theme-label]').forEach(function (el) {
      el.textContent = next === 'dark' ? 'NIGHT' : 'DAY';
    });
  }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduced) {
    applyTheme();
    return;
  }

  var x = evt && typeof evt.clientX === 'number' && evt.clientX > 0 ? evt.clientX : window.innerWidth - 48;
  var y = evt && typeof evt.clientY === 'number' && evt.clientY > 0 ? evt.clientY : 28;
  var endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  var transition = document.startViewTransition(function () {
    applyTheme();
  });

  transition.ready.then(function () {
    document.documentElement.animate(
      {
        clipPath: [
          'circle(0px at ' + x + 'px ' + y + 'px)',
          'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)'
        ]
      },
      {
        duration: 460,
        easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
        pseudoElement: '::view-transition-new(root)'
      }
    );
  }).catch(function () {});
};

window.addEventListener('DOMContentLoaded', function () {
  var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  document.querySelectorAll('[data-theme-label]').forEach(function (el) {
    el.textContent = cur === 'dark' ? 'NIGHT' : 'DAY';
  });
});

window.showToast = function (message, type) {
  var region = document.getElementById('toast-region');
  if (!region) return;
  var item = document.createElement('div');
  item.className = 'toast-item ' + (type === 'error' ? 'toast-error' : 'toast-success');
  var text = document.createElement('span');
  text.textContent = message;
  item.appendChild(text);
  region.appendChild(item);
  setTimeout(function () { item.remove(); }, 2800);
};

window.confirmAction = function (opts) {
  return new Promise(function (resolve) {
    var backdrop = document.getElementById('confirm-dialog');
    var titleEl = document.getElementById('confirm-dialog-title');
    var msgEl = document.getElementById('confirm-dialog-msg');
    var okBtn = document.getElementById('confirm-ok-btn');
    var cancelBtn = document.getElementById('confirm-cancel-btn');

    titleEl.textContent = (opts && opts.title) || 'Confirm Action';
    msgEl.textContent = (opts && opts.message) || '';
    okBtn.textContent = (opts && opts.confirmText) || 'Confirm';
    okBtn.className = (opts && opts.danger) ? 'btn btn-accent' : 'btn btn-primary';

    function close(res) {
      backdrop.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      backdrop.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(res);
    }
    function onOk() { close(true); }
    function onCancel() { close(false); }
    function onBackdrop(e) { if (e.target === backdrop) close(false); }
    function onKey(e) { if (e.key === 'Escape') close(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    backdrop.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
    backdrop.classList.remove('hidden');
    okBtn.focus();
  });
};
window.appleConfirm = window.confirmAction;
</script>`;
}
