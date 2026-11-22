import { User } from '../types';
import { renderLayout } from './layout';

export function renderNotFound(user: User | null): string {
  const href = user ? '/tokens' : '/';
  const label = user ? 'RETURN TO LEDGER' : 'RETURN TO DOSSIER';

  return (
    renderLayout('404 Not Found : KeyLedger') +
    `
<main style="min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:1.5rem">
  <div style="width:100%;max-width:440px;background:var(--surface);border:1px solid var(--ink);padding:2.5rem">
    <div class="mono" style="font-size:0.72rem;color:var(--ink-3);letter-spacing:0.08em;margin-bottom:1rem">
      ERROR 404 · ENTRY NOT FOUND
    </div>
    <h1 class="serif" style="font-size:3rem;line-height:1;margin-bottom:0.75rem"> Ledger entry missing.</h1>
    <p style="font-size:0.875rem;color:var(--ink-2);margin-bottom:2rem;line-height:1.6">
      The requested address does not correspond to an active record in this KeyLedger repository.
    </p>
    <a href="${href}" class="btn btn-primary btn-lg mono" style="width:100%">${label}</a>
  </div>
</main>
</body>
</html>`
  );
}
