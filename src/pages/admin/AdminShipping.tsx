import { useMemo, useState, type FormEvent } from 'react';
import { EmptyState, ErrorState, Field, Modal, PageHeader, Spinner } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { invalidateCache } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { errorKey } from '@/lib/errors';
import { formatMoney, loc } from '@/lib/utils';
import { useUI } from '@/store/ui';
import type { ShippingCountry } from '@/types';

interface ShippingCity {
  id: string;
  country_code: string;
  name: string;
  is_active: boolean;
}
interface ShippingRate {
  id: string;
  country_code: string;
  city: string;
  fee: number;
}
interface ShippingAdminData {
  countries: ShippingCountry[];
  cities: ShippingCity[];
  rates: ShippingRate[];
}
interface CountryForm {
  isNew: boolean;
  code: string;
  name_fr: string;
  name_en: string;
  name_ar: string;
  currency: string;
  exchange_rate: string;
  fee: string;
  free_shipping_threshold: string;
  eta_min_days: string;
  eta_max_days: string;
  is_active: boolean;
  sort_order: string;
}
interface ZoneForm {
  isNew: boolean;
  country_code: string;
  city: string;
  fee: string;
  is_active: boolean;
}
interface ShippingZoneView {
  country_code: string;
  city: string;
  fee: number;
  hasCustomRate: boolean;
  is_active: boolean;
}
type StatusFilter = 'all' | 'active' | 'inactive';
const EMPTY_COUNTRIES: ShippingCountry[] = [];

async function loadShipping(): Promise<ShippingAdminData> {
  const [countryResult, cityResult, rateResult] = await Promise.all([
    supabase.from('shipping_countries').select('*').order('sort_order').order('name_fr'),
    supabase.from('shipping_cities').select('id,country_code,name,is_active').order('country_code').order('name'),
    supabase.from('shipping_rates').select('id,country_code,city,fee').order('country_code').order('city'),
  ]);
  if (countryResult.error) throw countryResult.error;
  if (cityResult.error) throw cityResult.error;
  if (rateResult.error) throw rateResult.error;
  return {
    countries: (countryResult.data ?? []) as ShippingCountry[],
    cities: (cityResult.data ?? []) as ShippingCity[],
    rates: (rateResult.data ?? []) as ShippingRate[],
  };
}

const optionalNumber = (value: string): number | null => (value.trim() === '' ? null : Number(value));

