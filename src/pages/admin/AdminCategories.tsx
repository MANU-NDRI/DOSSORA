import { ResourceManager, type FieldDef } from '@/components/ResourceManager';
import { useT } from '@/i18n';
import { slugify } from '@/lib/utils';

export default function AdminCategories() {
  const { t } = useT();
  const fields: FieldDef[] = [
    { name: 'name_fr', label: `${t('admin.name')} (FR)`, type: 'text', required: true, half: true },
    { name: 'name_en', label: `${t('admin.name')} (EN)`, type: 'text', half: true },
    { name: 'name_ar', label: `${t('admin.name')} (AR)`, type: 'text', half: true },
    { name: 'slug', label: t('admin.slug'), type: 'text', half: true, hint: t('admin.slug_hint') },
    { name: 'description_fr', label: `${t('admin.description')} (FR)`, type: 'textarea' },
    { name: 'description_en', label: `${t('admin.description')} (EN)`, type: 'textarea' },
    { name: 'description_ar', label: `${t('admin.description')} (AR)`, type: 'textarea' },
    { name: 'image_url', label: t('admin.image'), type: 'image' },
    { name: 'sort_order', label: t('admin.order'), type: 'number', half: true },
    { name: 'is_published', label: t('admin.published'), type: 'bool' },
  ];
  return (
    <ResourceManager
      title={t('admin.nav.categories')}
      subtitle={t('admin.category_hide_hint')}
      table="categories"
      disableDelete
      fields={fields}
      orderBy="sort_order"
      imageFolder="categories"
      cache="categories"
      defaults={{ name_fr: '', name_en: '', name_ar: '', slug: '', sort_order: 0, is_published: true, image_url: '' }}
      beforeSave={(r) => ({ ...r, slug: slugify(String(r.slug || r.name_fr)) })}
      renderRow={(r) => (
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ivory-dark">
            {r.image_url ? <img src={String(r.image_url)} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <div>
            <p className="font-semibold">{String(r.name_fr)}</p>
            <p className="text-xs text-ink/60">
              /{String(r.slug)} {r.is_published ? '' : `· ${t('admin.hidden')}`}
            </p>
          </div>
        </div>
      )}
    />
  );
}
