import { ResourceManager, type FieldDef } from '@/components/ResourceManager';
import { useT } from '@/i18n';
import { loc } from '@/lib/utils';

type Row = Record<string, unknown>;

/** Aperçu fidèle du Hero (bureau + mobile) avec les textes et images en cours d'édition. */
function HeroPreview({ form }: { form: Row }) {
  const { t, lang } = useT();
  const f = form as Parameters<typeof loc>[0];
  const desktop = (form.image_desktop_url as string) || (form.image_mobile_url as string) || '';
  const mobile = (form.image_mobile_url as string) || desktop;
  const Box = ({ src, className }: { src: string; className: string }) => (
    <div className={`relative overflow-hidden rounded-xl bg-bordeaux ${className}`}>
      {src && <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div
        className="absolute inset-0 bg-gradient-to-e from-bordeaux/85 via-bordeaux/40 to-transparent"
        style={{ backgroundImage: 'linear-gradient(to right, rgba(92,23,48,.85), rgba(92,23,48,.4), transparent)' }}
      />
      <div className="relative flex h-full flex-col justify-center gap-1 p-3 text-start sm:p-4">
        <span className="font-display text-[9px] font-bold tracking-[0.4em] text-gold-light" dir="ltr">
          DOSSORA
        </span>
        <span className="font-display text-base font-semibold leading-tight text-ivory sm:text-xl">{loc(f, 'title', lang) || '—'}</span>
        <span className="line-clamp-2 text-[10px] text-ivory/85">{loc(f, 'subtitle', lang)}</span>
        <span className="mt-1 flex gap-1.5">
          <span className="rounded-full bg-gold px-2 py-0.5 text-[9px] font-semibold text-bordeaux-dark">
            {loc(f, 'button_label', lang) || t('home.hero_cta')}
          </span>
          <span className="rounded-full border border-ivory/70 px-2 py-0.5 text-[9px] text-ivory">
            {loc(f, 'button2_label', lang) || t('home.hero_cta2')}
          </span>
        </span>
      </div>
    </div>
  );
  return (
    <div className="rounded-2xl border border-gold/50 bg-ivory-dark/50 p-3">
      <p className="mb-2 text-xs font-semibold text-bordeaux">{t('hero.preview')}</p>
      <div className="flex flex-wrap items-start gap-3">
        <Box src={desktop} className="aspect-[16/8] w-full max-w-md flex-1" />
        <Box src={mobile} className="aspect-[9/16] w-28 shrink-0" />
      </div>
    </div>
  );
}

export default function AdminHomepage() {
  const { t } = useT();
  const L = (k: string, l: string) => `${t(k)} (${l})`;
  const fields: FieldDef[] = [
    { name: 'image_desktop_url', label: t('hero.image_desktop'), type: 'image', aspect: 'wide', half: true, hint: t('hero.image_hint') },
    {
      name: 'image_mobile_url',
      label: t('hero.image_mobile'),
      type: 'image',
      aspect: 'tall',
      half: true,
      hint: t('hero.image_mobile_hint'),
    },
    { name: 'title_fr', label: L('admin.title', 'FR'), type: 'text', required: true, half: true },
    { name: 'title_en', label: L('admin.title', 'EN'), type: 'text', half: true },
    { name: 'title_ar', label: L('admin.title', 'AR'), type: 'text', half: true },
    { name: 'subtitle_fr', label: L('admin.subtitle', 'FR'), type: 'text', half: true },
    { name: 'subtitle_en', label: L('admin.subtitle', 'EN'), type: 'text', half: true },
    { name: 'subtitle_ar', label: L('admin.subtitle', 'AR'), type: 'text', half: true },
    { name: 'text_fr', label: L('hero.text', 'FR'), type: 'textarea', half: true },
    { name: 'text_en', label: L('hero.text', 'EN'), type: 'textarea', half: true },
    { name: 'text_ar', label: L('hero.text', 'AR'), type: 'textarea', half: true },
    { name: 'button_label_fr', label: L('hero.button1', 'FR'), type: 'text', half: true },
    { name: 'button_label_en', label: L('hero.button1', 'EN'), type: 'text', half: true },
    { name: 'button_label_ar', label: L('hero.button1', 'AR'), type: 'text', half: true },
    { name: 'link_url', label: t('hero.link1'), type: 'text', half: true, hint: '/shop' },
    { name: 'button2_label_fr', label: L('hero.button2', 'FR'), type: 'text', half: true },
    { name: 'button2_label_en', label: L('hero.button2', 'EN'), type: 'text', half: true },
    { name: 'button2_label_ar', label: L('hero.button2', 'AR'), type: 'text', half: true },
    { name: 'link2_url', label: t('hero.link2'), type: 'text', half: true, hint: '/shop?flag=new' },
    { name: 'sort_order', label: t('hero.order'), type: 'number', half: true, hint: t('hero.order_hint') },
    { name: 'is_active', label: t('hero.published'), type: 'bool' },
  ];
  return (
    <ResourceManager
      title={t('hero.title')}
      subtitle={t('hero.subtitle')}
      table="homepage_banners"
      fields={fields}
      orderBy="sort_order"
      imageFolder="banners"
      savedMessage={t('hero.saved')}
      preview={(f) => <HeroPreview form={f} />}
      defaults={{ title_fr: '', sort_order: 0, is_active: true, link_url: '/shop', link2_url: '/shop?flag=new' }}
      renderRow={(r) => (
        <div className="flex items-center gap-3">
          <div className="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-ivory-dark">
            {r.image_desktop_url ? <img src={String(r.image_desktop_url)} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{String(r.title_fr)}</p>
            <p className="text-xs text-ink/60">
              #{String(r.sort_order)} · {r.is_active ? t('hero.published') : t('hero.draft')}
            </p>
          </div>
        </div>
      )}
    />
  );
}
