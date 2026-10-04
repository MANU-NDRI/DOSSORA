import { useId, useRef, useState } from 'react';
import { uploadPublicImage } from '@/services/storage';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';

interface Props {
  value?: string | null;
  onChange: (url: string) => void;
  folder: string;
  label?: string;
  aspect?: 'square' | 'wide' | 'tall';
  hint?: string;
}

/** Téléversement d'image vers Supabase Storage (shop-assets) : aperçu, progression, remplacement, suppression. */
export function ImageUpload({ value, onChange, folder, label, aspect = 'square', hint }: Props) {
  const { t } = useT();
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = async (file?: File) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      onChange(await uploadPublicImage(file, folder, setProgress));
    } catch (e) {
      const m = (e as Error).message;
      console.error('[DOSSORA] Upload image', e);
      setError(
        m === 'FILE_SIZE'
          ? t('errors.file_size')
          : m === 'FILE_TYPE'
            ? t('errors.file_type')
            : m === 'FORBIDDEN'
              ? t('errors.FORBIDDEN')
              : m === 'NETWORK'
                ? t('errors.network')
                : t('errors.upload_failed'),
      );
    } finally {
      setProgress(null);
      if (ref.current) ref.current.value = '';
    }
  };
  const box = aspect === 'wide' ? 'h-24 w-40 sm:h-28 sm:w-48' : aspect === 'tall' ? 'h-40 w-24' : 'h-20 w-20';
  const busy = progress !== null;
  return (
    <div className="flex flex-wrap items-start gap-3">
      <div
        className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-bordeaux/15 bg-ivory-dark', box)}
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="image" className="h-6 w-6 text-bordeaux/40" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {label && <div className="mb-1 text-xs font-semibold text-bordeaux">{label}</div>}
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          id={id}
          onChange={(e) => void pick(e.target.files?.[0])}
          disabled={busy}
        />
        <div className="flex flex-wrap gap-1">
          <label htmlFor={id} className={cn('btn-outline btn-sm cursor-pointer', busy && 'pointer-events-none opacity-60')}>
            <Icon name="upload" className="h-4 w-4" />
            {value ? t('admin.replace_image') : t('admin.upload_image')}
          </label>
          {value && !busy && (
            <button type="button" className="btn-ghost btn-sm text-red-700" onClick={() => onChange('')}>
              <Icon name="trash" className="h-4 w-4" />
              {t('common.remove')}
            </button>
          )}
        </div>
        {busy && (
          <div
            className="mt-2"
            role="progressbar"
            aria-valuenow={progress ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('admin.uploading')}
          >
            <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-bordeaux/10">
              <div className="h-full bg-gold transition-all" style={{ width: `${Math.max(progress ?? 0, 6)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-ink/60">
              {t('admin.uploading')} {progress}%
            </p>
          </div>
        )}
        {hint && !error && <p className="mt-1 text-[11px] text-ink/55">{hint}</p>}
        {error && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
