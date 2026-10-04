import { useCities, useCountries } from '@/hooks/useData';
import { useT } from '@/i18n';
import { loc } from '@/lib/utils';
import { Field } from './ui';

interface Props {
  country: string;
  city: string;
  onChange: (v: { country: string; city: string }) => void;
  errors?: { country?: string | null; city?: string | null };
}

/** Le pays est obligatoire AVANT la ville ; la liste des villes dépend du pays choisi. */
export function CountryCitySelect({ country, city, onChange, errors }: Props) {
  const { t, lang } = useT();
  const countries = useCountries();
  const cities = useCities(country);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={`${t('geo.country')} *`} error={errors?.country}>
        <select className="input" required value={country} onChange={(e) => onChange({ country: e.target.value, city: '' })}>
          <option value="">{t('geo.select_country')}</option>
          {countries.data.map((c) => (
            <option key={c.code} value={c.code}>
              {loc(c, 'name', lang)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`${t('geo.city')} *`} error={errors?.city} hint={!country ? t('geo.select_country_first') : undefined}>
        <select
          className="input"
          required
          disabled={!country || cities.loading}
          value={city}
          onChange={(e) => onChange({ country, city: e.target.value })}
        >
          <option value="">{country ? t('geo.select_city') : t('geo.select_country_first')}</option>
          {cities.data.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
