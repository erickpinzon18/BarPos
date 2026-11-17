// src/utils/tableStatus.ts
import type { Order, Table } from './types';

/**
 * Deja solo la cuenta actual de cada mesa ocupada, con el mismo criterio que el mapa de mesas:
 * la mesa debe estar 'ocupada' y la cuenta es su currentOrderId (o, si no lo trae, la activa
 * más reciente). Las cuentas viejas que quedaron 'activo' en mesas ya libres, o duplicadas en
 * la misma mesa, se omiten para no elegirlas por error.
 */
export const currentOrderPerTable = (orders: Order[], tables: Table[]): Order[] => {
  const latest = new Map<string, Order>();
  for (const o of orders) {
    const prev = latest.get(o.tableId);
    if (!prev || o.createdAt > prev.createdAt) latest.set(o.tableId, o);
  }
  const byId = new Map(orders.map(o => [o.id, o]));
  const current = new Set<Order>();
  for (const t of tables) {
    if (t.status !== 'ocupada') continue;
    const order = (t.currentOrderId && byId.get(t.currentOrderId)) || latest.get(t.id);
    if (order && order.tableId === t.id) current.add(order);
  }
  return orders.filter(o => current.has(o));
};

/**
 * Una mesa marcada 'ocupada' sin orden activa (p. ej. la orden se borró o se cerró
 * sin liberar la mesa) se trata como libre, para que se pueda volver a abrir.
 */
export const withEffectiveStatus = (tables: Table[], orders: Order[]): Table[] => {
  const tablesWithOrder = new Set(orders.map(o => o.tableId));
  return tables.map(t =>
    t.status === 'ocupada' && !tablesWithOrder.has(t.id)
      ? { ...t, status: 'libre', waiterId: undefined, waiterName: undefined, currentOrderId: undefined }
      : t
  );
};
