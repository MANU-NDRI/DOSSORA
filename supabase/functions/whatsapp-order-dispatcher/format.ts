/** Découpe en Unicode code points: aucun emoji/caractère combiné par paire surrogate n'est tronqué. */
export function splitWhatsappMessage(message: string, maxCodePoints = 850): string[] {
  if (!message) return [];
  if (!Number.isInteger(maxCodePoints) || maxCodePoints < 1) throw new Error('INVALID_CHUNK_SIZE');
  const characters = Array.from(message);
  const chunks: string[] = [];
  for (let offset = 0; offset < characters.length; offset += maxCodePoints) {
    chunks.push(characters.slice(offset, offset + maxCodePoints).join(''));
  }
  return chunks;
}
