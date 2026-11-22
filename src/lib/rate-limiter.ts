import { sha256Hex } from './cookies';

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
  hits: number;
}

/**
 * D1-backed sliding/fixed window rate limiter.
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  maxAttempts: number,
  decaySeconds = 60
): Promise<RateLimitResult> {
  const keyHash = await sha256Hex(key);
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .prepare('SELECT hits, expires_at FROM rate_limits WHERE key_hash = ?')
    .bind(keyHash)
    .first<{ hits: number; expires_at: number }>();

  if (existing && existing.expires_at > now) {
    if (existing.hits >= maxAttempts) {
      return {
        allowed: false,
        retryAfter: Math.max(1, existing.expires_at - now),
        hits: existing.hits,
      };
    }

    const newHits = existing.hits + 1;
    await db
      .prepare('UPDATE rate_limits SET hits = ? WHERE key_hash = ?')
      .bind(newHits, keyHash)
      .run();

    return { allowed: true, retryAfter: 0, hits: newHits };
  }

  const expiresAt = now + decaySeconds;
  await db
    .prepare(
      `INSERT INTO rate_limits (key_hash, hits, expires_at)
       VALUES (?, 1, ?)
       ON CONFLICT(key_hash) DO UPDATE SET hits = 1, expires_at = excluded.expires_at`
    )
    .bind(keyHash, expiresAt)
    .run();

  // Opportunistic cleanup (~2% chance)
  if (Math.random() < 0.02) {
    await db.prepare('DELETE FROM rate_limits WHERE expires_at <= ?').bind(now).run().catch(() => {});
  }

  return { allowed: true, retryAfter: 0, hits: 1 };
}
