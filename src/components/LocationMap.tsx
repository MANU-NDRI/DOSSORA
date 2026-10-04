import { osmEmbedUrl, osmLinkUrl } from '@/services/geolocation';

interface Props {
  latitude: number;
  longitude: number;
  title: string;
  openLabel: string;
  className?: string;
}

/** Carte OpenStreetMap intégrée (gratuite, sans clé ni bibliothèque) avec marqueur + lien d'ouverture. */
export function LocationMap({ latitude, longitude, title, openLabel, className }: Props) {
  return (
    <div className={className}>
      <iframe
        title={title}
        src={osmEmbedUrl(latitude, longitude)}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin"
        className="h-48 w-full rounded-xl border border-bordeaux/15 bg-ivory-dark sm:h-56"
      />
      <a href={osmLinkUrl(latitude, longitude)} target="_blank" rel="noopener noreferrer" className="link mt-1 inline-block text-xs">
        {openLabel}
      </a>
    </div>
  );
}
