/** Vrai si l'erreur indique une table/fonction introuvable (404, PGRST205, 42P01) : base non initialisée ou URL erronée. */
export function isDbNotReady(err: unknown): boolean {
  const e = err as { code?: string; status?: number; message?: string } | null;
  const m = e?.message ?? '';
  return (
    e?.code === 'PGRST205' ||
    e?.code === 'PGRST202' ||
    e?.code === 'PGRST204' ||
    e?.code === '42P01' ||
    e?.code === '42703' ||
    e?.status === 404 ||
    /could not find the (table|function)|schema cache|relation .* does not exist|\bnot found\b/i.test(m)
  );
}

let warned = false;
/** Détails techniques → console développeur uniquement ; l'utilisateur voit un message traduit. */
export function reportError(context: string, err: unknown): void {
  console.error(`[DOSSORA] ${context}`, err);
  if (isDbNotReady(err)) {
    if (!warned) {
      warned = true;
      console.error(
        '[DOSSORA] Table/fonction introuvable (404). Causes possibles : (1) supabase/schema.sql, policies.sql et seed.sql ne sont pas exécutés ; ' +
          '(2) VITE_SUPABASE_URL est incorrecte (doit être https://<projet>.supabase.co, sans /rest/v1) ; (3) cache de schéma à recharger (Settings → API → Reload schema).',
      );
    }
  }
}
