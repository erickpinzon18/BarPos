/**
 * Folio Utility — BarPos
 * Convierte un número de secuencia global (1-based) en un folio alfanumérico
 * tipo hoja de cálculo: A1..A10000, B1..B10000, ..., Z1..Z10000, AA1..AA10000, ...
 */
const BLOCK_SIZE = 10000;

/** Convierte un índice de bloque 0-based a letras estilo Excel (0→A, 25→Z, 26→AA, ...). */
const blockIndexToLetters = (blockIndex: number): string => {
  let n = blockIndex + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
};

/** seq es 1-based: el primer folio asignado globalmente tiene seq = 1. */
export const seqToFolio = (seq: number): string => {
  const blockIndex = Math.floor((seq - 1) / BLOCK_SIZE);
  const withinBlock = ((seq - 1) % BLOCK_SIZE) + 1;
  return `${blockIndexToLetters(blockIndex)}${withinBlock}`;
};
