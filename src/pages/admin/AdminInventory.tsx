import { useState } from 'react';
import { ErrorState, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { useUI } from '@/store/ui';
import { cn, formatDate } from '@/lib/utils';

interface Row {
  id: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  shoe_size: string | null;
  stock: number;
  reserved: number;
  low_stock_threshold: number;
  products: { name_fr: string } | null;
}
interface Mov {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  created_at: string;
}

export default function AdminInventory() {
  const { t, lang } = useT();
  const toast = useUI((s) => s.toast);
  const [q, setQ] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [sel, setSel] = useState<Row | null>(null);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('restock');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState<Mov[]>([]);

  const { data, loading, error, reload } = useAsync(async () => {
    const { data: rows, error: e } = await supabase
      .from('product_variants')
      .select('id,sku,color,size,shoe_size,stock,reserved,low_stock_threshold,products(name_fr)')
      .order('stock')
      .limit(500);
    if (e) throw e;
    return (rows ?? []) as unknown as Row[];
  }, []);
  const open = async (r: Row) => {
    setSel(r);
    setDelta('');
    setNote('');
    setReason('restock');
    setHist([]);
    const { data: m } = await supabase
      .from('inventory_movements')
      .select('id,delta,reason,note,created_at')
      .eq('variant_id', r.id)
      .order('created_at', { ascending: false })
      .limit(15);
    setHist((m ?? []) as Mov[]);
  };
  const adjust = async () => {
    if (!sel) return;
    const d = parseInt(delta, 10);
    if (!d) {
      toast('error', t('errors.INVALID_STOCK'));
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.rpc('admin_adjust_stock', {
      p_variant: sel.id,
      p_delta: reason === 'removal' ? -Math.abs(d) : d,
      p_reason: reason,
      p_note: note || null,
    });
    setBusy(false);
    if (err) {
      toast('error', t(errorKey(err)));
      return;
    }
    toast('success', t('common.saved'));
    setSel(null);
    reload();
  };
  const vlabel = (r: Row) => [r.color, r.size, r.shoe_size].filter(Boolean).join(' · ') || '—';
  const list = (data ?? []).filter(
    (r) =>
      (!onlyLow || r.stock - r.reserved <= r.low_stock_threshold) &&
      (!q || `${r.products?.name_fr} ${r.sku}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div>
      <PageHeader title={t('admin.nav.inventory')} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          type="search"
          placeholder={t('admin.search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t('admin.search')}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[#7A1F3D]" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          {t('inv.only_low')}
        </label>
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-ivory-dark text-xs text-bordeaux">
              <tr>
                {['admin.product', 'inv.variant', 'SKU', 'inv.stock', 'inv.reserved', 'inv.available', ''].map((k, i) => (
                  <th key={i} className="px-3 py-2.5 text-start">
                    {k.includes('.') ? t(k) : k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-bordeaux/10">
              {list.map((r) => {
                const av = r.stock - r.reserved;
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2.5 font-semibold">{r.products?.name_fr}</td>
                    <td className="px-3 py-2.5">{vlabel(r)}</td>
                    <td className="px-3 py-2.5 text-xs">{r.sku}</td>
                    <td className="px-3 py-2.5">{r.stock}</td>
                    <td className="px-3 py-2.5">{r.reserved}</td>
                    <td
                      className={cn(
                        'px-3 py-2.5 font-semibold',
                        av <= 0 ? 'text-red-700' : av <= r.low_stock_threshold ? 'text-amber-700' : 'text-emerald-700',
                      )}
                    >
                      {av}
                    </td>
                    <td className="px-3 py-2.5">
                      <button className="btn-outline btn-sm" onClick={() => void open(r)}>
                        {t('inv.adjust')}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!list.length && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-ink/60">
                    {t('admin.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.products?.name_fr} — ${vlabel(sel)}` : ''}>
        {sel && (
          <div className="space-y-4">
            <p className="text-sm">
              {t('inv.stock')}: <b>{sel.stock}</b> · {t('inv.reserved')}: <b>{sel.reserved}</b>
            </p>
            <Field label={t('inv.reason')}>
              <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
                {['restock', 'removal', 'correction', 'initial'].map((r) => (
                  <option key={r} value={r}>
                    {t(`inv.reason_${r}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('inv.quantity')} hint={reason === 'correction' ? t('inv.correction_hint') : undefined}>
              <input type="number" className="input" value={delta} onChange={(e) => setDelta(e.target.value)} />
            </Field>
            <Field label={t('admin.note')}>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <button className="btn-primary w-full" disabled={busy} onClick={() => void adjust()}>
              {busy && <Spinner className="h-4 w-4" />}
              {t('common.save')}
            </button>
            {hist.length > 0 && (
              <div>
                <p className="label">{t('inv.history')}</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                  {hist.map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <span>
                        {formatDate(m.created_at, lang, true)} · {m.reason}
                        {m.note ? ` · ${m.note}` : ''}
                      </span>
                      <b className={m.delta < 0 ? 'text-red-700' : 'text-emerald-700'} dir="ltr">
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </b>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
