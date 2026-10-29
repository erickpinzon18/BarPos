// src/services/inventoryService.ts
// Inventario: insumos, recetas por producto y movimientos manuales.
// Las ventas NO se guardan aquí: se calculan desde las cuentas (ver utils/inventory.ts).
import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  InventoryItem,
  InventoryRecipe,
  InventoryMovement,
  InventoryMovementLine,
  Order,
} from '../utils/types';
import type { SeedItem, SeedRecipe } from '../utils/inventory';

const toDate = (v: unknown): Date | undefined =>
  v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : undefined;

// ─── Insumos ─────────────────────────────────────────────────────────────────

export const getInventoryItems = async (): Promise<InventoryItem[]> => {
  const snap = await getDocs(collection(db, 'inventoryItems'));
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        name: x.name,
        kind: x.kind ?? 'otro',
        unit: x.unit ?? 'pz',
        servingsPerUnit: x.servingsPerUnit ?? 1,
        mixerAliases: x.mixerAliases ?? [],
        minStock: x.minStock ?? undefined,
        active: x.active ?? true,
        createdAt: toDate(x.createdAt) ?? new Date(0),
        updatedAt: toDate(x.updatedAt) ?? new Date(0),
      } as InventoryItem;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const saveInventoryItem = async (
  item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<string> => {
  const { id, ...data } = item;
  const payload: DocumentData = { ...data, updatedAt: Timestamp.now() };
  if (payload.minStock === undefined) payload.minStock = null;
  if (id) {
    await updateDoc(doc(db, 'inventoryItems', id), payload);
    return id;
  }
  const ref = await addDoc(collection(db, 'inventoryItems'), { ...payload, createdAt: Timestamp.now() });
  return ref.id;
};

// ─── Recetas ─────────────────────────────────────────────────────────────────

export const getInventoryRecipes = async (): Promise<Map<string, InventoryRecipe>> => {
  const snap = await getDocs(collection(db, 'inventoryRecipes'));
  const map = new Map<string, InventoryRecipe>();
  snap.docs.forEach((d) => {
    const x = d.data();
    map.set(d.id, {
      productId: d.id,
      productName: x.productName ?? '',
      lines: x.lines ?? [],
      noInventory: x.noInventory ?? false,
      updatedAt: toDate(x.updatedAt),
      updatedBy: x.updatedBy,
    });
  });
  return map;
};

export const saveInventoryRecipe = async (recipe: InventoryRecipe, updatedBy: string): Promise<void> => {
  await setDoc(doc(db, 'inventoryRecipes', recipe.productId), {
    productName: recipe.productName,
    lines: recipe.lines.map((l) => ({ itemId: l.itemId, qty: l.qty, per: l.per })),
    noInventory: !!recipe.noInventory,
    updatedAt: Timestamp.now(),
    updatedBy,
  });
};

/**
 * Guarda la propuesta automática: crea los insumos que no existan (por nombre)
 * y las recetas de productos que aún no tengan una. Nunca sobrescribe lo existente.
 */
export const applySeed = async (
  seedItems: SeedItem[],
  seedRecipes: SeedRecipe[],
  existingItems: InventoryItem[],
  existingRecipes: Map<string, InventoryRecipe>,
  updatedBy: string
): Promise<{ itemsCreated: number; recipesCreated: number }> => {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const idByKey = new Map<string, string>();
  existingItems.forEach((i) => idByKey.set(norm(i.name), i.id));

  const batch = writeBatch(db);
  let itemsCreated = 0;
  let recipesCreated = 0;
  const now = Timestamp.now();

  for (const s of seedItems) {
    if (idByKey.has(s.key)) continue;
    const ref = doc(collection(db, 'inventoryItems'));
    batch.set(ref, {
      name: s.name,
      kind: s.kind,
      unit: s.unit,
      servingsPerUnit: s.servingsPerUnit,
      mixerAliases: s.mixerAliases,
      minStock: null,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    idByKey.set(s.key, ref.id);
    itemsCreated++;
  }

  for (const r of seedRecipes) {
    if (existingRecipes.has(r.productId)) continue;
    batch.set(doc(db, 'inventoryRecipes', r.productId), {
      productName: r.productName,
      lines: r.lines.map((l) => ({ itemId: idByKey.get(l.itemKey)!, qty: l.qty, per: l.per })),
      noInventory: !!r.noInventory,
      updatedAt: now,
      updatedBy,
    });
    recipesCreated++;
  }

  await batch.commit();
  return { itemsCreated, recipesCreated };
};

// ─── Movimientos ─────────────────────────────────────────────────────────────

export const getInventoryMovements = async (): Promise<InventoryMovement[]> => {
  const snap = await getDocs(query(collection(db, 'inventoryMovements'), orderBy('at', 'asc')));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      type: x.type,
      at: toDate(x.at) ?? new Date(0),
      lines: x.lines ?? [],
      reason: x.reason ?? undefined,
      supplier: x.supplier ?? undefined,
      note: x.note ?? undefined,
      createdBy: x.createdBy ?? '',
      createdByName: x.createdByName ?? '',
      createdAt: toDate(x.createdAt) ?? new Date(0),
    } as InventoryMovement;
  });
};

export const addInventoryMovement = async (m: {
  type: InventoryMovement['type'];
  at: Date;
  lines: InventoryMovementLine[];
  reason?: string;
  supplier?: string;
  note?: string;
  createdBy: string;
  createdByName: string;
}): Promise<string> => {
  const clean = <T extends object>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));
  const ref = await addDoc(collection(db, 'inventoryMovements'), {
    ...clean({ type: m.type, reason: m.reason?.trim(), supplier: m.supplier?.trim(), note: m.note?.trim() }),
    at: Timestamp.fromDate(m.at),
    lines: m.lines.map((l) => clean({ ...l })),
    createdBy: m.createdBy,
    createdByName: m.createdByName,
    createdAt: Timestamp.now(),
  });
  return ref.id;
};

// ─── Cuentas ─────────────────────────────────────────────────────────────────

const convertOrder = (id: string, x: DocumentData): Order => ({
  ...(x as Omit<Order, 'id'>),
  id,
  createdAt: toDate(x.createdAt) ?? new Date(0),
  updatedAt: toDate(x.updatedAt) ?? new Date(0),
  completedAt: toDate(x.completedAt),
  items: (x.items ?? []).map((it: DocumentData) => ({
    ...it,
    createdAt: toDate(it.createdAt),
    updatedAt: toDate(it.updatedAt),
    deletedAt: toDate(it.deletedAt),
  })),
});

/** Cuentas creadas en [from, to) que descuentan inventario (pagado, cortesía, activo) */
export const getOrdersForInventory = async (from: Date, to: Date = new Date(Date.now() + 60_000)): Promise<Order[]> => {
  const snap = await getDocs(
    query(
      collection(db, 'orders'),
      where('createdAt', '>=', Timestamp.fromDate(from)),
      where('createdAt', '<', Timestamp.fromDate(to)),
      where('status', 'in', ['pagado', 'cortesia', 'activo'])
    )
  );
  return snap.docs.map((d) => convertOrder(d.id, d.data()));
};
