import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';
import { ALLOWED_IMAGE_TYPES } from '@/lib/utils';

const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_PROOF = 8 * 1024 * 1024;
const PROOF_TYPES = [...ALLOWED_IMAGE_TYPES, 'application/pdf', 'video/mp4'];

const extOf = (f: File) =>
  (f.name.split('.').pop() ?? 'bin')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 5) || 'bin';

/** Image publique (produits, bannières, catégories) — réservé à l'admin par les policies Storage. */
export async function uploadPublicImage(file: File, folder: string, onProgress?: (pct: number) => void): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error('FILE_TYPE');
  if (file.size > MAX_IMAGE) throw new Error('FILE_SIZE');
  const path = `${folder}/${crypto.randomUUID()}.${extOf(file)}`;
  if (!onProgress) {
    const { error } = await supabase.storage.from('shop-assets').upload(path, file, { cacheControl: '31536000', contentType: file.type });
    if (error) throw error;
  } else {
    // Même requête que le SDK (multipart), mais via XHR pour obtenir la progression réelle de l'envoi.
    const { data: s } = await supabase.auth.getSession();
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${supabaseUrl}/storage/v1/object/shop-assets/${path.split('/').map(encodeURIComponent).join('/')}`);
      xhr.setRequestHeader('Authorization', `Bearer ${s.session?.access_token ?? supabaseAnonKey}`);
      xhr.setRequestHeader('apikey', supabaseAnonKey);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          console.error('[DOSSORA] Upload Storage refusé', xhr.status, xhr.responseText);
          reject(new Error(xhr.status === 401 || xhr.status === 403 ? 'FORBIDDEN' : 'UPLOAD'));
        }
      };
      xhr.onerror = () => reject(new Error('NETWORK'));
      const body = new FormData();
      body.append('cacheControl', '31536000');
      body.append('', file);
      xhr.send(body);
    });
  }
  return supabase.storage.from('shop-assets').getPublicUrl(path).data.publicUrl;
}

/** Supprime un ancien fichier de shop-assets (ignore les images de démo ou externes). Échec non bloquant, journalisé. */
export async function removePublicImageByUrl(url?: string | null): Promise<void> {
  if (!url) return;
  const marker = '/object/public/shop-assets/';
  const i = url.indexOf(marker);
  if (i < 0) return;
  const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
  const { error } = await supabase.storage.from('shop-assets').remove([path]);
  if (error) console.error('[DOSSORA] Ancienne image non supprimée', path, error);
}

/** Preuve de paiement / média de retour : bucket privé, dossier = id du client. */
export async function uploadPrivateFile(file: File, userId: string, sub: 'proofs' | 'returns'): Promise<string> {
  if (!PROOF_TYPES.includes(file.type)) throw new Error('FILE_TYPE');
  if (file.size > MAX_PROOF) throw new Error('FILE_SIZE');
  const path = `${userId}/${sub}/${crypto.randomUUID()}.${extOf(file)}`;
  const { error } = await supabase.storage.from('payment-proofs').upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}
export async function signedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
