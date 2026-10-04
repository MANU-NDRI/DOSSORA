import { Icon } from './Icon';
import { LocationMap } from './LocationMap';
import { Spinner } from './ui';
import { useT } from '@/i18n';
import { geoErrorKey } from '@/services/geolocation';
import type { useGeolocation } from '@/hooks/useGeolocation';

/** Demande de partage de position (facultative) à l'étape adresse. Aucune demande tant que le client n'a pas cliqué. */
export function LocationConsent({ geo }: { geo: ReturnType<typeof useGeolocation> }) {
  const { t } = useT();
  const { state, request, clear } = geo;
  return (
    <div className="rounded-2xl border border-gold/60 bg-gold/10 p-4" aria-live="polite">
      <div className="flex items-start gap-3">
        <Icon name="map" className="mt-0.5 h-5 w-5 shrink-0 text-bordeaux" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">{t('geo.consent_title')}</p>
          <p className="mt-0.5 text-ink/75">{t('geo.consent_text')}</p>
          {state.status === 'granted' && (
            <div className="mt-3 space-y-2">
              <p className="font-medium text-emerald-800" dir="ltr">
                📍 {state.location.latitude.toFixed(5)}, {state.location.longitude.toFixed(5)}
                {state.location.accuracy !== null ? ` · ±${Math.round(state.location.accuracy)} m` : ''}
              </p>
              <LocationMap
                latitude={state.location.latitude}
                longitude={state.location.longitude}
                title={t('geo.map_title')}
                openLabel={t('geo.open_map')}
              />
              <button type="button" className="btn-ghost btn-sm" onClick={clear}>
                {t('geo.remove')}
              </button>
            </div>
          )}
          {state.status === 'error' && (
            <p role="alert" className="mt-2 font-medium text-amber-900">
              {t(geoErrorKey(state.kind))} {t('geo.manual_hint')}
            </p>
          )}
          {state.status !== 'granted' && (
            <button type="button" className="btn-outline btn-sm mt-3" onClick={() => void request()} disabled={state.status === 'loading'}>
              {state.status === 'loading' ? (
                <>
                  <Spinner className="h-4 w-4" />
                  {t('geo.locating')}
                </>
              ) : (
                <>
                  <Icon name="map" className="h-4 w-4" />
                  {state.status === 'error' ? t('common.retry') : t('geo.use_my_location')}
                </>
              )}
            </button>
          )}
          <p className="mt-2 text-[11px] text-ink/60">{t('geo.privacy')}</p>
        </div>
      </div>
    </div>
  );
}
