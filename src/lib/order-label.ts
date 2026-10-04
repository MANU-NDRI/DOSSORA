export type LabelFormat = '100' | 'a4x4' | 'a4x8';

export interface LabelMetrics {
  pageSize: string;
  pageWidth: string;
  pageHeight: string;
  margin: string;
  sheetWidth: string;
  sheetHeight: string;
  columns: number;
  rows: number;
  gap: string;
}

const A4_MARGIN_MM = 6;
const A4_GAP_MM = 2;

export function getLabelMetrics(format: LabelFormat): LabelMetrics {
  if (format === '100') {
    return {
      pageSize: '100mm 100mm',
      pageWidth: '100mm',
      pageHeight: '100mm',
      margin: '0',
      sheetWidth: '100mm',
      sheetHeight: '100mm',
      columns: 1,
      rows: 1,
      gap: '0',
    };
  }
  const rows = format === 'a4x4' ? 2 : 4;
  return {
    pageSize: 'A4 portrait',
    pageWidth: '210mm',
    pageHeight: '297mm',
    margin: `${A4_MARGIN_MM}mm`,
    sheetWidth: `${210 - A4_MARGIN_MM * 2}mm`,
    sheetHeight: `${297 - A4_MARGIN_MM * 2}mm`,
    columns: 2,
    rows,
    gap: `${A4_GAP_MM}mm`,
  };
}

/** QR target remains behind the existing authenticated account route and RLS checks. */
export function labelTrackingUrl(origin: string, orderId: string): string {
  return new URL(`/account/orders/${encodeURIComponent(orderId)}`, origin).toString();
}
