import { escapeHtml } from '../lib/html';
import { renderLayout } from './layout';

export function renderUnauthorized(email = '', _message = ''): string {
  const safeEmail = escapeHtml(email);

  return (
    renderLayout('Access Restricted : KeyLedger') +
    `
<main style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:1.5rem">
  <div style="width:100%;max-width:460px;background:var(--surface);border:1px solid var(--ink);padding:2.5rem">
    <div class="mono" style="font-size:0.72rem;color:var(--accent);letter-spacing:0.08em;margin-bottom:0.75rem">
      SECURITY NOTICE 403 · CLEARANCE REQUIRED
    </div>
    <h1 class="serif" style="font-size:2.5rem;line-height:1.05;margin-bottom:0.75rem">Identity not cleared.</h1>
    <p style="font-size:0.875rem;color:var(--ink-2);margin-bottom:1.5rem;line-height:1.6">
      The presented account does not hold clearance under the current repository configuration.
    </p>
    ${
      safeEmail
        ? `<div style="background:var(--surface-sub);border:1px solid var(--rule);padding:0.75rem 1rem;margin-bottom:1.5rem">
             <div class="mono" style="font-size:0.68rem;color:var(--ink-3);text-transform:uppercase">Presented Identity</div>
             <div class="mono" style="font-size:0.875rem;font-weight:600;word-break:break-all;margin-top:0.2rem">${safeEmail}</div>
           </div>`
        : ''
    }
    <div style="display:flex;flex-direction:column;gap:0.625rem">
      <a href="/auth/login/google" class="btn btn-primary btn-lg mono" style="width:100%">AUTHENTICATE DIFFERENT ACCOUNT</a>
      <a href="/" class="btn btn-secondary btn-lg mono" style="width:100%">RETURN TO DOSSIER</a>
    </div>
  </div>
</main>
</body>
</html>`
  );
}
