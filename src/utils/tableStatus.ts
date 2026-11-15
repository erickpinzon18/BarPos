// src/utils/tableStatus.ts
import type { Order, Table } from './types';

/**
 * Una mesa marcada 'ocupada' sin orden activa (p. ej. la orden se borró o se cerró
 * sin liberar la mesa) se trata como libre, para que se pueda volver a abrir.
 */
/**
 * Deja solo la cuenta actual de cada mesa: la activa más reciente, que es la que muestran
 * las tarjetas y el detalle de mesa. Si quedaron cuentas viejas sin cerrar en la misma mesa,
 * se omiten para no elegirlas por error.
 */
export const currentOrderPerTable = (orders: Order[]): Order[] => {
  const latest = new Map<string, Order>();
  for (const o of orders) {
    const prev = latest.get(o.tableId);
    if (!prev || o.createdAt > prev.createdAt) latest.set(o.tableId, o);
  }
  return orders.filter(o => latest.get(o.tableId) === o);
};

export const withEffectiveStatus = (tables: Table[], orders: Order[]): Table[] => {
  const tablesWithOrder = new Set(orders.map(o => o.tableId));
  return tables.map(t =>
    t.status === 'ocupada' && !tablesWithOrder.has(t.id)
      ? { ...t, status: 'libre', waiterId: undefined, waiterName: undefined, currentOrderId: undefined }
      : t
  );
};
