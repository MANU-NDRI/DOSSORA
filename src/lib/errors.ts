import { isDbNotReady } from './diagnostics';

/** Transforme une erreur Supabase/Postgres en clé de traduction compréhensible. */
export function errorKey(err: unknown): string {
  const e = err as { code?: string; message?: string; status?: number } | null;
  const msg = String(e?.message ?? err ?? '');
  const codes = [
    'INSUFFICIENT_STOCK',
    'PRODUCT_UNAVAILABLE',
    'PROMO_INVALID',
    'PROMO_EXPIRED',
    'PROMO_NOT_STARTED',
    'PROMO_EXHAUSTED',
    'PROMO_MIN_ORDER',
    'COUNTRY_UNAVAILABLE',
    'CITY_UNAVAILABLE',
    'PAYMENT_UNAVAILABLE',
    'EMPTY_CART',
    'INVALID_INPUT',
    'AUTH_REQUIRED',
    'FORBIDDEN',
    'RETURN_WINDOW_CLOSED',
    'INVALID_STOCK',
    'INVALID_TRANSITION',
  ];
  for (const c of codes) if (msg.includes(c)) return `errors.${c}`;
  if (e?.status === 401 || e?.code === '401') return 'errors.session_expired';
  if (e?.status === 403 || e?.code === '42501' || /permission denied|row.level security|not authorized/i.test(msg)) return 'errors.FORBIDDEN';
  if (isDbNotReady(err)) return 'errors.db_not_ready';
  if (/Invalid login credentials/i.test(msg)) return 'errors.invalid_credentials';
  if (/Email not confirmed/i.test(msg)) return 'errors.email_not_confirmed';
  if (/already registered|already been registered/i.test(msg)) return 'errors.email_taken';
  if (/JWT|expired|session/i.test(msg)) return 'errors.session_expired';
  if (/fetch|network|Failed to/i.test(msg)) return 'errors.network';
  return 'errors.generic';
}
