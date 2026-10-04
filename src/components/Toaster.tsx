import { AnimatePresence, motion } from 'framer-motion';
import { useUI } from '@/store/ui';
import { useT } from '@/i18n';
import { Icon } from './Icon';

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  const { t: tt } = useT();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-soft ${t.kind === 'error' ? 'bg-red-700 text-white' : t.kind === 'success' ? 'bg-bordeaux text-ivory' : 'bg-white text-ink'}`}
          >
            <Icon name={t.kind === 'error' ? 'x' : 'check'} className="h-4 w-4 shrink-0 text-gold" />
            <span>{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label={tt('common.close')} className="ms-1 opacity-70 hover:opacity-100">
              <Icon name="x" className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
