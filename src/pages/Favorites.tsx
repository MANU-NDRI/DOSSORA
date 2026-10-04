import { Link } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { ProductGrid, ProductGridSkeleton } from '@/components/ProductCard';
import { EmptyState, ErrorState } from '@/components/ui';
import { useT } from '@/i18n';
import { useAsync } from '@/hooks/useAsync';
import { supabase } from '@/lib/supabase';
import { PRODUCT_SELECT } from '@/services/catalog';
import { useFavorites } from '@/store/cart';
import type { Product } from '@/types';

export default function Favorites() {
  const { t } = useT();
  const ids = useFavorites((s) => s.ids);
  const { data, loading, error, reload } = useAsync(async () => {
    if (!ids.length) return [] as Product[];
    const { data: rows, error: e } = await supabase.from('products').select(PRODUCT_SELECT).in('id', ids).eq('status', 'published');
    if (e) throw e;
    return (rows ?? []) as unknown as Product[];
  }, [ids.join(',')]);
  return (
    <div className="container-x py-8 sm:py-12">
      <Seo title={t('nav.favorites')} noindex />
      <h1 className="text-3xl sm:text-4xl">{t('nav.favorites')}</h1>
      <div className="gold-rule mb-8 mt-3" />
      {loading ? (
        <ProductGridSkeleton n={4} />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : !data?.length ? (
        <EmptyState
          title={t('favorites.empty_title')}
          text={t('favorites.empty_text')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/shop" className="btn-primary">
                {t('cart.discover')}
              </Link>
              <Link to="/" className="btn-outline">
                {t('nav.back_home')}
              </Link>
            </div>
          }
        />
      ) : (
        <ProductGrid products={data} />
      )}
    </div>
  );
}
