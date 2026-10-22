import { Unzip, UnzipInflate, UnzipPassThrough } from 'fflate';
import readXlsxFile from 'read-excel-file/browser';
import writeExcelFile, { type SheetData } from 'write-excel-file/browser';
import { slugify } from '@/lib/utils';
import type { Category } from '@/types';

export const MAX_IMPORT_FILE_SIZE = 15 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 20_000;
export const IMPORT_BATCH_SIZE = 100;

export const IMPORT_FIELDS = [
  'product_sku',
  'variant_sku',
  'name_fr',
  'name_en',
  'name_ar',
  'description_fr',
  'description_en',
  'description_ar',
  'price',
  'sale_price',
  'category',
  'status',
  'is_featured',
  'is_popular',
  'is_new',
  'is_on_sale',
  'images',
  'color',
  'size',
  'shoe_size',
  'price_override',
  'stock',
  'low_stock_threshold',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];
export type ImportMapping = Partial<Record<ImportField, number>>;

export interface ParsedImportRow {
  line: number;
  cells: string[];
  formulaColumns: string[];
}

export interface ParsedImportFile {
  headers: string[];
  rows: ParsedImportRow[];
}

export interface ImportIssue {
  line: number;
  field: ImportField | null;
  messageKey: string;
}

export interface ImportProductData {
  sku: string;
  name_fr: string;
  name_en: string | null;
  name_ar: string | null;
  description_fr: string | null;
  description_en: string | null;
  description_ar: string | null;
  price: number;
  sale_price: number | null;
  category_id: string | null;
  status: 'draft' | 'published' | 'archived';
  is_featured: boolean;
  is_popular: boolean;
  is_new: boolean;
  is_on_sale: boolean;
  image_urls: string[];
}

export interface ImportVariantData {
  sku: string;
  color: string | null;
  size: string | null;
  shoe_size: string | null;
  price_override: number | null;
  stock: number;
  low_stock_threshold: number;
}

export interface ValidImportRow {
  line: number;
  product: ImportProductData;
  variant: ImportVariantData;
}

export interface ImportPreview {
  rows: ValidImportRow[];
  issues: ImportIssue[];
  totalRows: number;
}

const aliases: Record<ImportField, string[]> = {
  product_sku: ['product sku', 'parent sku', 'sku produit', 'reference produit', 'référence produit', 'sku parent'],
  variant_sku: ['variant sku', 'sku variante', 'reference variante', 'référence variante', 'sku'],
  name_fr: ['name fr', 'name', 'product name', 'nom', 'nom du produit', 'nom produit'],
  name_en: ['name en', 'nom anglais'],
  name_ar: ['name ar', 'nom arabe'],
  description_fr: ['description fr', 'description'],
  description_en: ['description en', 'description anglais'],
  description_ar: ['description ar', 'description arabe'],
  price: ['price', 'prix', 'prix de vente'],
  sale_price: ['sale price', 'prix promo', 'prix promotionnel'],
  category: ['category', 'category slug', 'categorie', 'catégorie', 'slug categorie'],
  status: ['status', 'statut', 'publication'],
  is_featured: ['is featured', 'featured', 'mis en avant', 'a la une', 'à la une'],
  is_popular: ['is popular', 'popular', 'populaire'],
  is_new: ['is new', 'new', 'nouveau'],
  is_on_sale: ['is on sale', 'on sale', 'en promotion'],
  images: ['images', 'image urls', 'image url', 'urls images', 'url image'],
  color: ['color', 'couleur'],
  size: ['size', 'taille'],
  shoe_size: ['shoe size', 'pointure'],
  price_override: ['price override', 'variant price', 'prix variante', 'prix spécifique'],
  stock: ['stock', 'quantity', 'quantite', 'quantité', 'quantite en stock', 'quantité en stock'],
  low_stock_threshold: ['low stock threshold', 'seuil stock faible'],
};

const normalizeHeader = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
    .replace(/\s+/g, ' ');

