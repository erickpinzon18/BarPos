// src/utils/venueLayout.ts
// Plano del local (Wikka SM). Posiciones en % del área del mapa (x, y = esquina superior izquierda).
// El plano se edita en Admin → Plano de mesas y se guarda en cada mesa (`tables/{id}.layout`)
// y en `config/venueLayout` (decoración). Mientras no se haya guardado ninguno, se usa el plano
// por defecto de abajo, ligado a las mesas por su campo `number`.
import type { Table, TableLayout, VenueDecor } from './types';

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
  // En la BD se llaman 'Llevar N'; en pantalla se muestran como 'Extra N' (ver utils/tableLabel)
  ...[1, 2, 3, 4, 5].map((n, i) => ({ number: `Llevar ${n}`, x: 27 + i * 7, y: 68.5, w: 6.5, h: SH })),
];

/** Elementos decorativos por defecto (no son mesas). */
export const DECOR_LAYOUT: VenueDecor[] = [
  { id: 'barra', label: 'Barra', x: 26, y: 82, w: 34, h: 16 },
];

const LAYOUT_KEYS = new Set(TABLE_LAYOUT.map(p => String(p.number)));

/** ¿Es un lugar "para llevar"? */
export const isTakeoutNumber = (number: number | string): boolean => /^Llevar\b/i.test(String(number));

/** ¿La mesa forma parte del plano por defecto? */
export const isLayoutTable = (number: number | string): boolean => LAYOUT_KEYS.has(String(number));

/** ¿Ya se guardó un plano editado (alguna mesa tiene posición en la BD)? */
export const hasStoredLayout = (tables: Table[]): boolean => tables.some((t) => !!t.layout);

/** Posición de la mesa en el plano vigente, o null si está fuera del plano. */
export const getTablePos = (table: Table, stored: boolean): TableLayout | null => {
  if (stored) return table.layout ?? null;
  const p = TABLE_LAYOUT.find((l) => String(l.number) === String(table.number));
  return p ? { x: p.x, y: p.y, w: p.w, h: p.h } : null;
};

/** Mesas del plano vigente con su posición. */
export const resolveLayout = (tables: Table[]): { table: Table; pos: TableLayout }[] => {
  const stored = hasStoredLayout(tables);
  return tables.flatMap((table) => {
    const pos = getTablePos(table, stored);
    return pos ? [{ table, pos }] : [];
  });
};

