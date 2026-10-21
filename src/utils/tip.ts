// src/utils/tip.ts

/**
 * Convierte lo que el usuario escribe en el campo "%" a decimal (15 -> 0.15, 12.5 -> 0.125).
 * Siempre se interpreta como porcentaje, acotado entre 0 y 100. Vacío o inválido -> 0.
 */
export const parseTipPercentInput = (value: string): number => {
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 100) / 100;
};

/** Muestra un porcentaje decimal sin ceros sobrantes (0.15 -> "15", 0.125 -> "12.5"). */
export const formatTipPercent = (percent: number): string =>
  String(Math.round(percent * 1000) / 10);