export class ProductImportError extends Error {
  constructor(
    readonly messageKey: string,
    message?: string,
  ) {
    super(message ?? messageKey);
    this.name = 'ProductImportError';
  }
}

function xlsxContainsFormula(buffer: ArrayBuffer): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const maxSheetXmlBytes = 100 * 1024 * 1024;
    const maxTotalXmlBytes = 150 * 1024 * 1024;
    let totalXmlBytes = 0;
    let pendingSheets = 0;
    let pushed = false;
    let hasFormula = false;
    let settled = false;
    const finish = () => {
      if (!settled && pushed && pendingSheets === 0) {
        settled = true;
        resolve(hasFormula);
      }
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const unzip = new Unzip((entry) => {
      if (settled) return;
      if (!/^xl\/.*\.xml$/i.test(entry.name)) return;
      if (entry.originalSize !== undefined && entry.originalSize > maxSheetXmlBytes) {
        fail(new ProductImportError('productImport.errors.unreadable'));
        return;
      }
      pendingSheets += 1;
      const parts: Uint8Array[] = [];
      let sheetBytes = 0;
      entry.ondata = (error, chunk, final) => {
        if (error) {
          fail(error);
          return;
        }
        sheetBytes += chunk.byteLength;
        totalXmlBytes += chunk.byteLength;
        if (sheetBytes > maxSheetXmlBytes || totalXmlBytes > maxTotalXmlBytes) {
          void entry.terminate();
          fail(new ProductImportError('productImport.errors.unreadable'));
          return;
        }
        parts.push(chunk);
        if (!final) return;
        const xmlBytes = new Uint8Array(sheetBytes);
        let offset = 0;
        for (const part of parts) {
          xmlBytes.set(part, offset);
          offset += part.byteLength;
        }
        const xml = new TextDecoder().decode(xmlBytes);
        if (
          /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name) &&
          /<f(?:\s[^>]*)?(?:\/>|>[\s\S]*?<\/f>)/i.test(xml)
        )
          hasFormula = true;
        pendingSheets -= 1;
        finish();
      };
      try {
        entry.start();
      } catch (error) {
        fail(error);
      }
    });
    unzip.register(UnzipPassThrough);
    unzip.register(UnzipInflate);
    try {
      unzip.push(new Uint8Array(buffer), true);
      pushed = true;
      finish();
    } catch (error) {
      fail(error);
    }
  });
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 5).join('\n');
  const counts = new Map([
    [';', 0],
    [',', 0],
    ['\t', 0],
  ]);
  let quoted = false;
  for (let i = 0; i < sample.length; i += 1) {
    const char = sample[i];
    if (char === '"' && sample[i + 1] === '"' && quoted) {
      i += 1;
      continue;
    }
    if (char === '"') quoted = !quoted;
    else if (!quoted && counts.has(char)) counts.set(char, (counts.get(char) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

function parseDelimited(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      record.push(value);
      value = '';
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      record.push(value);
      if (record.some((cell) => cell.trim() !== '')) records.push(record);
      record = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (quoted) throw new ProductImportError('productImport.errors.csvMalformed');
  record.push(value);
  if (record.some((cell) => cell.trim() !== '')) records.push(record);
  return records;
}

export function parseCsvContent(text: string): ParsedImportFile {
  return makeParsedFile(parseDelimited(text.replace(/^\uFEFF/, ''), detectDelimiter(text)));
}

function makeParsedFile(records: string[][]): ParsedImportFile {
  if (!records.length || records.length < 2) throw new ProductImportError('productImport.errors.empty');
  const headers = records[0].map((header, index) => header.trim() || `Column ${index + 1}`);
  const normalized = headers.map(normalizeHeader);
  if (new Set(normalized).size !== normalized.length) throw new ProductImportError('productImport.errors.duplicateHeaders');
  if (records.length - 1 > MAX_IMPORT_ROWS) throw new ProductImportError('productImport.errors.tooManyRows');
  const rows = records.slice(1).map((cells, index) => ({
    line: index + 2,
    cells: headers.map((_, cellIndex) => (cells[cellIndex] ?? '').trim()),
    formulaColumns: [],
  }));
  return { headers, rows };
}

export async function parseImportFile(file: File): Promise<ParsedImportFile> {
  if (file.size === 0) throw new ProductImportError('productImport.errors.empty');
  if (file.size > MAX_IMPORT_FILE_SIZE) throw new ProductImportError('productImport.errors.fileTooLarge');
  const extension = file.name.toLocaleLowerCase().split('.').pop();
  if (extension === 'csv') {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '');
    } catch {
      throw new ProductImportError('productImport.errors.encoding');
    }
    return parseCsvContent(text);
  }
  if (extension !== 'xlsx') throw new ProductImportError('productImport.errors.unsupportedFormat');
  try {
    const bytes = await file.arrayBuffer();
    if (await xlsxContainsFormula(bytes)) throw new ProductImportError('productImport.errors.formulaWorkbook');
    const sheets = await readXlsxFile(file);
    const data = sheets[0]?.data;
    if (!data || data.length < 2) throw new ProductImportError('productImport.errors.empty');
    const headerCells = data[0] ?? [];
    const headers = headerCells.map((cell, index) => String(cell ?? '').trim() || `Column ${index + 1}`);
    const normalized = headers.map(normalizeHeader);
    if (new Set(normalized).size !== normalized.length) throw new ProductImportError('productImport.errors.duplicateHeaders');
    const rows = data
      .slice(1)
      .map((cells, index) => ({
        line: index + 2,
        cells: headers.map((_, cellIndex) => String(cells?.[cellIndex] ?? '').trim()),
        formulaColumns: [],
      }))
      .filter((row) => row.cells.some((cell) => cell !== ''));
    if (!rows.length) throw new ProductImportError('productImport.errors.empty');
    if (rows.length > MAX_IMPORT_ROWS) throw new ProductImportError('productImport.errors.tooManyRows');
    return { headers, rows };
  } catch (error) {
    if (error instanceof ProductImportError) throw error;
    throw new ProductImportError('productImport.errors.unreadable');
  }
}

export function detectImportMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {};
  const used = new Set<number>();
  for (const field of IMPORT_FIELDS) {
    const names = [normalizeHeader(field.replace(/_/g, ' ')), ...aliases[field].map(normalizeHeader)];
    const index = headers.findIndex((header, i) => !used.has(i) && names.includes(normalizeHeader(header)));
    if (index !== -1) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

function parseBoolean(value: string): boolean {
  return ['true', '1', 'yes', 'oui', 'vrai', 'published', 'publie', 'publié'].includes(normalizeHeader(value));
}

const textOrNull = (value: string) => value.trim() || null;
const MAX_MONEY = 9_999_999_999.99;
const MAX_INTEGER = 2_147_483_647;
const validMoney = (value: number | null): value is number =>
  value !== null &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= MAX_MONEY &&
  Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;

function isValidImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && value.length <= 2048;
  } catch {
    return false;
  }
}

