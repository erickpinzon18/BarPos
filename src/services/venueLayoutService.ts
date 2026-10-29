// src/services/venueLayoutService.ts
// Plano de mesas: la posición de cada mesa vive en su documento (`tables/{id}.layout`)
// y la decoración (barra, baños…) en `config/venueLayout`.
import { useEffect, useState } from 'react';
import { collection, deleteField, doc, onSnapshot, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import type { Table, TableLayout, VenueDecor } from '../utils/types';
import { DECOR_LAYOUT } from '../utils/venueLayout';

const DECOR_DOC = () => doc(db, 'config', 'venueLayout');

/** Decoración del plano en tiempo real; si nunca se ha guardado, la de por defecto. */
export const useVenueDecor = (): VenueDecor[] => {
  const [decor, setDecor] = useState<VenueDecor[]>(DECOR_LAYOUT);
  useEffect(
    () =>
      onSnapshot(
        DECOR_DOC(),
        (snap) => {
          const d = snap.data();
          setDecor(snap.exists() && Array.isArray(d?.decor) ? (d!.decor as VenueDecor[]) : DECOR_LAYOUT);
        },
        (err) => console.error('Error leyendo el plano:', err)
      ),
    []
  );
  return decor;
};

/** Mesa del editor: existente (`tableId`) o nueva (sin `tableId`). */
export interface LayoutTableDraft {
  key: string;
  tableId?: string;
  number: number | string;
  layout: TableLayout;
}

const round = (n: number) => Math.round(n * 100) / 100;
const cleanLayout = (l: TableLayout): TableLayout => ({
  x: round(l.x),
  y: round(l.y),
  w: round(l.w),
  h: round(l.h),
  shape: l.shape === 'round' ? 'round' : 'rect',
});

/**
 * Guarda el plano completo en un solo batch:
 * - mesas del plano: actualiza posición (y número si cambió) o crea la mesa nueva libre;
 * - mesas que tenían posición y ya no están: se quitan del plano (no se borran, conservan su historial);
 * - decoración: reemplaza la lista en `config/venueLayout`.
 */
export const saveVenueLayout = async (
  drafts: LayoutTableDraft[],
  decor: VenueDecor[],
  allTables: Table[],
  updatedBy: string
): Promise<{ created: number; updated: number; removed: number }> => {
  const batch = writeBatch(db);
  const now = Timestamp.now();
  const byId = new Map(allTables.map((t) => [t.id, t]));
  const kept = new Set<string>();
  let created = 0;
  let updated = 0;
  let removed = 0;

  for (const d of drafts) {
    const layout = cleanLayout(d.layout);
    if (d.tableId && byId.has(d.tableId)) {
      kept.add(d.tableId);
      const current = byId.get(d.tableId)!;
      batch.update(doc(db, 'tables', d.tableId), {
        layout,
        ...(String(current.number) !== String(d.number) ? { number: d.number } : {}),
        updatedAt: now,
      });
      updated++;
    } else {
      batch.set(doc(collection(db, 'tables')), {
        number: d.number,
        status: 'libre',
        waiterId: null,
        waiterName: null,
        currentOrderId: null,
        layout,
        createdAt: now,
        updatedAt: now,
      });
      created++;
    }
  }

  for (const t of allTables) {
    if (t.layout && !kept.has(t.id)) {
      batch.update(doc(db, 'tables', t.id), { layout: deleteField(), updatedAt: now });
      removed++;
    }
  }

  batch.set(DECOR_DOC(), {
    decor: decor.map((x) => ({ id: x.id, label: x.label.trim(), x: round(x.x), y: round(x.y), w: round(x.w), h: round(x.h) })),
    updatedAt: now,
    updatedBy,
  });

  await batch.commit();
  return { created, updated, removed };
};
