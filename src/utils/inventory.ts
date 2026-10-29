// src/utils/inventory.ts
// Lógica pura de inventario: cómo una cuenta descuenta insumos.
//
// Reglas:
// - Cuentas que descuentan: pagado, cortesia y activo (en curso). Las canceladas no.
// - Items eliminados (isDeleted) no descuentan; se reportan aparte como cancelados.
// - Cada producto descuenta según su receta (inventoryRecipes/{productId}).
//   Sin receta → se reporta en "sin receta" para que nada se escape.
// - Los mezcladores de las notas ("Servicios: 3x Agua Mineral, 2x Squirt" en botellas,
//   "Refresco: 1x Coca Cola | comentario" en tragos) descuentan el insumo cuyo alias coincide.
//   Etiqueta sin insumo → se reporta en "mezclador sin ligar".

import type {
  InventoryItem,
  InventoryMovement,
  InventoryRecipe,
  Order,
  OrderItem,
  OrderStatus,
} from './types';

export const COUNTED_ORDER_STATUSES: OrderStatus[] = ['pagado', 'cortesia', 'activo'];

/** Items que solo existen para imprimir en barra; no consumen nada.
 * (updateBottleMixers ya deja los mezcladores finales en las notas de la botella) */
const IGNORED_PRODUCT_IDS = new Set(['change_mixers']);

export interface ConsumptionLine {
  itemId: string;
  qty: number;
  source: 'receta' | 'mezclador';
  orderId: string;
  folio?: string;
  tableNumber: number | string;
  tableName?: string;
  waiterName: string;
  orderStatus: OrderStatus;
  orderCreatedAt: Date;
  productName: string;
  productQty: number;
  itemCreatedAt: Date;
  notes?: string;
}

export interface CancelledLine {
  orderId: string;
  folio?: string;
  tableNumber: number | string;
  tableName?: string;
  waiterName: string;
  productName: string;
  productQty: number;
  reason?: string;
  deletedByName?: string;
  deletedAt?: Date;
}

export interface UnmappedLine {
  kind: 'sin-receta' | 'mezclador';
  key: string; // productId o etiqueta del mezclador
  label: string;
  qty: number;
  orders: { orderId: string; folio?: string; tableNumber: number | string; waiterName: string }[];
}

