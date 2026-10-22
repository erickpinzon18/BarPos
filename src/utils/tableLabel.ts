// src/utils/tableLabel.ts

/**
 * Nombre legible de una mesa a partir de su `number`:
 * 5 -> "Mesa 5", "Llevar 2" -> "Extra 2" (lugares para llevar), "Sala 1" / "B3" -> tal cual.
 */
export const tableLabel = (number: number | string | null | undefined): string => {
  if (number === null || number === undefined || number === '') return 'Mesa ?';
  const s = String(number);
  if (/^\d+$/.test(s) || s === '?' || s === '-') return `Mesa ${s}`;
  if (/^Llevar\b/i.test(s)) return s.replace(/^Llevar/i, 'Extra');
  return s;
};
