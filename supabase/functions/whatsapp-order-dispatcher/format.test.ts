import { describe, expect, it } from 'vitest';
import { splitWhatsappMessage } from './format';

describe('splitWhatsappMessage', () => {
  it.each([1, 2, 10])('preserves every item in a %i-item order', (count) => {
    const source = Array.from({ length: count }, (_, index) =>
      `${index + 1}. Article DOSSORA ${index + 1}\nRéférence : SKU-${index + 1}\nQuantité : 1\nPrix : 25 000 FCFA`,
    ).join('\n\n');
    const parts = splitWhatsappMessage(source, 90);
    expect(parts.join('')).toBe(source);
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.every((part) => Array.from(part).length <= 90)).toBe(true);
  });

  it('does not split Unicode surrogate pairs or discard characters', () => {
    const source = `${'🛍️📦'.repeat(600)} fin`;
    const parts = splitWhatsappMessage(source, 850);
    expect(parts.join('')).toBe(source);
    expect(parts.every((part) => Array.from(part).length <= 850)).toBe(true);
  });

  it('returns no empty part for an empty message and rejects an invalid chunk size', () => {
    expect(splitWhatsappMessage('')).toEqual([]);
    expect(() => splitWhatsappMessage('texte', 0)).toThrow('INVALID_CHUNK_SIZE');
  });
});