export default function AdminShipping() {
  const { t, lang } = useT();
  const toast = useUI((s) => s.toast);
  const [countryForm, setCountryForm] = useState<CountryForm | null>(null);
  const [zoneForm, setZoneForm] = useState<ZoneForm | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useAsync(loadShipping, []);
  const countries = data?.countries ?? EMPTY_COUNTRIES;

  const zones = useMemo(() => {
    if (!data) return [];
    const ratesByZone = new Map(data.rates.map((rate) => [`${rate.country_code}:${rate.city.toLocaleLowerCase()}`, rate]));
    const citiesByZone = new Map(data.cities.map((city) => [`${city.country_code}:${city.name.toLocaleLowerCase()}`, city]));
    const keys = new Set([...ratesByZone.keys(), ...citiesByZone.keys()]);
    return [...keys]
      .map((key): ShippingZoneView | null => {
        const rate = ratesByZone.get(key);
        const city = citiesByZone.get(key);
        const countryCode = rate?.country_code ?? city?.country_code;
        const name = rate?.city ?? city?.name;
        if (!countryCode || !name) return null;
        const country = countries.find((item) => item.code === countryCode);
        return {
          country_code: countryCode,
          city: name,
          fee: rate ? Number(rate.fee) : Number(country?.fee ?? 0),
          hasCustomRate: Boolean(rate),
          is_active: city?.is_active ?? false,
        };
      })
      .filter((zone): zone is ShippingZoneView => zone !== null);
  }, [data, countries]);

  const term = search.trim().toLocaleLowerCase();
  const visibleCountries = countries.filter((country) => {
    const statusMatches = statusFilter === 'all' || country.is_active === (statusFilter === 'active');
    const textMatches = !term || [country.code, country.name_fr, country.name_en, country.name_ar].some((value) => value?.toLocaleLowerCase().includes(term));
    return statusMatches && textMatches;
  });
  const visibleZones = zones.filter((zone) => {
    const statusMatches = statusFilter === 'all' || zone.is_active === (statusFilter === 'active');
    const country = countries.find((item) => item.code === zone.country_code);
    const textMatches = !term || [zone.city, zone.country_code, country?.name_fr, country?.name_en, country?.name_ar].some((value) => value?.toLocaleLowerCase().includes(term));
    return statusMatches && textMatches;
  });

  const refreshShipping = () => {
    invalidateCache('countries');
    invalidateCache('cities');
    reload();
  };

  const openNewCountry = () => {
    setZoneForm(null);
    setCountryForm({
      isNew: true,
      code: '',
      name_fr: '',
      name_en: '',
      name_ar: '',
      currency: '',
      exchange_rate: '1',
      fee: '0',
      free_shipping_threshold: '',
      eta_min_days: '',
      eta_max_days: '',
      is_active: true,
      sort_order: '0',
    });
  };

  const editCountry = (country: ShippingCountry) => {
    setZoneForm(null);
    setCountryForm({
      isNew: false,
      code: country.code,
      name_fr: country.name_fr,
      name_en: country.name_en ?? '',
      name_ar: country.name_ar ?? '',
      currency: country.currency,
      exchange_rate: String(country.exchange_rate),
      fee: String(country.fee),
      free_shipping_threshold: country.free_shipping_threshold === null ? '' : String(country.free_shipping_threshold),
      eta_min_days: country.eta_min_days === null ? '' : String(country.eta_min_days),
      eta_max_days: country.eta_max_days === null ? '' : String(country.eta_max_days),
      is_active: country.is_active,
      sort_order: String(country.sort_order),
    });
  };

  const openNewZone = () => {
    const firstActive = countries.find((country) => country.is_active)?.code ?? '';
    setCountryForm(null);
    setZoneForm({ isNew: true, country_code: firstActive, city: '', fee: '', is_active: true });
  };

  const editZone = (zone: ShippingZoneView) => {
    setCountryForm(null);
    setZoneForm({
      isNew: false,
      country_code: zone.country_code,
      city: zone.city,
      fee: zone.hasCustomRate ? String(zone.fee) : '',
      is_active: zone.is_active,
    });
  };

  const saveCountry = async (event: FormEvent) => {
    event.preventDefault();
    if (!countryForm) return;
    const code = countryForm.code.trim().toUpperCase();
    const currency = countryForm.currency.trim().toUpperCase();
    const fee = Number(countryForm.fee);
    const exchangeRate = Number(countryForm.exchange_rate);
    const freeThreshold = optionalNumber(countryForm.free_shipping_threshold);
    const etaMin = optionalNumber(countryForm.eta_min_days);
    const etaMax = optionalNumber(countryForm.eta_max_days);
    const sortOrder = Number(countryForm.sort_order);
    if (
      !/^[A-Z]{2}$/.test(code) ||
      !countryForm.name_fr.trim() ||
      !/^[A-Z]{3}$/.test(currency) ||
      !Number.isFinite(fee) || fee < 0 ||
      !Number.isFinite(exchangeRate) || exchangeRate <= 0 ||
      (freeThreshold !== null && (!Number.isFinite(freeThreshold) || freeThreshold < 0)) ||
      (etaMin !== null && (!Number.isInteger(etaMin) || etaMin < 0)) ||
      (etaMax !== null && (!Number.isInteger(etaMax) || etaMax < 0)) ||
      !Number.isFinite(sortOrder)
    ) {
      toast('error', t('errors.INVALID_INPUT'));
      return;
    }
    if (countryForm.isNew && countries.some((country) => country.code === code)) {
      toast('error', t('ship.duplicate_country'));
      return;
    }
    setBusy(true);
    try {
      const { error: saveError } = await supabase.from('shipping_countries').upsert({
        code,
        name_fr: countryForm.name_fr.trim(),
        name_en: countryForm.name_en.trim() || null,
        name_ar: countryForm.name_ar.trim() || null,
        currency,
        exchange_rate: exchangeRate,
        fee,
        free_shipping_threshold: freeThreshold,
        eta_min_days: etaMin,
        eta_max_days: etaMax,
        is_active: countryForm.is_active,
        sort_order: sortOrder,
      });
      if (saveError) throw saveError;
      toast('success', t(countryForm.isNew ? 'ship.country_added' : 'ship.country_saved'));
      setCountryForm(null);
      refreshShipping();
    } catch (saveError) {
      toast('error', t(errorKey(saveError)));
    } finally {
      setBusy(false);
    }
  };

  const saveZone = async (event: FormEvent) => {
    event.preventDefault();
    if (!zoneForm) return;
    const city = zoneForm.city.trim();
    const fee = Number(zoneForm.fee);
    if (!zoneForm.country_code || !city || city.length > 120 || !Number.isFinite(fee) || fee < 0) {
      toast('error', t('errors.INVALID_INPUT'));
      return;
    }
    const existingRate = data?.rates.find(
      (rate) => rate.country_code === zoneForm.country_code && rate.city.toLocaleLowerCase() === city.toLocaleLowerCase(),
    );
    if (zoneForm.isNew && existingRate) {
      toast('error', t('ship.duplicate_zone'));
      return;
    }
    setBusy(true);
    try {
      const { error: rateError } = await supabase
        .from('shipping_rates')
        .upsert({ country_code: zoneForm.country_code, city, fee }, { onConflict: 'country_code,city' });
      if (rateError) throw rateError;
      const { error: cityError } = await supabase
        .from('shipping_cities')
        .upsert({ country_code: zoneForm.country_code, name: city, is_active: zoneForm.is_active }, { onConflict: 'country_code,name' });
      if (cityError) throw cityError;
      toast('success', t(zoneForm.isNew ? 'ship.zone_added' : 'ship.zone_saved'));
      setZoneForm(null);
      refreshShipping();
    } catch (saveError) {
      toast('error', t(errorKey(saveError)));
    } finally {
      setBusy(false);
    }
  };

  const setCountryActive = async (country: ShippingCountry) => {
    const { error: updateError } = await supabase
      .from('shipping_countries')
      .update({ is_active: !country.is_active })
      .eq('code', country.code);
    if (updateError) toast('error', t(errorKey(updateError)));
    else {
      toast('success', t(country.is_active ? 'ship.country_disabled' : 'ship.country_enabled'));
      refreshShipping();
    }
  };

  const setZoneActive = async (zone: ShippingZoneView) => {
    const { error: updateError } = await supabase
      .from('shipping_cities')
      .upsert({ country_code: zone.country_code, name: zone.city, is_active: !zone.is_active }, { onConflict: 'country_code,name' });
    if (updateError) toast('error', t(errorKey(updateError)));
    else {
      toast('success', t(zone.is_active ? 'ship.zone_disabled' : 'ship.zone_enabled'));
      refreshShipping();
    }
  };

  const deleteCountry = async (country: ShippingCountry) => {
    if (!window.confirm(t('common.confirm_delete'))) return;
    const { count, error: ordersError } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('country_code', country.code);
    if (ordersError) {
      toast('error', t(errorKey(ordersError)));
      return;
    }
    if ((count ?? 0) > 0) {
      toast('error', t('ship.country_has_orders'));
      return;
    }
    const { error: deleteError } = await supabase.from('shipping_countries').delete().eq('code', country.code);
    if (deleteError) toast('error', t(errorKey(deleteError)));
    else {
      toast('success', t('ship.country_deleted'));
      refreshShipping();
    }
  };

  const deleteZone = async (zone: ShippingZoneView) => {
    if (!window.confirm(t('common.confirm_delete'))) return;
    const { count, error: ordersError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('country_code', zone.country_code)
      .eq('city', zone.city);
    if (ordersError) {
      toast('error', t(errorKey(ordersError)));
      return;
    }
    if ((count ?? 0) > 0) {
      toast('error', t('ship.zone_has_orders'));
      return;
    }
    const { error: rateError } = await supabase.from('shipping_rates').delete().eq('country_code', zone.country_code).eq('city', zone.city);
    if (rateError) {
      toast('error', t(errorKey(rateError)));
      return;
    }
    const { error: cityError } = await supabase.from('shipping_cities').delete().eq('country_code', zone.country_code).eq('name', zone.city);
    if (cityError) toast('error', t(errorKey(cityError)));
    else {
      toast('success', t('ship.zone_deleted'));
      refreshShipping();
    }
  };

  const statusButton = (active: boolean, onClick: () => void) => (
    <button type="button" className="btn-outline btn-sm" onClick={onClick}>
      {active ? t('ship.disable') : t('ship.enable')}
    </button>
  );

  return (
    <div className="space-y-8">
      <PageHeader title={t('admin.nav.shipping')} subtitle={t('ship.subtitle')} />
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-sm" type="search" placeholder={t('admin.search')} value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input max-w-[220px]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} aria-label={t('ship.status_filter')}>
          <option value="all">{t('ship.all_statuses')}</option>
          <option value="active">{t('ship.active')}</option>
          <option value="inactive">{t('ship.inactive')}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <section className="space-y-3">
            <PageHeader
              title={t('ship.local_title')}
              subtitle={t('ship.local_hint')}
              actions={<button className="btn-primary btn-sm" onClick={openNewZone}><Icon name="plus" className="h-4 w-4" />{t('ship.add_zone')}</button>}
            />
            {!visibleZones.length ? <EmptyState title={t('admin.empty')} /> : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[720px] text-start text-sm">
                  <thead className="bg-ivory-dark text-xs text-bordeaux"><tr>
                    {[t('ship.country'), t('ship.city'), t('ship.fee'), t('ship.currency'), t('ship.status'), t('ship.actions')].map((label) => <th key={label} className="px-3 py-2.5 text-start">{label}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-bordeaux/10">
                    {visibleZones.map((zone) => {
                      const country = countries.find((item) => item.code === zone.country_code);
                      return <tr key={`${zone.country_code}:${zone.city}`}>
                        <td className="px-3 py-3">{country ? loc(country, 'name', lang) : zone.country_code}</td>
                        <td className="px-3 py-3">{zone.city}</td>
                        <td className="px-3 py-3" dir="ltr">{formatMoney(zone.fee, country?.currency ?? 'MAD', lang)}{!zone.hasCustomRate && <span className="ms-2 text-xs text-ink/50">{t('ship.country_default')}</span>}</td>
                        <td className="px-3 py-3" dir="ltr">{country?.currency ?? '—'}</td>
                        <td className="px-3 py-3">{zone.is_active ? t('ship.active') : t('ship.inactive')}</td>
                        <td className="px-3 py-3"><div className="flex flex-wrap gap-1">
                          <button className="btn-outline btn-sm" onClick={() => editZone(zone)} aria-label={t('common.edit')}><Icon name="edit" className="h-4 w-4" /></button>
                          {statusButton(zone.is_active, () => void setZoneActive(zone))}
                          <button className="btn-ghost btn-sm text-red-700" onClick={() => void deleteZone(zone)} aria-label={t('common.delete')}><Icon name="trash" className="h-4 w-4" /></button>
                        </div></td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <PageHeader
              title={t('ship.international_title')}
              subtitle={t('ship.international_hint')}
              actions={<button className="btn-primary btn-sm" onClick={openNewCountry}><Icon name="plus" className="h-4 w-4" />{t('ship.add_country')}</button>}
            />
            {!visibleCountries.length ? <EmptyState title={t('admin.empty')} /> : (
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[680px] text-start text-sm">
                  <thead className="bg-ivory-dark text-xs text-bordeaux"><tr>
                    {[t('ship.country'), t('ship.fee'), t('ship.currency'), t('ship.exchange_rate'), t('ship.status'), t('ship.actions')].map((label) => <th key={label} className="px-3 py-2.5 text-start">{label}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-bordeaux/10">
                    {visibleCountries.map((country) => <tr key={country.code}>
                      <td className="px-3 py-3">{loc(country, 'name', lang)} <span className="text-xs text-ink/50">({country.code})</span></td>
                      <td className="px-3 py-3" dir="ltr">{formatMoney(country.fee, country.currency, lang)}</td>
                      <td className="px-3 py-3" dir="ltr">{country.currency}</td>
                      <td className="px-3 py-3" dir="ltr">{country.exchange_rate}</td>
                      <td className="px-3 py-3">{country.is_active ? t('ship.active') : t('ship.inactive')}</td>
                      <td className="px-3 py-3"><div className="flex flex-wrap gap-1">
                        <button className="btn-outline btn-sm" onClick={() => editCountry(country)} aria-label={t('common.edit')}><Icon name="edit" className="h-4 w-4" /></button>
                        {statusButton(country.is_active, () => void setCountryActive(country))}
                        <button className="btn-ghost btn-sm text-red-700" onClick={() => void deleteCountry(country)} aria-label={t('common.delete')}><Icon name="trash" className="h-4 w-4" /></button>
                      </div></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <Modal open={!!countryForm} onClose={() => setCountryForm(null)} title={t('ship.international_title')} wide>
        {countryForm && <form onSubmit={(event) => void saveCountry(event)} className="grid gap-4 sm:grid-cols-2">
          <Field label={`${t('ship.code')} *`}><input className="input uppercase" maxLength={2} value={countryForm.code} disabled={!countryForm.isNew} onChange={(event) => setCountryForm({ ...countryForm, code: event.target.value })} required /></Field>
          <Field label={`${t('ship.currency')} *`} hint={t('ship.currency_hint')}><input className="input uppercase" maxLength={3} value={countryForm.currency} onChange={(event) => setCountryForm({ ...countryForm, currency: event.target.value })} required /></Field>
          <Field label={`${t('admin.name')} (FR) *`}><input className="input" value={countryForm.name_fr} onChange={(event) => setCountryForm({ ...countryForm, name_fr: event.target.value })} required /></Field>
          <Field label={`${t('admin.name')} (EN)`}><input className="input" value={countryForm.name_en} onChange={(event) => setCountryForm({ ...countryForm, name_en: event.target.value })} /></Field>
          <Field label={`${t('admin.name')} (AR)`}><input className="input" value={countryForm.name_ar} onChange={(event) => setCountryForm({ ...countryForm, name_ar: event.target.value })} /></Field>
          <Field label={`${t('ship.fee')} *`} hint={t('ship.fee_hint')}><input type="number" min="0" step="0.01" className="input" value={countryForm.fee} onChange={(event) => setCountryForm({ ...countryForm, fee: event.target.value })} required /></Field>
          <Field label={`${t('ship.exchange_rate')} *`} hint={t('ship.rate_hint')}><input type="number" min="0.000001" step="any" className="input" value={countryForm.exchange_rate} onChange={(event) => setCountryForm({ ...countryForm, exchange_rate: event.target.value })} required /></Field>
          <Field label={t('ship.free_threshold')} hint={t('ship.free_hint')}><input type="number" min="0" step="0.01" className="input" value={countryForm.free_shipping_threshold} onChange={(event) => setCountryForm({ ...countryForm, free_shipping_threshold: event.target.value })} /></Field>
          <Field label={t('ship.eta_min')}><input type="number" min="0" step="1" className="input" value={countryForm.eta_min_days} onChange={(event) => setCountryForm({ ...countryForm, eta_min_days: event.target.value })} /></Field>
          <Field label={t('ship.eta_max')}><input type="number" min="0" step="1" className="input" value={countryForm.eta_max_days} onChange={(event) => setCountryForm({ ...countryForm, eta_max_days: event.target.value })} /></Field>
          <Field label={t('admin.order')}><input type="number" step="1" className="input" value={countryForm.sort_order} onChange={(event) => setCountryForm({ ...countryForm, sort_order: event.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#7A1F3D]" checked={countryForm.is_active} onChange={(event) => setCountryForm({ ...countryForm, is_active: event.target.checked })} />{t('ship.active')}</label>
          <div className="sm:col-span-2"><button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('common.save')}</button></div>
        </form>}
      </Modal>

      <Modal open={!!zoneForm} onClose={() => setZoneForm(null)} title={t('ship.local_title')}>
        {zoneForm && <form onSubmit={(event) => void saveZone(event)} className="space-y-4">
          <Field label={`${t('ship.country')} *`}>
            <select className="input" value={zoneForm.country_code} disabled={!zoneForm.isNew} onChange={(event) => setZoneForm({ ...zoneForm, country_code: event.target.value })} required>
              <option value="">—</option>
              {countries.filter((country) => country.is_active || country.code === zoneForm.country_code).map((country) => <option key={country.code} value={country.code}>{loc(country, 'name', lang)} ({country.code})</option>)}
            </select>
          </Field>
          <Field label={`${t('ship.city')} *`}><input className="input" maxLength={120} value={zoneForm.city} disabled={!zoneForm.isNew} onChange={(event) => setZoneForm({ ...zoneForm, city: event.target.value })} required /></Field>
          <Field label={`${t('ship.fee')} *`} hint={t('ship.zone_fee_hint', { currency: countries.find((country) => country.code === zoneForm.country_code)?.currency ?? '' })}>
            <input type="number" min="0" step="0.01" className="input" value={zoneForm.fee} onChange={(event) => setZoneForm({ ...zoneForm, fee: event.target.value })} required />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#7A1F3D]" checked={zoneForm.is_active} onChange={(event) => setZoneForm({ ...zoneForm, is_active: event.target.checked })} />{t('ship.active')}</label>
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner className="h-4 w-4" />}{t('common.save')}</button>
        </form>}
      </Modal>
    </div>
  );
}
