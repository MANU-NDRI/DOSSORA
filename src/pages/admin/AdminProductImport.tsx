import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ErrorState, Field, PageHeader, Spinner } from '@/components/ui';
import { useT } from '@/i18n';
import { errorKey } from '@/lib/errors';
import { reportError } from '@/lib/diagnostics';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types';
import type { Database } from '@/types/database';
import {
  createExcelTemplate,
  detectImportMapping,
  exportCsv,
  IMPORT_BATCH_SIZE,
  IMPORT_FIELDS,
  parseImportFile,
  ProductImportError,
  slugForImportedProduct,
  templateExample,
  templateHeaders,
  validateImportRows,
  type ImportField,
  type ImportIssue,
  type ImportMapping,
  type ImportPreview,
  type ValidImportRow,
} from '@/services/productImport';

type DuplicateMode = 'new' | 'update' | 'merge';
type ExistingProduct = {
  id: string;
  sku: string;
  slug: string;
  name_fr: string;
  price: number;
  sale_price: number | null;
  category_id: string | null;
  status: string;
};
type ExistingVariant = {
  id: string;
  sku: string | null;
  product_id: string;
  color: string | null;
  size: string | null;
  shoe_size: string | null;
  price_override: number | null;
  stock: number;
  reserved: number;
  low_stock_threshold: number;
};
type RowResult = {
  line: number;
  productSku: string;
  variantSku: string;
  outcome: 'added' | 'updated' | 'skipped' | 'error';
  messageKey?: string;
};
type ImportResult = {
  analyzed: number;
  productsAdded: number;
  productsUpdated: number;
  productsSkipped: number;
  skipped: number;
  errors: number;
  durationMs: number;
  rows: RowResult[];
};

const FIELD_TRANSLATION: Record<ImportField, string> = Object.fromEntries(
  IMPORT_FIELDS.map((field) => [field, `productImport.fields.${field}`]),
) as Record<ImportField, string>;

