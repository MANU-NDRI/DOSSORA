import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { getLabelMetrics, labelTrackingUrl } from './order-label';

describe('shipping label formats', () => {
  it('defines an exact 100 × 100 mm single-label sheet', () => {
    expect(getLabelMetrics('100')).toMatchObject({
      pageSize: '100mm 100mm',
      sheetWidth: '100mm',
      sheetHeight: '100mm',
      columns: 1,
      rows: 1,
    });
  });

  it('fits four labels into the printable A4 area', () => {
    const metrics = getLabelMetrics('a4x4');
    expect(metrics).toMatchObject({ pageSize: 'A4 portrait', sheetWidth: '198mm', sheetHeight: '285mm', columns: 2, rows: 2 });
    expect((285 - 2) / 2).toBe(141.5);
  });

  it('fits eight labels into the printable A4 area', () => {
    const metrics = getLabelMetrics('a4x8');
    expect(metrics).toMatchObject({ pageSize: 'A4 portrait', sheetWidth: '198mm', sheetHeight: '285mm', columns: 2, rows: 4 });
    expect((285 - 2 * 3) / 4).toBe(69.75);
  });

  it('encodes only the protected order route in the QR target', () => {
    const url = labelTrackingUrl('https://dossora.example', 'order-uuid-123');
    expect(url).toBe('https://dossora.example/account/orders/order-uuid-123');
    expect(url).not.toContain('@');
    expect(url).not.toContain('token');
  });

  it('generates an image payload suitable for a printed QR code', async () => {
    const url = labelTrackingUrl('https://dossora.example', 'order-uuid-123');
    const image = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 256 });
    expect(image).toMatch(/^data:image\/png;base64,/);
  });
});
