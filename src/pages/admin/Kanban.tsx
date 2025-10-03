// src/pages/admin/Kanban.tsx
import React from 'react';
import { useKitchenOrders } from '../../hooks/useKitchenOrders';
import { useLocation } from 'react-router-dom';
import KanbanColumn from '../../components/common/KanbanColumn';
import type { Order, OrderItemStatus } from '../../utils/types';
import { updateOrderStatusInKanban } from '../../services/firestoreService';
import { getCategoriesByWorkstation } from '../../utils/categories';
import { KANBAN_DELIVERED_RETENTION_MINUTES } from '../../utils/constants';

const AdminKanban: React.FC = () => {
  const { orders, loading } = useKitchenOrders();
  const location = useLocation();
  // Determine board mode from pathname (routes are /admin/kanban/cocina and /admin/kanban/barra)
  const path = location.pathname.toLowerCase();
  const board = path.includes('/kanban/barra') ? 'barra' : path.includes('/kanban/cocina') ? 'cocina' : null;

  if (loading) {
    return <div className="text-center py-8">Cargando pedidos...</div>;
  }

  // Flatten items across orders into a list of item-entries with parent order metadata
  type ItemEntry = {
    orderId: string;
    tableNumber?: number;
    waiterName?: string;
    createdAt?: Date | null;
    item: NonNullable<Order['items']>[number];
  };

  const allItems: ItemEntry[] = orders.flatMap(order => (
    (order.items || []).map(item => ({
      orderId: order.id as string,
      tableNumber: order.tableNumber,
      waiterName: order.waiterName,
      createdAt: order.createdAt ?? null,
      item
    }))
  ));

  // Filter and sort by order createdAt (ascending: older first)
  const parseDate = (d: any): Date | null => {
    if (!d) return null;
    if (typeof d.toDate === 'function') return d.toDate();
    if (d instanceof Date) return d;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  // Sort by item's createdAt if present, otherwise fallback to order createdAt
  const sortByCreatedAt = (a: ItemEntry, b: ItemEntry) => {
    const da = parseDate(a.item.createdAt) ?? parseDate(a.createdAt) ?? new Date(0);
    const db = parseDate(b.item.createdAt) ?? parseDate(b.createdAt) ?? new Date(0);
    return da.getTime() - db.getTime();
  };

  // Función para verificar si un item entregado está dentro del tiempo de retención
  const isDeliveredRecently = (item: NonNullable<Order['items']>[number]): boolean => {
    if (item.status !== 'entregado') return true; // No filtrar si no está entregado
    
    // Si no tiene updatedAt, asumimos que es reciente para no ocultarlo
    if (!item.updatedAt) return true;
    
    const updatedDate = parseDate(item.updatedAt);
    if (!updatedDate) return true;
    
    const now = new Date();
    const diffMinutes = (now.getTime() - updatedDate.getTime()) / (1000 * 60);
    
    return diffMinutes <= KANBAN_DELIVERED_RETENTION_MINUTES;
  };

  

  const handleMoveTo = async (orderId: string, itemId: string, newStatus: OrderItemStatus) => {
    // optimistic UI isn't necessary here because realtime subscription will update
    await updateOrderStatusInKanban(orderId, itemId, newStatus);
  };

  const renderItemCard = (entry: ItemEntry) => {
    const { item, orderId, tableNumber, waiterName } = entry;
    const parseDate = (d: any): Date | null => {
      if (!d) return null;
      // Firestore Timestamp
      if (typeof d.toDate === 'function') return d.toDate();
      if (d instanceof Date) return d;
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const dt = parseDate(item.createdAt);
    const timeLabel = dt ? dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
    return (
      <div key={`${orderId}_${item.id}`} className="bg-gray-900 border border-gray-700 rounded-2xl p-3 mb-3 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-amber-300">{tableNumber === 0 ? '🍹 Barra' : `Mesa ${tableNumber ?? '-'}`}</span>
                <span className="text-xs text-gray-400">{waiterName}</span>
              </div>
              <span className="ml-auto text-xs text-gray-400">{timeLabel}</span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-white">{item.productName}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs uppercase bg-white/5 text-gray-200 px-2 py-0.5 rounded">{item.category}</span>
                  {item.notes ? <div className="text-sm text-gray-400">{item.notes}</div> : null}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="inline-block bg-amber-400 text-black text-sm font-bold px-3 py-1 rounded-full">{item.quantity}x</span>
                <span className="mt-2 text-xs uppercase bg-white/5 text-gray-200 px-2 py-0.5 rounded">{item.status}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {item.status === 'pendiente' && (
            <button
              onClick={() => handleMoveTo(orderId, item.id, 'listo')}
              className="px-3 py-1 bg-green-600 text-white rounded-md text-sm font-medium hover:opacity-95"
            >
              Marcar listo
            </button>
          )}
          {item.status === 'listo' && (
            <button
              onClick={() => handleMoveTo(orderId, item.id, 'entregado')}
              className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm font-medium hover:opacity-95"
            >
              Marcar entregado
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderBoard = (label: string, category: string) => {
    // If this is the Cocina board, render a single 3-column kanban that includes
    // items from categories assigned to 'cocina' workstation. Each card will show its category.
    if (label.toLowerCase() === 'cocina') {
      const categories = getCategoriesByWorkstation('cocina').map(c => c.key);
      // gather items from these categories
      const pending = allItems
        .filter(e => categories.includes(e.item.category) && e.item.status === 'pendiente')
        .sort(sortByCreatedAt);

      const ready = allItems
        .filter(e => categories.includes(e.item.category) && e.item.status === 'listo')
        .sort(sortByCreatedAt);

      const delivered = allItems
        .filter(e => 
          categories.includes(e.item.category) && 
          e.item.status === 'entregado' &&
          isDeliveredRecently(e.item) // Solo mostrar entregados recientes
        )
        .sort(sortByCreatedAt);

      return (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-200">{label}</h2>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KanbanColumn title={`Pendientes (${pending.length})`}>
                {pending.length === 0 ? (
                  <p className="text-sm text-gray-400">No hay ítems pendientes.</p>
                ) : (
                  pending.map(renderItemCard)
                )}
              </KanbanColumn>

              <KanbanColumn title={`Listos (${ready.length})`}>
                {ready.length === 0 ? (
                  <p className="text-sm text-gray-400">No hay ítems listos.</p>
                ) : (
                  ready.map(renderItemCard)
                )}
              </KanbanColumn>

              <KanbanColumn title={`Entregados (${delivered.length})`}>
                {delivered.length === 0 ? (
                  <p className="text-sm text-gray-400">No hay ítems entregados.</p>
                ) : (
                  delivered.map(renderItemCard)
                )}
              </KanbanColumn>
            </div>

            {/* Optional legend showing counts per category inside Cocina */}
            <div className="mt-4 flex gap-3 text-sm text-gray-300">
              {categories.map(cat => {
                // Only count items that are in the kanban (Entrada/Comida/Postre)
                // and whose status is pendiente or listo (exclude entregado from count)
                const allowedStatuses = new Set(['pendiente', 'listo']);
                const count = allItems.filter(e => e.item.category === cat && allowedStatuses.has(e.item.status)).length;
                return (
                  <div key={cat} className="px-2 py-1 bg-white/5 rounded">
                    <span className="text-amber-300 font-semibold">{cat}</span>
                    <span className="ml-2">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Default behavior for other boards (e.g., Barra)
    const catPending = allItems
      .filter(e => e.item.category === category && e.item.status === 'pendiente')
      .sort(sortByCreatedAt);

    const catReady = allItems
      .filter(e => e.item.category === category && e.item.status === 'listo')
      .sort(sortByCreatedAt);

    const catDelivered = allItems
      .filter(e => 
        e.item.category === category && 
        e.item.status === 'entregado' &&
        isDeliveredRecently(e.item) // Solo mostrar entregados recientes
      )
      .sort(sortByCreatedAt);

    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-200">{label}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KanbanColumn title={`Pendientes (${catPending.length})`}>
            {catPending.length === 0 ? (
              <p className="text-sm text-gray-400">No hay ítems pendientes.</p>
            ) : (
              catPending.map(renderItemCard)
            )}
          </KanbanColumn>

          <KanbanColumn title={`Listos (${catReady.length})`}>
            {catReady.length === 0 ? (
              <p className="text-sm text-gray-400">No hay ítems listos.</p>
            ) : (
              catReady.map(renderItemCard)
            )}
          </KanbanColumn>

          <KanbanColumn title={`Entregados (${catDelivered.length})`}>
            {catDelivered.length === 0 ? (
              <p className="text-sm text-gray-400">No hay ítems entregados.</p>
            ) : (
              catDelivered.map(renderItemCard)
            )}
          </KanbanColumn>
        </div>
      </div>
    );
  };

  // Decide which board(s) to show based on the route param
  const showCocina = !board || board === 'cocina';
  const showBarra = !board || board === 'barra';

  // If only one of the boards is shown, use a single-column layout so it takes full width
  const gridColsClass = (showCocina && showBarra) ? 'lg:grid-cols-2' : 'lg:grid-cols-1';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Kanban</h1>
        <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span className="text-sm text-gray-400">
            Entregados: últimos {KANBAN_DELIVERED_RETENTION_MINUTES} min
          </span>
        </div>
      </div>
      <div className={`grid grid-cols-1 ${gridColsClass} gap-8`}>
        {showCocina && renderBoard('Cocina', 'Comida')}
        {showBarra && renderBoard('Barra', 'Bebida')}
      </div>
    </div>
  );
};

export default AdminKanban;
