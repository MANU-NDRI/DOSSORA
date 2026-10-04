import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/** Accepte une URL saisie avec un slash final ou un suffixe /rest/v1 (cause fréquente de 404) et la normalise. */
function normalizeUrl(raw?: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(rest|auth|storage|realtime)\/v1.*$/i, '');
}
const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const url = normalizeUrl(rawUrl);
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/** false tant que .env n'est pas renseigné. */
/**
 * Accès non typé réservé au gestionnaire CRUD générique (ResourceManager), dont la table est choisie à l'exécution.
 * Partout ailleurs, utilisez `supabase` (typé : une faute de table, de colonne ou de RPC fait échouer `npm run typecheck`).
 */
export const untypedFrom = (table: string) => (supabase as unknown as SupabaseClient).from(table);

export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;
export const isSupabaseConfigured = Boolean(url && anonKey);
if (!isSupabaseConfigured)
  console.error(
    '[DOSSORA] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquantes : copiez .env.example vers .env (ou renseignez les variables Cloudflare Pages) puis relancez.',
  );
else if (rawUrl && rawUrl.trim() !== url)
  console.warn(`[DOSSORA] VITE_SUPABASE_URL normalisée : "${rawUrl}" → "${url}". Utilisez l'URL racine du projet.`);

// Clé ANON uniquement (publique, protégée par RLS). Jamais de service_role dans le frontend.
export const supabase = createClient<Database>(url || 'http://localhost:54321', anonKey || 'not-configured', {
  // Pas de retries automatiques du SDK (1 s + 2 s + 4 s) : l'utilisateur voit tout de suite « Réessayer » au lieu d'attendre ~8 s.
  db: { retry: false },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
