import { ResourceManager, type FieldDef } from '@/components/ResourceManager';
import { useT } from '@/i18n';

export default function AdminPayments() {
  const { t } = useT();
  const fields: FieldDef[] = [
    { name: 'code', label: t('promo.code'), type: 'text', required: true, lockOnEdit: true, half: true },
    { name: 'sort_order', label: t('admin.order'), type: 'number', half: true },
    { name: 'name_fr', label: `${t('admin.name')} (FR)`, type: 'text', required: true, half: true },
    { name: 'name_en', label: `${t('admin.name')} (EN)`, type: 'text', half: true },
    { name: 'name_ar', label: `${t('admin.name')} (AR)`, type: 'text', half: true },
    { name: 'account_details', label: t('pay.account_details'), type: 'textarea', hint: t('pay.account_hint') },
    { name: 'instructions_fr', label: `${t('pay.instructions')} (FR)`, type: 'textarea' },
    { name: 'instructions_en', label: `${t('pay.instructions')} (EN)`, type: 'textarea' },
    { name: 'instructions_ar', label: `${t('pay.instructions')} (AR)`, type: 'textarea' },
    { name: 'morocco_only', label: t('pay.morocco_only'), type: 'bool' },
    { name: 'is_active', label: t('admin.active'), type: 'bool' },
  ];
  return (
    <ResourceManager
      title={t('admin.nav.payments')}
      table="payment_methods"
      pk="code"
      fields={fields}
      orderBy="sort_order"
      cache="payment_methods"
      defaults={{ code: '', name_fr: '', sort_order: 10, morocco_only: false, is_active: true, account_details: '' }}
      beforeSave={(r) => ({
        ...r,
        code: String(r.code)
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_'),
      })}
      renderRow={(r) => (
        <div>
          <p className="font-semibold">
            {String(r.name_fr)} <span className="text-xs font-normal text-ink/50">({String(r.code)})</span>
          </p>
          <p className="text-xs text-ink/60">
            {r.is_active ? t('admin.active') : t('admin.hidden')}
            {r.morocco_only ? ` · ${t('pay.morocco_only')}` : ''}
            {!r.account_details && r.code !== 'cod' ? ` · ⚠ ${t('pay.missing_details')}` : ''}
          </p>
        </div>
      )}
    />
  );
}
