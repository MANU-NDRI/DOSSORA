import { describe, expect, it } from 'vitest';
import writeExcelFile, { type SheetData } from 'write-excel-file/browser';
import type { Category } from '@/types';
import {
  createExcelTemplate,
  detectImportMapping,
  parseCsvContent,
  parseImportFile,
  templateExample,
  templateHeaders,
  validateImportRows,
} from './productImport';

const category = {
  id: 'category-1',
  slug: 'robes',
  name_fr: 'Robes',
  name_en: 'Dresses',
  name_ar: 'فساتين',
} as Category;

const csv = (rows: string[][], delimiter = ';') =>
  [templateHeaders(), ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(delimiter)).join('\r\n');

describe('import produit CSV/XLSX', () => {
  it.each([',', ';'])('analyse un CSV avec séparateur %s et cellules citées', (delimiter) => {
    const parsed = parseCsvContent(csv([templateExample()], delimiter));
    expect(parsed.headers).toEqual(templateHeaders());
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].cells[2]).toBe('Robe Élégante');
  });

  it('lit un modèle Excel XLSX dans le navigateur', async () => {
    const file = Object.assign(await createExcelTemplate(), { name: 'modele.xlsx' }) as File;
    const parsed = await parseImportFile(file);
    expect(parsed.headers).toEqual(templateHeaders());
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].cells[0]).toBe('DOS-100');
  });

  it('valide un import de 500 variantes sans perte de ligne', () => {
    const rows = Array.from({ length: 500 }, (_, index) => {
      const example = templateExample();
      example[0] = `DOS-${index}`;
      example[1] = `DOS-${index}-S`;
      return example;
    });
    const parsed = parseCsvContent(csv(rows));
    const preview = validateImportRows(parsed, detectImportMapping(parsed.headers), [category]);
    expect(preview.totalRows).toBe(500);
    expect(preview.rows).toHaveLength(500);
    expect(preview.issues).toHaveLength(0);
  });

  it('valide 10 nouveaux produits et leurs variantes', () => {
    const rows = Array.from({ length: 10 }, (_, index) => {
      const example = templateExample();
      example[0] = `DOS-${index}`;
      example[1] = `DOS-${index}-S`;
      return example;
    });
    const parsed = parseCsvContent(csv(rows));
    const preview = validateImportRows(parsed, detectImportMapping(parsed.headers), [category]);
    expect(preview.rows).toHaveLength(10);
    expect(preview.rows[0].variant.stock).toBe(12);
  });

  it('rejette un classeur Excel contenant des formules', async () => {
    const data: SheetData = [
      templateHeaders(),
      templateExample().map((value, index) => (index === 17 ? { value: '=1+1', type: 'Formula' } : value)),
    ];
    const file = Object.assign(await writeExcelFile(data).toBlob(), { name: 'formule.xlsx' }) as File;
    await expect(parseImportFile(file)).rejects.toMatchObject({ messageKey: 'productImport.errors.formulaWorkbook' });
  });

  it('signale colonnes obligatoires absentes et données invalides', () => {
    const missing = parseCsvContent('product_sku;name_fr\nSKU-1;Produit');
    expect(validateImportRows(missing, detectImportMapping(missing.headers), []).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 1, field: 'variant_sku' }),
        expect.objectContaining({ line: 1, field: 'price' }),
        expect.objectContaining({ line: 1, field: 'stock' }),
      ]),
    );

    const example = templateExample();
    example[8] = 'prix';
    example[21] = '-1';
    const invalid = parseCsvContent(csv([example]));
    const preview = validateImportRows(invalid, detectImportMapping(invalid.headers), [category]);
    expect(preview.rows).toHaveLength(0);
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 2, field: 'price', messageKey: 'productImport.errors.invalidPrice' }),
        expect.objectContaining({ line: 2, field: 'stock', messageKey: 'productImport.errors.invalidStock' }),
      ]),
    );
  });

  it('rejette une catégorie inconnue, des SKU variantes répétés et les cellules formule', () => {
    const first = templateExample();
    first[10] = 'unknown-category';
    first[1] = 'DUPLICATE';
    const second = [...templateExample()];
    second[1] = 'DUPLICATE';
    second[17] = '=1+1';
    const parsed = parseCsvContent(csv([first, second]));
    const preview = validateImportRows(parsed, detectImportMapping(parsed.headers), [category]);
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 2, field: 'category', messageKey: 'productImport.errors.unknownCategory' }),
        expect.objectContaining({ line: 2, field: 'variant_sku', messageKey: 'productImport.errors.duplicateVariantSku' }),
        expect.objectContaining({ line: 3, field: 'variant_sku', messageKey: 'productImport.errors.duplicateVariantSku' }),
        expect.objectContaining({ line: 3, field: 'color', messageKey: 'productImport.errors.formula' }),
      ]),
    );
  });

  it('rejette un CSV illisible au lieu de renvoyer un aperçu vide', () => {
    expect(() => parseCsvContent('"header\nvalue')).toThrow('productImport.errors.csvMalformed');
    expect(() => parseCsvContent('header')).toThrow('productImport.errors.empty');
  });
});