export interface ConsumptionResult {
  lines: ConsumptionLine[];
  cancelled: CancelledLine[];
  unmapped: UnmappedLine[];
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Extrae los mezcladores de las notas de un item: [{label, qty}] */
export const parseMixerNotes = (notes?: string): { label: string; qty: number }[] => {
  if (!notes) return [];
  const m = notes.match(/^(?:Servicios|Refresco):\s*(.+)$/s);
  if (!m) return [];
  const body = m[1].split(' | ')[0];
  const out: { label: string; qty: number }[] = [];
  body.split(',').forEach((part) => {
    const pm = part.trim().match(/^(\d+)x\s+(.+)$/);
    if (!pm) return;
    const qty = parseInt(pm[1], 10);
    if (qty > 0) out.push({ label: pm[2].trim(), qty });
  });
  return out;
};

/** Índice etiqueta-de-nota → insumo (por nombre y alias, sin acentos ni mayúsculas) */
export const buildMixerIndex = (items: InventoryItem[]): Map<string, InventoryItem> => {
  const idx = new Map<string, InventoryItem>();
  items.forEach((it) => {
    [it.name, ...(it.mixerAliases ?? [])].forEach((a) => {
      if (a?.trim()) idx.set(normalize(a), it);
    });
  });
  return idx;
};

/** Cantidad de insumo (en unidades) que consume una línea de receta por 1 producto */
export const recipeLineUnits = (
  line: { qty: number; per: 'unit' | 'serving' },
  item?: InventoryItem
): number => {
  if (line.per === 'unit') return line.qty;
  const spu = item?.servingsPerUnit && item.servingsPerUnit > 0 ? item.servingsPerUnit : 1;
  return line.qty / spu;
};

const toDate = (d: Date | string | number | undefined | null): Date =>
  d instanceof Date ? d : d ? new Date(d) : new Date(0);

export const computeConsumption = (
  orders: Order[],
  recipes: Map<string, InventoryRecipe>,
  items: InventoryItem[]
): ConsumptionResult => {
  const itemById = new Map(items.map((i) => [i.id, i]));
  const mixerIdx = buildMixerIndex(items);
  const lines: ConsumptionLine[] = [];
  const cancelled: CancelledLine[] = [];
  const unmapped = new Map<string, UnmappedLine>();

  const addUnmapped = (
    kind: UnmappedLine['kind'],
    key: string,
    label: string,
    qty: number,
    order: Order
  ) => {
    const k = `${kind}:${key}`;
    if (!unmapped.has(k)) unmapped.set(k, { kind, key, label, qty: 0, orders: [] });
    const u = unmapped.get(k)!;
    u.qty += qty;
    if (!u.orders.some((o) => o.orderId === order.id)) {
      u.orders.push({ orderId: order.id, folio: order.folio, tableNumber: order.tableNumber, waiterName: order.waiterName });
    }
  };

  for (const order of orders) {
    if (!COUNTED_ORDER_STATUSES.includes(order.status)) continue;
    const base = {
      orderId: order.id,
      folio: order.folio,
      tableNumber: order.tableNumber,
      tableName: order.tableName,
      waiterName: order.waiterName,
    };

    for (const it of (order.items ?? []) as OrderItem[]) {
      if (IGNORED_PRODUCT_IDS.has(it.productId)) continue;
      const productQty = it.quantity || 1;
      if (it.isDeleted) {
        cancelled.push({
          ...base,
          productName: it.productName,
          productQty,
          reason: it.cancelReason,
          deletedByName: it.deletedByName,
          deletedAt: it.deletedAt ? toDate(it.deletedAt) : undefined,
        });
        continue;
      }

      const lineBase = {
        ...base,
        orderStatus: order.status,
        orderCreatedAt: toDate(order.createdAt),
        productName: it.productName,
        productQty,
        itemCreatedAt: toDate(it.createdAt || order.createdAt),
        notes: it.notes,
      };

      const recipe = recipes.get(it.productId);
      if (!recipe || (!recipe.noInventory && recipe.lines.length === 0)) {
        addUnmapped('sin-receta', it.productId, it.productName, productQty, order);
      } else if (!recipe.noInventory) {
        for (const rl of recipe.lines) {
          const units = recipeLineUnits(rl, itemById.get(rl.itemId));
          lines.push({ ...lineBase, itemId: rl.itemId, qty: units * productQty, source: 'receta' });
        }
      }

      // Los mezcladores de la nota ya son por el total del item (no se multiplican por cantidad)
      for (const mx of parseMixerNotes(it.notes)) {
        const inv = mixerIdx.get(normalize(mx.label));
        if (!inv) {
          addUnmapped('mezclador', normalize(mx.label), mx.label, mx.qty, order);
          continue;
        }
        lines.push({ ...lineBase, itemId: inv.id, qty: mx.qty, source: 'mezclador' });
      }
    }
  }

  return { lines, cancelled, unmapped: Array.from(unmapped.values()) };
};

// ─── Existencias ─────────────────────────────────────────────────────────────

/** Último movimiento de tipo conteo/inicial (checkpoint) en o antes de `at` */
export const lastCheckpoint = (movements: InventoryMovement[], at: Date = new Date()) =>
  movements
    .filter((m) => (m.type === 'conteo' || m.type === 'inicial') && m.at <= at)
    .sort((a, b) => b.at.getTime() - a.at.getTime())[0] ?? null;

/**
 * Existencia por insumo en el instante `at`.
 * Parte del último conteo/inicial ≤ at (lo contado), suma compras, resta extracciones
 * y consumo de ventas posteriores al checkpoint y ≤ at.
 * Los insumos que no estaban en el checkpoint arrancan en 0.
 */
export const computeStockAt = (
  movements: InventoryMovement[],
  consumption: ConsumptionLine[],
  at: Date = new Date()
): { stock: Map<string, number>; checkpoint: InventoryMovement | null } => {
  const cp = lastCheckpoint(movements, at);
  const from = cp ? cp.at : new Date(0);
  const stock = new Map<string, number>();
  const add = (id: string, q: number) => stock.set(id, (stock.get(id) ?? 0) + q);

  cp?.lines.forEach((l) => stock.set(l.itemId, l.qty));
  movements.forEach((m) => {
    if (m.at <= from || m.at > at) return;
    if (m.type === 'compra') m.lines.forEach((l) => add(l.itemId, l.qty));
    if (m.type === 'extraccion') m.lines.forEach((l) => add(l.itemId, -l.qty));
  });
  consumption.forEach((c) => {
    if (c.orderCreatedAt > from && c.orderCreatedAt <= at) add(c.itemId, -c.qty);
  });
  return { stock, checkpoint: cp };
};

export const fmtQty = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0$/, '');
};

