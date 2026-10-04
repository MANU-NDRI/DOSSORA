import { useState, type FormEvent } from 'react';
import { EmptyState, ErrorState, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { ImageUpload } from '@/components/ImageUpload';
import { Icon } from '@/components/Icon';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { useCategories, useSettings } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { reportError } from '@/lib/diagnostics';
import { PRODUCT_SELECT } from '@/services/catalog';
import { useUI } from '@/store/ui';
import { formatMoney, mainImage, slugify } from '@/lib/utils';
import type { Product } from '@/types';

interface VForm {
  id?: string;
  sku: string;
  color: string;
  size: string;
  shoe_size: string;
  price_override: string;
  stock: string;
  low_stock_threshold: string;
  existing: boolean;
}
interface PForm {
  id?: string;
  slug: string;
  sku: string;
  category_id: string;
  name_fr: string;
  name_en: string;
  name_ar: string;
  description_fr: string;
  description_en: string;
  description_ar: string;
  price: string;
  sale_price: string;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  is_popular: boolean;
  is_new: boolean;
  is_on_sale: boolean;
  images: string[];
  variants: VForm[];
  removedVariants: string[];
}
const emptyV = (): VForm => ({
  sku: '',
  color: '',
  size: '',
  shoe_size: '',
  price_override: '',
  stock: '0',
  low_stock_threshold: '3',
  existing: false,
});
const emptyP = (): PForm => ({
  slug: '',
  sku: '',
  category_id: '',
  name_fr: '',
  name_en: '',
  name_ar: '',
  description_fr: '',
  description_en: '',
  description_ar: '',
  price: '',
  sale_price: '',
  status: 'draft',
  is_featured: false,
  is_popular: false,
  is_new: true,
  is_on_sale: false,
  images: [],
  variants: [emptyV()],
  removedVariants: [],
});
const nn = (s: string) => (s.trim() === '' ? null : s.trim());

export default function AdminProducts() {
  const { t, lang } = useT();
  const toast = useUI((s) => s.toast);
  const { currency } = useSettings();
  const cats = useCategories();
  const [q, setQ] = useState('');
  const [form, setForm] = useState<PForm | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(async () => {
    let query = supabase.from('products').select(PRODUCT_SELECT).order('created_at', { ascending: false }).limit(200);
    const term = q.replace(/[%,()*]/g, ' ').trim();
    if (term) query = query.or(`name_fr.ilike.%${term}%,sku.ilike.%${term}%`);
    const { data: rows, error: e } = await query;
    if (e) throw e;
    return (rows ?? []) as unknown as Product[];
  }, [q]);

  const edit = (p: Product | null) => {
    if (!p) {
      setForm(emptyP());
      return;
    }
    setForm({
      id: p.id,
      slug: p.slug,
      sku: p.sku ?? '',
      category_id: p.category_id ?? '',
      name_fr: p.name_fr,
      name_en: p.name_en ?? '',
      name_ar: p.name_ar ?? '',
      description_fr: p.description_fr ?? '',
      description_en: p.description_en ?? '',
      description_ar: p.description_ar ?? '',
      price: String(p.price),
      sale_price: p.sale_price === null ? '' : String(p.sale_price),
      status: p.status,
      is_featured: p.is_featured,
      is_popular: p.is_popular,
      is_new: p.is_new,
      is_on_sale: p.is_on_sale,
      images: [...p.product_images].sort((a, b) => a.sort_order - b.sort_order).map((i) => i.url),
      variants: p.product_variants.map((v) => ({
        id: v.id,
        sku: v.sku ?? '',
        color: v.color ?? '',
        size: v.size ?? '',
        shoe_size: v.shoe_size ?? '',
        price_override: v.price_override === null ? '' : String(v.price_override),
        stock: String(v.stock),
        low_stock_threshold: String(v.low_stock_threshold),
        existing: true,
      })),
      removedVariants: [],
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const price = Number(form.price);
    if (!form.name_fr.trim()) {
      toast('error', t('validation.product_name_required'));
      return;
    }
    if (Number.isNaN(price) || price <= 0) {
      toast('error', t('validation.price_positive'));
      return;
    }
    if (form.sale_price && Number(form.sale_price) >= price) {
      toast('error', t('prod.sale_lower'));
      return;
    }
    setBusy(true);
    try {
      const row = {
        slug: slugify(form.slug || form.name_fr),
        sku: nn(form.sku),
        category_id: form.category_id || null,
        name_fr: form.name_fr.trim(),
        name_en: nn(form.name_en),
        name_ar: nn(form.name_ar),
        description_fr: nn(form.description_fr),
        description_en: nn(form.description_en),
        description_ar: nn(form.description_ar),
        price,
        sale_price: form.sale_price ? Number(form.sale_price) : null,
        status: form.status,
        is_featured: form.is_featured,
        is_popular: form.is_popular,
        is_new: form.is_new,
        is_on_sale: form.is_on_sale || !!form.sale_price,
      };
      let pid = form.id;
      if (pid) {
        const r = await supabase.from('products').update(row).eq('id', pid);
        if (r.error) throw r.error;
      } else {
        const r = await supabase.from('products').insert(row).select('id').single();
        if (r.error) throw r.error;
        pid = (r.data as { id: string }).id;
      }
      // Images : remplacement complet dans l'ordre affiché.
      await supabase.from('product_images').delete().eq('product_id', pid);
      if (form.images.length) {
        const r = await supabase
          .from('product_images')
          .insert(form.images.map((url, i) => ({ product_id: pid, url, sort_order: i, alt: row.name_fr })));
        if (r.error) throw r.error;
      }
      // Variantes : le stock passe par admin_adjust_stock pour garder l'historique.
      if (form.removedVariants.length) {
        const r = await supabase.from('product_variants').delete().in('id', form.removedVariants);
        if (r.error) throw r.error;
      }
      for (const v of form.variants) {
        const base = {
          product_id: pid,
          sku: nn(v.sku),
          color: nn(v.color),
          size: nn(v.size),
          shoe_size: nn(v.shoe_size),
          price_override: v.price_override ? Number(v.price_override) : null,
          low_stock_threshold: Number(v.low_stock_threshold) || 0,
        };
        if (v.existing && v.id) {
          const r = await supabase.from('product_variants').update(base).eq('id', v.id);
          if (r.error) throw r.error;
        } else {
          const r = await supabase
            .from('product_variants')
            .insert({ ...base, stock: 0 })
            .select('id')
            .single();
          if (r.error) throw r.error;
          const qty = Math.max(0, parseInt(v.stock, 10) || 0);
          if (qty > 0) {
            const s = await supabase.rpc('admin_adjust_stock', {
              p_variant: (r.data as { id: string }).id,
              p_delta: qty,
              p_reason: 'initial',
              p_note: null,
            });
            if (s.error) throw s.error;
          }
        }
      }
      toast('success', t(form.id ? 'prod.updated' : 'prod.created'));
      setForm(null);
      reload();
    } catch (err) {
      reportError('Enregistrement produit', err);
      toast('error', t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };
  const del = async (p: Product) => {
    if (p.status === 'archived') return;
    if (!window.confirm(t('prod.confirm_archive'))) return;
    const { error: err } = await supabase.from('products').update({ status: 'archived' }).eq('id', p.id);
    if (err) {
      reportError('Archivage produit', err);
      toast('error', t(errorKey(err)));
    } else {
      toast('success', t('prod.archived'));
      reload();
    }
  };
  const setV = (i: number, patch: Partial<VForm>) =>
    setForm((f) => (f ? { ...f, variants: f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) } : f));
  const set = (k: keyof PForm) => (e: { target: { value: string } }) => setForm((f) => (f ? { ...f, [k]: e.target.value } : f));
  const flag = (k: 'is_featured' | 'is_popular' | 'is_new' | 'is_on_sale', label: string) =>
    form && (
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#7A1F3D]"
          checked={form[k]}
          onChange={(e) => setForm({ ...form, [k]: e.target.checked })}
        />
        {label}
      </label>
    );

  return (
    <div>
      <PageHeader
        title={t('admin.nav.products')}
        actions={
          <button className="btn-primary btn-sm" onClick={() => edit(null)}>
            <Icon name="plus" className="h-4 w-4" />
            {t('common.add')}
          </button>
        }
      />
      <input
        className="input mb-4 max-w-sm"
        type="search"
        placeholder={t('admin.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={t('admin.search')}
      />
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState title={t('admin.empty')} />
      ) : (
        <ul className="space-y-2">
          {data.map((p) => (
            <li key={p.id} className="card flex items-center gap-3 p-3">
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-ivory-dark">
                {mainImage(p) && <img src={mainImage(p) as string} alt="" loading="lazy" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name_fr}</p>
                <p className="text-xs text-ink/60" dir="ltr">
                  {formatMoney(p.sale_price ?? p.price, currency, lang)} · {t('inv.available')}: {p.available_stock} ·{' '}
                  {t(`prod.status_${p.status}`)}
                </p>
              </div>
              <div className="flex gap-1">
                <button className="btn-outline btn-sm" onClick={() => edit(p)} aria-label={t('common.edit')}>
                  <Icon name="edit" className="h-4 w-4" />
                </button>
                {p.status !== 'archived' && (
                  <button
                    className="btn-ghost btn-sm text-red-700"
                    onClick={() => void del(p)}
                    aria-label={t('prod.archive')}
                    title={t('prod.archive')}
                  >
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? t('common.edit') : t('common.add')} wide>
        {form && (
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`${t('admin.name')} (FR) *`}>
                <input className="input" value={form.name_fr} onChange={set('name_fr')} required />
              </Field>
              <Field label={`${t('admin.name')} (EN)`}>
                <input className="input" value={form.name_en} onChange={set('name_en')} />
              </Field>
              <Field label={`${t('admin.name')} (AR)`}>
                <input className="input" value={form.name_ar} onChange={set('name_ar')} />
              </Field>
              <Field label={t('admin.slug')} hint={t('admin.slug_hint')}>
                <input className="input" value={form.slug} onChange={set('slug')} />
              </Field>
              <Field label={`${t('admin.description')} (FR)`}>
                <textarea className="input min-h-[90px]" value={form.description_fr} onChange={set('description_fr')} />
              </Field>
              <Field label={`${t('admin.description')} (EN)`}>
                <textarea className="input min-h-[90px]" value={form.description_en} onChange={set('description_en')} />
              </Field>
              <Field label={`${t('admin.description')} (AR)`}>
                <textarea className="input min-h-[90px]" value={form.description_ar} onChange={set('description_ar')} />
              </Field>
              <Field label={t('admin.sku')}>
                <input className="input" value={form.sku} onChange={set('sku')} />
              </Field>
              <Field label={`${t('prod.price')} (${currency}) *`}>
                <input type="number" step="any" min="0" className="input" value={form.price} onChange={set('price')} required />
              </Field>
              <Field label={t('prod.sale_price')}>
                <input type="number" step="any" min="0" className="input" value={form.sale_price} onChange={set('sale_price')} />
              </Field>
              <Field label={t('prod.category')}>
                <select className="input" value={form.category_id} onChange={set('category_id')}>
                  <option value="">—</option>
                  {cats.data.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_id ? '— ' : ''}
                      {c.name_fr}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t('admin.status')}>
                <select className="input" value={form.status} onChange={set('status')}>
                  {['draft', 'published', 'archived'].map((s) => (
                    <option key={s} value={s}>
                      {t(`prod.status_${s}`)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {flag('is_new', t('product.new'))}
              {flag('is_on_sale', t('shop.flag_sale'))}
              {flag('is_popular', t('shop.flag_popular'))}
              {flag('is_featured', t('shop.flag_featured'))}
            </div>

            <section>
              <h3 className="mb-2 text-xl">{t('prod.images')}</h3>
              <div className="flex flex-wrap gap-3">
                {form.images.map((url, i) => (
                  <div key={url} className="relative h-24 w-20 overflow-hidden rounded-xl border border-bordeaux/15">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/55 px-1 text-white">
                      <button
                        type="button"
                        aria-label={t('common.prev')}
                        disabled={i === 0}
                        onClick={() =>
                          setForm({ ...form, images: form.images.map((u, j, a) => (j === i - 1 ? a[i] : j === i ? a[i - 1] : u)) })
                        }
                        className="disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        aria-label={t('common.remove')}
                        onClick={() => setForm({ ...form, images: form.images.filter((_, j) => j !== i) })}
                      >
                        ✕
                      </button>
                      <button
                        type="button"
                        aria-label={t('common.next')}
                        disabled={i === form.images.length - 1}
                        onClick={() =>
                          setForm({ ...form, images: form.images.map((u, j, a) => (j === i + 1 ? a[i] : j === i ? a[i + 1] : u)) })
                        }
                        className="disabled:opacity-30"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                ))}
                <ImageUpload
                  key={form.images.length}
                  folder="products"
                  label={t('prod.add_image')}
                  value=""
                  onChange={(url) => url && setForm((f) => (f ? { ...f, images: [...f.images, url] } : f))}
                />
              </div>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xl">{t('prod.variants')}</h3>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() => setForm({ ...form, variants: [...form.variants, emptyV()] })}
                >
                  <Icon name="plus" className="h-4 w-4" />
                  {t('common.add')}
                </button>
              </div>
              <p className="mb-2 text-xs text-ink/60">{t('prod.variants_hint')}</p>
              <div className="space-y-2">
                {form.variants.map((v, i) => (
                  <div
                    key={v.id ?? `n${i}`}
                    className="grid grid-cols-2 items-end gap-2 rounded-xl border border-bordeaux/10 bg-white p-3 sm:grid-cols-4 lg:grid-cols-8"
                  >
                    <Field label={t('product.color')}>
                      <input className="input" value={v.color} onChange={(e) => setV(i, { color: e.target.value })} />
                    </Field>
                    <Field label={t('product.size')}>
                      <input className="input" value={v.size} onChange={(e) => setV(i, { size: e.target.value })} />
                    </Field>
                    <Field label={t('product.shoe_size')}>
                      <input className="input" value={v.shoe_size} onChange={(e) => setV(i, { shoe_size: e.target.value })} />
                    </Field>
                    <Field label={t('admin.sku')}>
                      <input className="input" value={v.sku} onChange={(e) => setV(i, { sku: e.target.value })} />
                    </Field>
                    <Field label={t('prod.price_override')}>
                      <input
                        type="number"
                        step="any"
                        className="input"
                        value={v.price_override}
                        onChange={(e) => setV(i, { price_override: e.target.value })}
                      />
                    </Field>
                    <Field label={t('inv.stock')}>
                      <input
                        type="number"
                        min="0"
                        className="input"
                        value={v.stock}
                        disabled={v.existing}
                        onChange={(e) => setV(i, { stock: e.target.value })}
                      />
                    </Field>
                    <Field label={t('prod.low_threshold')}>
                      <input
                        type="number"
                        min="0"
                        className="input"
                        value={v.low_stock_threshold}
                        onChange={(e) => setV(i, { low_stock_threshold: e.target.value })}
                      />
                    </Field>
                    <button
                      type="button"
                      className="btn-ghost btn-sm text-red-700"
                      aria-label={t('common.delete')}
                      onClick={() =>
                        setForm({
                          ...form,
                          variants: form.variants.filter((_, j) => j !== i),
                          removedVariants: v.id ? [...form.removedVariants, v.id] : form.removedVariants,
                        })
                      }
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
            <button className="btn-primary w-full" disabled={busy}>
              {busy && <Spinner className="h-4 w-4" />}
              {t('common.save')}
            </button>
          </form>
        )}
      </Modal>
    </div>
  );
}