function saveFile(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

function distinct<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function productInsert(row: ValidImportRow): Database['public']['Tables']['products']['Insert'] {
  return {
    slug: slugForImportedProduct(row.product.name_fr, row.product.sku),
    sku: row.product.sku,
    name_fr: row.product.name_fr,
    name_en: row.product.name_en,
    name_ar: row.product.name_ar,
    description_fr: row.product.description_fr,
    description_en: row.product.description_en,
    description_ar: row.product.description_ar,
    price: row.product.price,
    sale_price: row.product.sale_price,
    category_id: row.product.category_id,
    status: row.product.status,
    is_featured: row.product.is_featured,
    is_popular: row.product.is_popular,
    is_new: row.product.is_new,
    is_on_sale: row.product.is_on_sale,
  };
}

export default function AdminProductImport() {
  const { t } = useT();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryError, setCategoryError] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<Awaited<ReturnType<typeof parseImportFile>> | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [products, setProducts] = useState<Map<string, ExistingProduct>>(new Map());
  const [variants, setVariants] = useState<Map<string, ExistingVariant>>(new Map());
  const [mode, setMode] = useState<DuplicateMode>('new');
  const [busy, setBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stage, setStage] = useState<'file' | 'preview' | 'confirm' | 'progress' | 'result'>('file');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase
      .from('categories')
      .select('*')
      .order('sort_order')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          reportError('Chargement des catégories pour import', error);
          setCategoryError(true);
        } else setCategories((data ?? []) as Category[]);
        setCategoriesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const issuesByLine = useMemo(() => {
    const grouped = new Map<number, ImportIssue[]>();
    for (const issue of preview?.issues ?? []) grouped.set(issue.line, [...(grouped.get(issue.line) ?? []), issue]);
    return grouped;
  }, [preview]);

  const productGroups = useMemo(() => {
    const groups = new Map<string, ValidImportRow[]>();
    for (const row of preview?.rows ?? []) groups.set(row.product.sku, [...(groups.get(row.product.sku) ?? []), row]);
    return groups;
  }, [preview]);

  const updateCounts = useMemo(() => {
    let productsToAdd = 0;
    let productsToUpdate = 0;
    let variantsToAdd = 0;
    let variantsToUpdate = 0;
    let skipped = 0;
    for (const [sku, group] of productGroups) {
      const existingProduct = products.get(sku.toLocaleLowerCase());
      if (mode === 'new' && existingProduct) {
        skipped += group.length;
        continue;
      }
      if (mode === 'update' && !existingProduct) {
        skipped += group.length;
        continue;
      }
      if (existingProduct) productsToUpdate += 1;
      else productsToAdd += 1;
      for (const row of group) {
        const existingVariant = variants.get(row.variant.sku.toLocaleLowerCase());
        if (existingVariant && existingVariant.product_id === existingProduct?.id) variantsToUpdate += 1;
        else if (mode !== 'update') variantsToAdd += 1;
        else skipped += 1;
      }
    }
    return { productsToAdd, productsToUpdate, variantsToAdd, variantsToUpdate, skipped };
  }, [mode, productGroups, products, variants]);

  const processFile = async (file: File) => {
    setErrorMessage('');
    setFileName(file.name);
    setParsed(null);
    setPreview(null);
    setResult(null);
    setStage('file');
    try {
      const data = await parseImportFile(file);
      setParsed(data);
      setMapping(detectImportMapping(data.headers));
    } catch (error) {
      if (error instanceof ProductImportError) setErrorMessage(error.messageKey);
      else {
        reportError('Lecture du fichier d’import produits', error);
        setErrorMessage('productImport.errors.unreadable');
      }
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void processFile(file);
  };

  const fetchExisting = async (rows: ValidImportRow[]) => {
    const productSkus = distinct(rows.map((row) => row.product.sku));
    const variantSkus = distinct(rows.map((row) => row.variant.sku));
    const foundProducts: ExistingProduct[] = [];
    const foundVariants: ExistingVariant[] = [];
    for (const batch of chunks(productSkus, IMPORT_BATCH_SIZE)) {
      const { data, error } = await supabase
        .from('products')
        .select('id,sku,slug,name_fr,price,sale_price,category_id,status')
        .in('sku', batch);
      if (error) throw error;
      foundProducts.push(...((data ?? []) as ExistingProduct[]));
    }
    for (const batch of chunks(variantSkus, IMPORT_BATCH_SIZE)) {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id,sku,product_id,color,size,shoe_size,price_override,stock,reserved,low_stock_threshold')
        .in('sku', batch);
      if (error) throw error;
      foundVariants.push(...((data ?? []) as ExistingVariant[]));
    }
    const productMap = new Map(foundProducts.map((item) => [item.sku.toLocaleLowerCase(), item]));
    const variantMap = new Map(
      foundVariants
        .filter((item): item is ExistingVariant & { sku: string } => item.sku !== null)
        .map((item) => [item.sku.toLocaleLowerCase(), item]),
    );
    setProducts(productMap);
    setVariants(variantMap);
    return { products: productMap, variants: variantMap };
  };

  const buildPreview = async () => {
    if (!parsed) return;
    setBusy(true);
    setErrorMessage('');
    try {
      const next = validateImportRows(parsed, mapping, categories);
      if (next.rows.length) {
        const existing = await fetchExisting(next.rows);
        const conflicts = next.rows.filter((row) => {
          const product = existing.products.get(row.product.sku.toLocaleLowerCase());
          const variant = existing.variants.get(row.variant.sku.toLocaleLowerCase());
          return Boolean(variant && variant.product_id !== product?.id);
        });
        for (const row of conflicts)
          next.issues.push({ line: row.line, field: 'variant_sku', messageKey: 'productImport.errors.variantBelongsToAnotherProduct' });
        if (conflicts.length) {
          const lines = new Set(conflicts.map((row) => row.line));
          next.rows = next.rows.filter((row) => !lines.has(row.line));
        }
      }
      setPreview(next);
      setStage('preview');
    } catch (error) {
      reportError('Prévisualisation de l’import produits', error);
      setErrorMessage(errorKey(error));
    } finally {
      setBusy(false);
    }
  };

  const templateCsv = () => {
    const csv = exportCsv([templateHeaders(), templateExample()]);
    saveFile('modele-import-produits.csv', new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  };

  const templateXlsx = async () => {
    setTemplateBusy(true);
    try {
      const blob = await createExcelTemplate();
      saveFile('modele-import-produits.xlsx', blob);
    } catch (error) {
      reportError('Création du modèle Excel', error);
      setErrorMessage('productImport.errors.template');
    } finally {
      setTemplateBusy(false);
    }
  };

  const runImport = async () => {
    if (!preview || !parsed) return;
    const started = performance.now();
    const output: RowResult[] = [];
    let productsAdded = 0;
    let productsUpdated = 0;
    let productsSkipped = 0;
    let skipped = 0;
    let done = 0;
    let networkInterrupted = false;
    let stoppedError: string | null = null;
    const groups = [...productGroups.entries()];
    const productIds = new Map<string, string>();
    const productCreationErrors = new Map<string, unknown>();
    for (const line of distinct(preview.issues.filter((issue) => issue.line > 1).map((issue) => issue.line))) {
      const source = parsed.rows.find((row) => row.line === line);
      const variantIndex = mapping.variant_sku;
      output.push({
        line,
        productSku: source?.cells[mapping.product_sku ?? -1] ?? '',
        variantSku: variantIndex === undefined ? '' : (source?.cells[variantIndex] ?? ''),
        outcome: 'error',
        messageKey: preview.issues.find((issue) => issue.line === line)?.messageKey ?? 'productImport.errors.generic',
      });
    }
    setStage('progress');
    setProgress({ done: 0, total: groups.length });
    setBusy(true);
    const parentsToCreate = groups.filter(([sku]) => mode !== 'update' && !products.has(sku.toLocaleLowerCase()));
    for (const batch of chunks(parentsToCreate, IMPORT_BATCH_SIZE)) {
      const records = batch.map(([, group]) => productInsert(group[0]));
      const { data, error } = await supabase.from('products').insert(records).select('id,sku');
      if (!error) {
        const createdProducts = new Map<string, ExistingProduct>();
        for (const [sku, group] of batch) {
          const inserted = data?.find((row) => row.sku?.toLocaleLowerCase() === sku.toLocaleLowerCase());
          if (!inserted?.id) {
            productCreationErrors.set(sku.toLocaleLowerCase(), new Error('Product insert did not return an id'));
            continue;
          }
          const first = group[0];
          productIds.set(sku.toLocaleLowerCase(), inserted.id);
          createdProducts.set(sku.toLocaleLowerCase(), {
            id: inserted.id,
            sku,
            slug: slugForImportedProduct(first.product.name_fr, sku),
            name_fr: first.product.name_fr,
            price: first.product.price,
            sale_price: first.product.sale_price,
            category_id: first.product.category_id,
            status: first.product.status,
          });
          productsAdded += 1;
        }
        setProducts((current) => new Map([...current, ...createdProducts]));
      } else {
        reportError('Import groupé des produits', error);
        if (errorKey(error) === 'errors.network' || errorKey(error) === 'errors.FORBIDDEN') {
          networkInterrupted = errorKey(error) === 'errors.network';
          stoppedError = networkInterrupted ? null : errorKey(error);
          for (const [sku] of batch) productCreationErrors.set(sku.toLocaleLowerCase(), error);
        } else {
          for (const [sku, group] of batch) {
            if (networkInterrupted || stoppedError) break;
            const { data: inserted, error: singleError } = await supabase
              .from('products')
              .insert(productInsert(group[0]))
              .select('id')
              .single();
            if (singleError) {
              reportError(`Import produit ${sku}`, singleError);
              productCreationErrors.set(sku.toLocaleLowerCase(), singleError);
              if (errorKey(singleError) === 'errors.network') networkInterrupted = true;
              if (errorKey(singleError) === 'errors.FORBIDDEN') stoppedError = 'errors.FORBIDDEN';
              continue;
            }
            const first = group[0];
            productIds.set(sku.toLocaleLowerCase(), inserted.id);
            productsAdded += 1;
            setProducts((current) =>
              new Map(current).set(sku.toLocaleLowerCase(), {
                id: inserted.id,
                sku,
                slug: slugForImportedProduct(first.product.name_fr, sku),
                name_fr: first.product.name_fr,
                price: first.product.price,
                sale_price: first.product.sale_price,
                category_id: first.product.category_id,
                status: first.product.status,
              }),
            );
          }
        }
      }
      if (networkInterrupted || stoppedError) break;
    }

    for (const [sku, group] of groups) {
      if (networkInterrupted || stoppedError) {
        output.push(
          ...group.map((row) => ({
            line: row.line,
            productSku: sku,
            variantSku: row.variant.sku,
            outcome: 'error' as const,
            messageKey: networkInterrupted ? 'errors.network' : (stoppedError ?? 'productImport.errors.generic'),
          })),
        );
        done += 1;
        setProgress({ done, total: groups.length });
        continue;
      }
      const existing = products.get(sku.toLocaleLowerCase());
      if ((mode === 'new' && existing) || (mode === 'update' && !existing)) {
        productsSkipped += 1;
        skipped += group.length;
        output.push(...group.map((row) => ({ line: row.line, productSku: sku, variantSku: row.variant.sku, outcome: 'skipped' as const })));
        done += 1;
        setProgress({ done, total: groups.length });
        continue;
      }

      const productId = existing?.id ?? productIds.get(sku.toLocaleLowerCase());
      try {
        const first = group[0];
        const original = parsed.rows.find((row) => row.line === first.line);
        const hasValue = (field: ImportField) => {
          const index = mapping[field];
          return index !== undefined && Boolean(original?.cells[index]?.trim());
        };
        if (existing) {
          const productPatch: Database['public']['Tables']['products']['Update'] = {
            slug: existing.slug,
            sku: first.product.sku,
            name_fr: first.product.name_fr,
            price: first.product.price,
          };
          if (hasValue('name_en')) productPatch.name_en = first.product.name_en;
          if (hasValue('name_ar')) productPatch.name_ar = first.product.name_ar;
          if (hasValue('description_fr')) productPatch.description_fr = first.product.description_fr;
          if (hasValue('description_en')) productPatch.description_en = first.product.description_en;
          if (hasValue('description_ar')) productPatch.description_ar = first.product.description_ar;
          if (hasValue('sale_price')) productPatch.sale_price = first.product.sale_price;
          if (hasValue('category')) productPatch.category_id = first.product.category_id;
          if (hasValue('status')) productPatch.status = first.product.status;
          if (hasValue('is_featured')) productPatch.is_featured = first.product.is_featured;
          if (hasValue('is_popular')) productPatch.is_popular = first.product.is_popular;
          if (hasValue('is_new')) productPatch.is_new = first.product.is_new;
          if (hasValue('is_on_sale')) productPatch.is_on_sale = first.product.is_on_sale;
          if (hasValue('sale_price') && first.product.sale_price !== null && !hasValue('is_on_sale')) productPatch.is_on_sale = true;
          const { error } = await supabase.from('products').update(productPatch).eq('id', existing.id);
          if (error) throw error;
          productsUpdated += 1;
        } else if (!productId) throw productCreationErrors.get(sku.toLocaleLowerCase()) ?? new Error('Product insert failed');
        if (!productId) throw new Error('Product insert did not return an id');
        const savedProductId = productId;

        const images = first.product.image_urls;
        const imagesMapped = mapping.images !== undefined && images.length > 0;
        if (imagesMapped) {
          const { data: currentImages, error: readError } = await supabase
            .from('product_images')
            .select('id,url,sort_order')
            .eq('product_id', savedProductId);
          if (readError) throw readError;
          const current = currentImages ?? [];
          const missing = images.map((url, index) => ({ url, index })).filter(({ url }) => !current.some((image) => image.url === url));
          if (missing.length) {
            const { error } = await supabase
              .from('product_images')
              .insert(
                missing.map(({ url, index }) => ({ product_id: savedProductId, url, alt: first.product.name_fr, sort_order: index })),
              );
            if (error) throw error;
          }
          for (const [index, url] of images.entries()) {
            const image = current.find((item) => item.url === url);
            if (image && image.sort_order !== index) {
              const { error } = await supabase.from('product_images').update({ sort_order: index }).eq('id', image.id);
              if (error) throw error;
            }
          }
          const remove = current.filter((image) => !images.includes(image.url)).map((image) => image.id);
          if (remove.length) {
            const { error } = await supabase.from('product_images').delete().in('id', remove);
            if (error) throw error;
          }
        }
      } catch (error) {
        reportError(`Import produit ${sku}`, error);
        if (errorKey(error) === 'errors.network') networkInterrupted = true;
        if (errorKey(error) === 'errors.FORBIDDEN') stoppedError = 'errors.FORBIDDEN';
        output.push(
          ...group.map((row) => ({
            line: row.line,
            productSku: sku,
            variantSku: row.variant.sku,
            outcome: 'error' as const,
            messageKey: errorKey(error),
          })),
        );
        done += 1;
        setProgress({ done, total: groups.length });
        continue;
      }

      if (!productId) {
        for (const row of group)
          output.push({
            line: row.line,
            productSku: sku,
            variantSku: row.variant.sku,
            outcome: 'error',
            messageKey: 'productImport.errors.generic',
          });
        continue;
      }
      const targetProductId = productId;
      for (const row of group) {
        if (networkInterrupted || stoppedError) {
          output.push({
            line: row.line,
            productSku: sku,
            variantSku: row.variant.sku,
            outcome: 'error',
            messageKey: networkInterrupted ? 'errors.network' : (stoppedError ?? 'productImport.errors.generic'),
          });
          continue;
        }
        try {
          const previous = variants.get(row.variant.sku.toLocaleLowerCase());
          if (previous && previous.product_id !== targetProductId) throw new Error('productImport.errors.variantBelongsToAnotherProduct');
          if (previous && mode === 'new') {
            skipped += 1;
            output.push({ line: row.line, productSku: sku, variantSku: row.variant.sku, outcome: 'skipped' });
            continue;
          }
          if (!previous && mode === 'update') {
            skipped += 1;
            output.push({ line: row.line, productSku: sku, variantSku: row.variant.sku, outcome: 'skipped' });
            continue;
          }
          const source = parsed.rows.find((item) => item.line === row.line);
          const hasValue = (field: ImportField) => {
            const index = mapping[field];
            return index !== undefined && Boolean(source?.cells[index]?.trim());
          };
          if (previous) {
            const patch: Database['public']['Tables']['product_variants']['Update'] = {};
            if (hasValue('color')) patch.color = row.variant.color;
            if (hasValue('size')) patch.size = row.variant.size;
            if (hasValue('shoe_size')) patch.shoe_size = row.variant.shoe_size;
            if (hasValue('price_override')) patch.price_override = row.variant.price_override;
            if (hasValue('low_stock_threshold')) patch.low_stock_threshold = row.variant.low_stock_threshold;
            if (Object.keys(patch).length) {
              const { error } = await supabase.from('product_variants').update(patch).eq('id', previous.id);
              if (error) throw error;
            }
            const delta = row.variant.stock - previous.stock;
            if (delta) {
              const { error } = await supabase.rpc('admin_adjust_stock', {
                p_variant: previous.id,
                p_delta: delta,
                p_reason: 'correction',
                p_note: 'Import produits',
              });
              if (error) throw error;
            }
            setVariants((current) =>
              new Map(current).set(row.variant.sku.toLocaleLowerCase(), {
                ...previous,
                ...patch,
                stock: row.variant.stock,
              }),
            );
            output.push({ line: row.line, productSku: sku, variantSku: row.variant.sku, outcome: 'updated' });
          } else {
            const { data, error } = await supabase
              .from('product_variants')
              .insert({
                product_id: productId,
                sku: row.variant.sku,
                color: row.variant.color,
                size: row.variant.size,
                shoe_size: row.variant.shoe_size,
                price_override: row.variant.price_override,
                stock: 0,
                low_stock_threshold: row.variant.low_stock_threshold,
              })
              .select('id')
              .single();
            if (error) throw error;
            if (row.variant.stock) {
              const { error: stockError } = await supabase.rpc('admin_adjust_stock', {
                p_variant: data.id,
                p_delta: row.variant.stock,
                p_reason: 'initial',
                p_note: 'Import produits',
              });
              if (stockError) throw stockError;
            }
            setVariants((current) =>
              new Map(current).set(row.variant.sku.toLocaleLowerCase(), {
                id: data.id,
                sku: row.variant.sku,
                product_id: targetProductId,
                color: row.variant.color,
                size: row.variant.size,
                shoe_size: row.variant.shoe_size,
                price_override: row.variant.price_override,
                stock: row.variant.stock,
                reserved: 0,
                low_stock_threshold: row.variant.low_stock_threshold,
              }),
            );
            output.push({ line: row.line, productSku: sku, variantSku: row.variant.sku, outcome: 'added' });
          }
        } catch (error) {
          reportError(`Import variante ${row.variant.sku}`, error);
          if (errorKey(error) === 'errors.network') networkInterrupted = true;
          if (errorKey(error) === 'errors.FORBIDDEN') stoppedError = 'errors.FORBIDDEN';
          output.push({
            line: row.line,
            productSku: sku,
            variantSku: row.variant.sku,
            outcome: 'error',
            messageKey: error instanceof Error && error.message.startsWith('productImport.') ? error.message : errorKey(error),
          });
        }
      }
      done += 1;
      setProgress({ done, total: groups.length });
    }

    const errors = output.filter((row) => row.outcome === 'error').length;
    setResult({
      analyzed: preview.totalRows,
      productsAdded,
      productsUpdated,
      productsSkipped,
      skipped,
      errors,
      durationMs: Math.max(0, Math.round(performance.now() - started)),
      rows: output,
    });
    setStage('result');
    setBusy(false);
  };

  const downloadErrorReport = () => {
    if (!parsed) return;
    const failed = result?.rows.filter((row) => row.outcome === 'error') ?? [];
    const lines = distinct([
      ...failed.map((row) => row.line),
      ...(preview?.issues.filter((issue) => issue.line > 0).map((issue) => issue.line) ?? []),
    ]).sort((a, b) => a - b);
    const rows = [
      ['line', ...parsed.headers, 'error'],
      ...lines.map((line) => {
        const item = failed.find((row) => row.line === line);
        const source = parsed.rows.find((row) => row.line === line);
        const rowIssues = preview?.issues.filter((issue) => issue.line === line) ?? [];
        const reason =
          rowIssues.length > 0
            ? rowIssues
                .map(
                  (issue) =>
                    `${issue.field ? t(FIELD_TRANSLATION[issue.field]) : t('productImport.productFields')}: ${t(issue.messageKey)}`,
                )
                .join(' | ')
            : item?.messageKey
              ? t(item.messageKey)
              : t('productImport.errors.generic');
        return [String(line), ...(source?.cells ?? []), reason];
      }),
    ];
    saveFile('rapport-erreurs-import.csv', new Blob([exportCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  };

  const downloadFullReport = () => {
    if (!result || !parsed) return;
    const rows = [
      ['line', ...parsed.headers, 'product_sku', 'variant_sku', 'status', 'details'],
      ...result.rows.map((item) => {
        const source = parsed.rows.find((row) => row.line === item.line);
        const details = item.messageKey ? t(item.messageKey) : '';
        return [
          String(item.line),
          ...(source?.cells ?? []),
          item.productSku,
          item.variantSku,
          t(`productImport.rowStatus.${item.outcome}`),
          details,
        ];
      }),
    ];
    saveFile('rapport-import-produits.csv', new Blob([exportCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  };

  const modeLabel: Record<DuplicateMode, string> = {
    new: t('productImport.mode.new'),
    update: t('productImport.mode.update'),
    merge: t('productImport.mode.merge'),
  };
  const allIssues = preview?.issues ?? [];
  const validRowCount = preview?.rows.length ?? 0;
  const invalidRowCount = distinct(allIssues.filter((issue) => issue.line > 1).map((issue) => issue.line)).length;

  return (
    <div>
      <PageHeader
        title={t('productImport.title')}
        actions={
          <Link className="btn-outline btn-sm" to="/admin/products">
            <Icon name="left" className="h-4 w-4" />
            {t('productImport.back')}
          </Link>
        }
      />
      <ol className="mb-5 grid gap-2 text-xs sm:grid-cols-4">
        {(['stepFile', 'stepMap', 'stepReview', 'stepImport'] as const).map((key, index) => (
          <li
            key={key}
            className={`rounded-lg px-3 py-2 ${index <= (stage === 'file' ? 0 : stage === 'preview' ? 2 : 3) ? 'bg-bordeaux text-ivory' : 'bg-ivory-dark text-ink/60'}`}
          >
            {index + 1}. {t(`productImport.${key}`)}
          </li>
        ))}
      </ol>

      {errorMessage && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {t(errorMessage)}
        </p>
      )}
      {categoryError ? <ErrorState onRetry={() => window.location.reload()} /> : null}

      {stage === 'file' && (
        <section className="card space-y-5 p-4 sm:p-6">
          <div>
            <h2 className="font-semibold">{t('productImport.chooseFile')}</h2>
            <p className="mt-1 text-sm text-ink/70">{t('productImport.fileHelp')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline btn-sm" type="button" onClick={templateCsv}>
              <Icon name="download" className="h-4 w-4" /> CSV
            </button>
            <button className="btn-outline btn-sm" type="button" onClick={() => void templateXlsx()} disabled={templateBusy}>
              {templateBusy ? <Spinner className="h-4 w-4" /> : <Icon name="download" className="h-4 w-4" />} Excel
            </button>
          </div>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-10 ${isDragging ? 'border-bordeaux bg-bordeaux/5' : 'border-bordeaux/25'}`}
          >
            <Icon name="upload" className="mx-auto mb-3 h-8 w-8 text-bordeaux" />
            <p className="font-medium">{t('productImport.dropFile')}</p>
            <label className="btn-primary btn-sm mt-3 inline-flex cursor-pointer">
              {t('productImport.selectFile')}
              <input
                type="file"
                accept=".csv,.xlsx"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void processFile(file);
                  event.currentTarget.value = '';
                }}
              />
            </label>
            {fileName && <p className="mt-3 text-sm">{fileName}</p>}
          </div>
          {parsed && (
            <>
              <p className="text-sm text-emerald-800">{t('productImport.fileReady', { rows: parsed.rows.length })}</p>
              <div className="rounded-xl bg-ivory-dark/60 p-4">
                <h3 className="mb-3 font-semibold">{t('productImport.mappingTitle')}</h3>
                <p className="mb-3 text-xs text-ink/70">{t('productImport.mappingHelp')}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {IMPORT_FIELDS.map((field) => (
                    <Field
                      key={field}
                      label={`${t(FIELD_TRANSLATION[field])}${['product_sku', 'variant_sku', 'name_fr', 'price', 'stock'].includes(field) ? ' *' : ''}`}
                    >
                      <select
                        className="input"
                        value={mapping[field] ?? ''}
                        onChange={(event) =>
                          setMapping((current) => ({
                            ...current,
                            [field]: event.target.value === '' ? undefined : Number(event.target.value),
                          }))
                        }
                      >
                        <option value="">{t('productImport.ignoreColumn')}</option>
                        {parsed.headers.map((header, index) => (
                          <option key={`${header}-${index}`} value={index}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  className="btn-primary"
                  type="button"
                  disabled={busy || categoriesLoading || categoryError}
                  onClick={() => void buildPreview()}
                >
                  {busy ? <Spinner className="h-4 w-4" /> : null}
                  {t('productImport.preview')}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {stage === 'preview' && preview && (
        <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [t('productImport.totalRows'), preview.totalRows],
              [t('productImport.validRows'), validRowCount],
              [t('productImport.invalidRows'), invalidRowCount],
            ].map(([label, value]) => (
              <div key={label} className="card p-4">
                <p className="text-sm text-ink/65">{label}</p>
                <p className="mt-1 text-2xl font-semibold text-bordeaux">{value}</p>
              </div>
            ))}
          </div>
          {allIssues.length > 0 && (
            <div className="card overflow-hidden">
              <h2 className="p-4 font-semibold text-red-800">{t('productImport.rowErrors', { count: allIssues.length })}</h2>
              <div className="max-h-64 overflow-auto border-t border-red-100">
                <ul className="divide-y divide-red-100">
                  {allIssues.map((issue, index) => (
                    <li key={`${issue.line}-${issue.field}-${index}`} className="px-4 py-2 text-sm text-red-800">
                      {issue.line === 1
                        ? t('productImport.mappingError', { field: issue.field ? t(FIELD_TRANSLATION[issue.field]) : '' })
                        : t('productImport.rowError', {
                            line: issue.line,
                            field: issue.field ? t(FIELD_TRANSLATION[issue.field]) : t('productImport.productFields'),
                            reason: t(issue.messageKey),
                          })}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-4 pb-4">
                <button className="btn-outline btn-sm" type="button" onClick={downloadErrorReport}>
                  <Icon name="download" className="h-4 w-4" />
                  {t('productImport.downloadErrors')}
                </button>
              </div>
            </div>
          )}
          <div className="card overflow-x-auto">
            <h2 className="p-4 font-semibold">{t('productImport.firstRows')}</h2>
            <table className="w-full min-w-[760px] text-start text-sm">
              <thead className="bg-ivory-dark text-xs text-bordeaux">
                <tr>
                  {[
                    'productImport.line',
                    'productImport.productSku',
                    'productImport.variantSku',
                    'admin.name',
                    'prod.category',
                    'prod.price',
                    'inv.stock',
                    'productImport.state',
                  ].map((key) => (
                    <th key={key} className="px-3 py-2 text-start">
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-bordeaux/10">
                {parsed?.rows.slice(0, 10).map((source) => {
                  const valid = preview.rows.find((row) => row.line === source.line);
                  const raw = (field: ImportField) => {
                    const index = mapping[field];
                    return index === undefined ? '' : (source.cells[index] ?? '');
                  };
                  const productSku = valid?.product.sku ?? raw('product_sku');
                  const variantSku = valid?.variant.sku ?? raw('variant_sku');
                  const existingProduct = products.get(productSku.toLocaleLowerCase());
                  const existingVariant = variants.get(variantSku.toLocaleLowerCase());
                  return (
                    <tr key={source.line}>
                      <td className="px-3 py-2">{source.line}</td>
                      <td className="px-3 py-2">{productSku}</td>
                      <td className="px-3 py-2">{variantSku}</td>
                      <td className="px-3 py-2">{valid?.product.name_fr ?? raw('name_fr')}</td>
                      <td className="px-3 py-2">
                        {(categories.find((category) => category.id === valid?.product.category_id)?.name_fr ?? raw('category')) || '—'}
                      </td>
                      <td className="px-3 py-2">
                        {valid
                          ? `${existingProduct && existingProduct.price !== valid.product.price ? `${existingProduct.price} → ` : ''}${valid.product.price}`
                          : raw('price')}
                      </td>
                      <td className="px-3 py-2">
                        {valid
                          ? existingVariant
                            ? `${existingVariant.stock} → ${valid.variant.stock}`
                            : valid.variant.stock
                          : raw('stock')}
                      </td>
                      <td className="px-3 py-2">
                        {issuesByLine.has(source.line)
                          ? t('productImport.invalid')
                          : existingProduct || existingVariant
                            ? t('productImport.existing')
                            : t('productImport.new')}
                      </td>
                    </tr>
                  );
                })}
                {!parsed?.rows.length && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center">
                      {t('productImport.noValidRows')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="card space-y-4 p-4 sm:p-5">
            <Field label={t('productImport.duplicateMode')}>
              <select className="input max-w-xl" value={mode} onChange={(event) => setMode(event.target.value as DuplicateMode)}>
                <option value="new">{modeLabel.new}</option>
                <option value="update">{modeLabel.update}</option>
                <option value="merge">{modeLabel.merge}</option>
              </select>
            </Field>
            <p className="text-sm font-medium">
              {t('productImport.changeSummary', {
                addProducts: updateCounts.productsToAdd,
                updateProducts: updateCounts.productsToUpdate,
                addVariants: updateCounts.variantsToAdd,
                updateVariants: updateCounts.variantsToUpdate,
                skip: updateCounts.skipped,
              })}
            </p>
            <p className="text-xs text-ink/65">{t('productImport.updateNotice')}</p>
            <p className="text-xs text-ink/65">{t('productImport.partialWarning')}</p>
            <div className="flex flex-wrap justify-between gap-2">
              <button className="btn-outline" type="button" onClick={() => setStage('file')}>
                {' '}
                {t('productImport.back')}
              </button>
              <button
                className="btn-primary"
                type="button"
                disabled={
                  !preview.rows.length ||
                  updateCounts.productsToAdd +
                    updateCounts.productsToUpdate +
                    updateCounts.variantsToAdd +
                    updateCounts.variantsToUpdate ===
                    0
                }
                onClick={() => setStage('confirm')}
              >
                {t('productImport.confirmStep')}
              </button>
            </div>
          </div>
        </section>
      )}

      {stage === 'confirm' && (
        <section className="card space-y-4 p-5">
          <h2 className="text-lg font-semibold">{t('productImport.confirmTitle')}</h2>
          <p className="text-sm">{t('productImport.confirmMessage', { mode: modeLabel[mode], count: validRowCount })}</p>
          <p className="text-sm font-semibold">
            {t('productImport.changeSummary', {
              addProducts: updateCounts.productsToAdd,
              updateProducts: updateCounts.productsToUpdate,
              addVariants: updateCounts.variantsToAdd,
              updateVariants: updateCounts.variantsToUpdate,
              skip: updateCounts.skipped,
            })}
          </p>
            <p className="text-xs text-ink/65">{t('productImport.updateNotice')}</p>
            <p className="text-xs text-ink/65">{t('productImport.partialWarning')}</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button className="btn-outline" type="button" onClick={() => setStage('preview')}>
              {t('common.cancel')}
            </button>
            <button className="btn-primary" type="button" disabled={busy} onClick={() => void runImport()}>
              {t('productImport.startImport')}
            </button>
          </div>
        </section>
      )}

      {stage === 'progress' && (
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">{t('productImport.importProgress')}</h2>
          <progress className="h-3 w-full accent-[#7A1F3D]" value={progress.done} max={Math.max(1, progress.total)} />
          <p role="status" className="text-sm">
            {t('productImport.progressCount', { done: progress.done, total: progress.total })}
          </p>
          <p className="text-xs text-ink/65">{t('productImport.partialWarning')}</p>
        </section>
      )}

      {stage === 'result' && result && (
        <section className="space-y-4">
          <div className="card p-5">
            <h2 className="text-lg font-semibold">{t('productImport.resultTitle')}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                [t('productImport.totalRows'), result.analyzed],
                [t('productImport.productsAdded'), result.productsAdded],
                [t('productImport.productsUpdated'), result.productsUpdated],
                [t('productImport.productsSkipped'), result.productsSkipped],
                [t('productImport.skippedRows'), result.skipped],
                [t('productImport.errorRows'), result.errors],
                [t('productImport.duration'), `${(result.durationMs / 1000).toFixed(1)} s`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-ivory-dark/60 p-3">
                  <p className="text-xs text-ink/65">{label}</p>
                  <p className="text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
          {result.errors > 0 && (
            <div className="card p-4">
              <h3 className="mb-3 font-semibold text-red-800">{t('productImport.failedRows')}</h3>
              <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                {result.rows
                  .filter((row) => row.outcome === 'error')
                  .map((row) => (
                    <li key={`${row.line}-${row.variantSku}`} className="text-red-800">
                      {t('productImport.resultError', {
                        line: row.line,
                        sku: row.variantSku,
                        reason: row.messageKey ? t(row.messageKey) : t('productImport.errors.generic'),
                      })}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" type="button" onClick={downloadFullReport}>
              <Icon name="download" className="h-4 w-4" />
              {t('productImport.downloadFullReport')}
            </button>
            {result.errors > 0 && (
              <button className="btn-outline" type="button" onClick={downloadErrorReport}>
                <Icon name="download" className="h-4 w-4" />
                {t('productImport.downloadErrors')}
              </button>
            )}
            <button className="btn-primary" type="button" onClick={() => navigate('/admin/products')}>
              {t('productImport.backToProducts')}
            </button>
            <button
              className="btn-outline"
              type="button"
              onClick={() => {
                setStage('file');
                setParsed(null);
                setPreview(null);
                setFileName('');
                setResult(null);
              }}
            >
              {t('productImport.newImport')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
