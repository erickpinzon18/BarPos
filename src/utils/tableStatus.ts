// src/utils/tableStatus.ts
import type { Order, Table } from './types';

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