// ─── Siembra automática desde la carta ───────────────────────────────────────

interface SeedProduct {
  id: string;
  name: string;
  category: string;
}

export interface SeedItem {
  key: string; // nombre normalizado
  name: string;
  kind: InventoryItem['kind'];
  unit: InventoryItem['unit'];
  servingsPerUnit: number;
  mixerAliases: string[];
}

export interface SeedRecipe {
  productId: string;
  productName: string;
  lines: { itemKey: string; qty: number; per: 'unit' | 'serving' }[];
  noInventory?: boolean;
}

/** Alias de las etiquetas de los modales de mezcladores que no coinciden con la carta */
const MIXER_ALIASES: Record<string, string[]> = {
  'agua tonica': ['Agua Tónica'],
  ginger: ['Ginger Ale'],
  'boost 235 ml': ['Boost'],
};

/**
 * Propone insumos y recetas a partir de la carta, sin adivinar:
 * "X - Botella" → insumo X ×1; "X - Promo" → X ×2; "X - Trago" → 1 trago de X;
 * cervezas ("… ml" en Bebida) y Servicios → su propio insumo ×1.
 * Todo lo demás (paquetes, cócteles, shots) queda sin receta.
 */
export const proposeSeed = (products: SeedProduct[]): { items: SeedItem[]; recipes: SeedRecipe[] } => {
  const items = new Map<string, SeedItem>();
  const recipes: SeedRecipe[] = [];
  const ensure = (name: string, kind: SeedItem['kind'], unit: SeedItem['unit'], spu: number) => {
    const key = normalize(name);
    if (!items.has(key)) {
      items.set(key, {
        key,
        name: name.trim(),
        kind,
        unit,
        servingsPerUnit: spu,
        mixerAliases: MIXER_ALIASES[key] ?? [],
      });
    }
    return key;
  };

  const bottleRe = /^(.+?)\s+-\s+(Botella|Promo|Trago)\s*$/i;
  for (const p of products) {
    const m = p.name.match(bottleRe);
    if (m && (p.category === 'Botella' || p.category === 'Bebida' || p.category === 'Shot')) {
      const base = m[1];
      const kind = m[2].toLowerCase();
      // "Baileys - Trago", "Perla Negra - Trago": solo si existe la botella en la carta
      const hasBottle = products.some((q) => normalize(q.name) === normalize(`${base} - Botella`));
      if (kind === 'trago' && !hasBottle) continue;
      const key = ensure(base, 'botella', 'botella', 16);
      recipes.push({
        productId: p.id,
        productName: p.name,
        lines: [{ itemKey: key, qty: kind === 'promo' ? 2 : 1, per: kind === 'trago' ? 'serving' : 'unit' }],
      });
      continue;
    }
    if (p.category === 'Bebida' && /\d+\s*ml\s*$/i.test(p.name)) {
      const key = ensure(p.name, 'cerveza', 'pz', 1);
      recipes.push({ productId: p.id, productName: p.name, lines: [{ itemKey: key, qty: 1, per: 'unit' }] });
      continue;
    }
    if (p.category === 'Servicio') {
      const n = normalize(p.name);
      if (n.includes('vaso roto') || n.includes('oso de peluche')) {
        recipes.push({ productId: p.id, productName: p.name, lines: [], noInventory: true });
        continue;
      }
      const isJugo = n.startsWith('jarra de jugo');
      const key = ensure(p.name, isJugo ? 'jugo' : 'refresco', isJugo ? 'jarra' : 'pz', 1);
      recipes.push({ productId: p.id, productName: p.name, lines: [{ itemKey: key, qty: 1, per: 'unit' }] });
    }
  }
  return { items: Array.from(items.values()), recipes };
};