function categoryFor(value: string, categories: Category[]): Category | null {
  const query = normalizeHeader(value);
  return (
    categories.find(
      (category) =>
        normalizeHeader(category.slug) === query ||
        [category.name_fr, category.name_en, category.name_ar].some((name) => name && normalizeHeader(name) === query),
    ) ?? null
  );
}

export function validateImportRows(file: ParsedImportFile, mapping: ImportMapping, categories: Category[]): ImportPreview {
  const issues: ImportIssue[] = [];
  const rows: ValidImportRow[] = [];
  const required: ImportField[] = ['product_sku', 'variant_sku', 'name_fr', 'price', 'stock'];
  for (const field of required) {
    if (mapping[field] === undefined) issues.push({ line: 1, field, messageKey: 'productImport.errors.requiredColumn' });
  }
  if (issues.length) return { rows, issues, totalRows: file.rows.length };

  const get = (cells: string[], field: ImportField) => {
    const index = mapping[field];
    return index === undefined ? '' : (cells[index] ?? '').trim();
  };
  const variantSkuLines = new Map<string, number[]>();
  const products = new Map<string, { serialized: string; lines: number[]; inconsistent: boolean }>();
  const pending: Array<{ source: ParsedImportRow; product: ImportProductData; variant: ImportVariantData }> = [];

  for (const source of file.rows) {
    const rowIssues: ImportIssue[] = [];
    const add = (field: ImportField | null, messageKey: string) => rowIssues.push({ line: source.line, field, messageKey });
    for (const header of source.formulaColumns) {
      const field =
        IMPORT_FIELDS.find((candidate) => mapping[candidate] !== undefined && file.headers[mapping[candidate] as number] === header) ??
        null;
      add(field, 'productImport.errors.formula');
    }
    const productSku = get(source.cells, 'product_sku');
    const variantSku = get(source.cells, 'variant_sku');
    const name = get(source.cells, 'name_fr');
    const price = parseNumber(get(source.cells, 'price'));
    const saleText = get(source.cells, 'sale_price');
    const salePrice = saleText ? parseNumber(saleText) : null;
    const stock = parseNumber(get(source.cells, 'stock'));
    const categoryText = get(source.cells, 'category');
    const category = categoryText ? categoryFor(categoryText, categories) : null;
    const statusText = get(source.cells, 'status').toLowerCase();
    const status = (statusText || 'draft') as ImportProductData['status'];
    const overrideText = get(source.cells, 'price_override');
    const override = overrideText ? parseNumber(overrideText) : null;
    const thresholdText = get(source.cells, 'low_stock_threshold');
    const threshold = thresholdText ? parseNumber(thresholdText) : 3;
    const imagesText = get(source.cells, 'images');
    const imageUrls = imagesText
      ? imagesText
          .split('|')
          .map((url) => url.trim())
          .filter(Boolean)
      : [];

    if (!productSku) add('product_sku', 'productImport.errors.required');
    if (!variantSku) add('variant_sku', 'productImport.errors.required');
    if (!name) add('name_fr', 'productImport.errors.required');
    if (!validMoney(price) || price === 0) add('price', 'productImport.errors.invalidPrice');
    if (saleText && (!validMoney(salePrice) || (price !== null && salePrice >= price)))
      add('sale_price', 'productImport.errors.invalidSalePrice');
    if (stock === null || !Number.isInteger(stock) || stock < 0 || stock > MAX_INTEGER) add('stock', 'productImport.errors.invalidStock');
    if (categoryText && !category) add('category', 'productImport.errors.unknownCategory');
    if (!['draft', 'published', 'archived'].includes(status)) add('status', 'productImport.errors.invalidStatus');
    if (override !== null && !validMoney(override)) add('price_override', 'productImport.errors.invalidPrice');
    if (threshold === null || !Number.isInteger(threshold) || threshold < 0 || threshold > MAX_INTEGER)
      add('low_stock_threshold', 'productImport.errors.invalidStock');
    if (imageUrls.some((url) => !isValidImageUrl(url))) add('images', 'productImport.errors.invalidImageUrl');

    for (const field of IMPORT_FIELDS) {
      if (
        [
          'price',
          'sale_price',
          'stock',
          'price_override',
          'low_stock_threshold',
          'is_featured',
          'is_popular',
          'is_new',
          'is_on_sale',
        ].includes(field)
      )
        continue;
      if (/^\s*[=+\-@]/.test(get(source.cells, field))) add(field, 'productImport.errors.formula');
    }

    if (productSku && variantSku) {
      const key = variantSku.toLocaleLowerCase();
      variantSkuLines.set(key, [...(variantSkuLines.get(key) ?? []), source.line]);
    }
    const serializedParent = JSON.stringify({
      name,
      name_en: get(source.cells, 'name_en'),
      name_ar: get(source.cells, 'name_ar'),
      description_fr: get(source.cells, 'description_fr'),
      description_en: get(source.cells, 'description_en'),
      description_ar: get(source.cells, 'description_ar'),
      price,
      salePrice,
      category_id: category?.id ?? null,
      status,
      is_featured: parseBoolean(get(source.cells, 'is_featured')),
      is_popular: parseBoolean(get(source.cells, 'is_popular')),
      is_new: parseBoolean(get(source.cells, 'is_new')),
      is_on_sale: parseBoolean(get(source.cells, 'is_on_sale')),
      imageUrls,
    });
    if (productSku) {
      const key = productSku.toLocaleLowerCase();
      const prior = products.get(key);
      if (prior) {
        prior.lines.push(source.line);
        if (prior.serialized !== serializedParent) {
          prior.inconsistent = true;
        }
      } else products.set(key, { serialized: serializedParent, lines: [source.line], inconsistent: false });
    }
    if (rowIssues.length) issues.push(...rowIssues);
    else {
      pending.push({
        source,
        product: {
          sku: productSku,
          name_fr: name,
          name_en: textOrNull(get(source.cells, 'name_en')),
          name_ar: textOrNull(get(source.cells, 'name_ar')),
          description_fr: textOrNull(get(source.cells, 'description_fr')),
          description_en: textOrNull(get(source.cells, 'description_en')),
          description_ar: textOrNull(get(source.cells, 'description_ar')),
          price: price as number,
          sale_price: salePrice as number | null,
          category_id: category?.id ?? null,
          status,
          is_featured: parseBoolean(get(source.cells, 'is_featured')),
          is_popular: parseBoolean(get(source.cells, 'is_popular')),
          is_new: parseBoolean(get(source.cells, 'is_new')),
          is_on_sale: parseBoolean(get(source.cells, 'is_on_sale')) || salePrice !== null,
          image_urls: imageUrls,
        },
        variant: {
          sku: variantSku,
          color: textOrNull(get(source.cells, 'color')),
          size: textOrNull(get(source.cells, 'size')),
          shoe_size: textOrNull(get(source.cells, 'shoe_size')),
          price_override: override as number | null,
          stock: stock as number,
          low_stock_threshold: threshold as number,
        },
      });
    }
  }

  for (const product of products.values()) {
    if (product.inconsistent) {
      for (const line of product.lines) issues.push({ line, field: 'product_sku', messageKey: 'productImport.errors.inconsistentProduct' });
    }
  }
  for (const lines of variantSkuLines.values()) {
    if (lines.length > 1)
      for (const line of lines) issues.push({ line, field: 'variant_sku', messageKey: 'productImport.errors.duplicateVariantSku' });
  }
  const badLines = new Set(issues.filter((issue) => issue.line > 1).map((issue) => issue.line));
  return {
    rows: pending
      .filter((row) => !badLines.has(row.source.line))
      .map(({ source, product, variant }) => ({ line: source.line, product, variant })),
    issues,
    totalRows: file.rows.length,
  };
}

export function templateHeaders(): string[] {
  return [...IMPORT_FIELDS];
}

export function templateExample(): string[] {
  return [
    'DOS-100',
    'DOS-100-NOIR-S',
    'Robe Élégante',
    'Elegant dress',
    'فستان أنيق',
    'Description de la robe',
    'Dress description',
    'وصف الفستان',
    '450',
    '399',
    'robes',
    'draft',
    'false',
    'false',
    'true',
    'true',
    'https://example.com/robe.jpg',
    'Noir',
    'S',
    '',
    '',
    '12',
    '3',
  ];
}

export async function createExcelTemplate(): Promise<Blob> {
  const sheetData: SheetData = [
    templateHeaders().map((value) => ({ value, fontWeight: 'bold', backgroundColor: '#7A1F3D', textColor: '#FFFFFF' })),
    templateExample(),
  ];
  return writeExcelFile(sheetData, { sheet: 'Products' }).toBlob();
}

export function exportCsv(rows: string[][]): string {
  const escapeCell = (value: string) => {
    const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return `\uFEFF${rows.map((row) => row.map(escapeCell).join(';')).join('\r\n')}`;
}

export function slugForImportedProduct(name: string, sku: string): string {
  return slugify(`${name}-${sku}`);
}
