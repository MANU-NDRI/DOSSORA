import { useEffect } from 'react';

interface SeoProps {
  title?: string;
  description?: string;
  image?: string | null;
  jsonLd?: object;
  noindex?: boolean;
}

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** SEO d'application monopage : title, description, Open Graph, JSON-LD. */
export function Seo({ title, description, image, jsonLd, noindex }: SeoProps) {
  useEffect(() => {
    const full = title ? `${title} — DOSSORA` : "DOSSORA — L'élégance à votre portée";
    document.title = full;
    if (description) {
      setMeta('name', 'description', description);
      setMeta('property', 'og:description', description);
    }
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:url', window.location.href);
    if (image) setMeta('property', 'og:image', image.startsWith('http') ? image : window.location.origin + image);
    setMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow');
    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => {
      script?.remove();
    };
  }, [title, description, image, jsonLd, noindex]);
  return null;
}
