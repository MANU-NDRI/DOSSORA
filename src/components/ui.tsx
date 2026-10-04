import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';
import { errorKey } from '@/lib/errors';
import type { OrderStatus } from '@/types';

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  const { t } = useT();
  return (
    <span
      role="status"
      aria-label={t('common.loading')}
      className={cn('inline-block animate-spin rounded-full border-2 border-gold border-t-bordeaux', className)}
    />
  );
}
export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-9 w-9" />
    </div>
  );
}
export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold/20 text-bordeaux">
        <Icon name="bag" className="h-7 w-7" />
      </span>
      <h3 className="text-2xl">{title}</h3>
      {text && <p className="mt-2 text-sm text-ink/70">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
/** Message d'erreur grand public : jamais de détail technique (ils sont dans la console développeur). */
export function ErrorState({ text, error, onRetry, home = true }: { text?: string; error?: unknown; onRetry?: () => void; home?: boolean }) {
  const { t, scope } = useT();
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center">
      <h3 className="text-2xl">{t('errors.network_title')}</h3>
      <p className="mt-2 text-sm text-ink/70">{text ?? (error ? t(errorKey(error)) : t('errors.network'))}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onRetry && (
          <button className="btn-outline" onClick={onRetry}>
            {t('common.retry')}
          </button>
        )}
        {home && scope === 'client' && (
          <Link to="/" className="btn-ghost">
            {t('nav.back_home')}
          </Link>
        )}
      </div>
    </div>
  );
}
export function NotFound() {
  const { t } = useT();
  const { scope } = useT();
  return (
    <EmptyState
      title={t('errors.not_found')}
      text={t('errors.not_found_text')}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Link to={scope === 'admin' ? '/admin/dashboard' : '/'} className="btn-primary">
            {t('nav.back_home')}
          </Link>
          {scope === 'client' && (
            <Link to="/shop" className="btn-outline">
              {t('nav.shop')}
            </Link>
          )}
        </div>
      }
    />
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const { t } = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-ivory shadow-2xl sm:rounded-3xl',
              wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
            )}
          >
            <div className="flex items-center justify-between border-b border-bordeaux/10 px-5 py-4">
              <h2 className="text-2xl">{title}</h2>
              <button onClick={onClose} className="rounded-full p-2 text-bordeaux hover:bg-bordeaux/10" aria-label={t('common.close')}>
                <Icon name="x" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Field({ label, error, children, hint }: { label: string; error?: string | null; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink/60">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-medium text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-900',
  payment_proof_received: 'bg-blue-100 text-blue-900',
  paid: 'bg-emerald-100 text-emerald-900',
  preparing: 'bg-indigo-100 text-indigo-900',
  delivering: 'bg-cyan-100 text-cyan-900',
  delivered: 'bg-green-200 text-green-900',
  cancelled: 'bg-red-100 text-red-800',
};
export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useT();
  return <span className={cn('badge', STATUS_STYLE[status])}>{t(`status.${status}`)}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink/70">{subtitle}</p>}
        <div className="gold-rule mt-3" />
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
