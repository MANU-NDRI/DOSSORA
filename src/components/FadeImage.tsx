import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const FALLBACK_IMAGE = '/demo/product-fallback.svg';

/** Image qui apparaît en fondu après chargement et bascule vers un visuel local si son URL échoue. */
export function FadeImage({ className, onLoad, onError, alt = '', src, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const ref = useRef<HTMLImageElement>(null);
  const fallbackUsed = useRef(false);
  const [shown, setShown] = useState(false);
  // Image déjà en cache : onLoad peut s'être déclenché avant l'hydratation.
  useEffect(() => {
    fallbackUsed.current = false;
    setShown(false);
    if (ref.current?.complete && ref.current.naturalWidth > 0) setShown(true);
  }, [src]);
  return (
    <img
      ref={ref}
      alt={alt}
      {...props}
      src={src}
      onLoad={(e) => {
        setShown(true);
        onLoad?.(e);
      }}
      onError={(e) => {
        onError?.(e);
        if (!fallbackUsed.current && src !== FALLBACK_IMAGE) {
          fallbackUsed.current = true;
          setShown(false);
          e.currentTarget.src = FALLBACK_IMAGE;
        } else setShown(true);
      }}
      className={cn(
        'transition duration-slow ease-dossora will-change-transform',
        shown ? 'scale-100 opacity-100' : 'scale-[0.98] opacity-0',
        className,
      )}
    />
  );
}
