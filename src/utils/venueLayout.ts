// src/utils/venueLayout.ts
// Plano del local (Wikka SM). Posiciones en % del área del mapa (x, y = esquina superior izquierda).
// Las mesas se ligan por su campo `number` en Firestore.

export interface TablePos {
  number: number | string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Tamaño estándar de mesa chica
const SW = 6;
const SH = 9.5;

export const TABLE_LAYOUT: TablePos[] = [
  // ── Columna izquierda ─────────────────────────────────
  { number: 7,  x: 2,  y: 14, w: SW, h: SH },
  { number: 8,  x: 2,  y: 31, w: SW, h: SH },
  { number: 9,  x: 2,  y: 47, w: SW, h: SH },
  { number: 10, x: 2,  y: 62, w: SW, h: SH },

  // ── Segunda columna ───────────────────────────────────
  { number: 6,  x: 12, y: 20, w: SW, h: SH },
  { number: 5,  x: 12, y: 46, w: SW, h: 15 },

  // ── Centro ────────────────────────────────────────────
  { number: 1,  x: 24, y: 34, w: SW, h: SH },
  { number: 2,  x: 24, y: 58, w: SW, h: SH },

  // ── Abajo a la izquierda ──────────────────────────────
  { number: 4,  x: 6,  y: 78, w: SW, h: SH },
  { number: 3,  x: 16, y: 78, w: SW, h: SH },

  // ── Barra (B1–B5) ─────────────────────────────────────
  { number: 'B1', x: 34,   y: 34, w: SW,   h: SH },
  { number: 'B2', x: 42.5, y: 49, w: 7,    h: SH },
  { number: 'B3', x: 53,   y: 49, w: 7,    h: SH },
  { number: 'B4', x: 64,   y: 42, w: 16,   h: 11 },
  { number: 'B5', x: 61,   y: 12, w: 10.5, h: 22 },

  // ── Salas ─────────────────────────────────────────────
  { number: 'Sala 1', x: 43,   y: 7,  w: 10.5, h: 28 },
  { number: 'Sala 2', x: 81.5, y: 15, w: 15,   h: 26 },
  { number: 'Sala 3', x: 73,   y: 77, w: 18,   h: 20 },

  // ── Para llevar (fila sobre la barra) ─────────────────
  ...[1, 2, 3, 4, 5].map((n, i) => ({ number: `Llevar ${n}`, x: 33 + i * 5.75, y: 68.5, w: 5, h: SH })),
];

/** Elementos decorativos (no son mesas). */
export const DECOR_LAYOUT = [
  { label: 'Barra', x: 26, y: 82, w: 34, h: 16 },
];

const LAYOUT_KEYS = new Set(TABLE_LAYOUT.map(p => String(p.number)));

/** ¿Es un lugar "para llevar"? */
export const isTakeoutNumber = (number: number | string): boolean => /^Llevar\b/i.test(String(number));

/** ¿La mesa forma parte del plano actual? */
export const isLayoutTable = (number: number | string): boolean => LAYOUT_KEYS.has(String(number));

