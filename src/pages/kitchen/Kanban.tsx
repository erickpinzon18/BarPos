// src/pages/kitchen/Kanban.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useKitchenOrders } from '../../hooks/useKitchenOrders';
import KanbanColumn from '../../components/common/KanbanColumn';
import { updateOrderStatusInKanban } from '../../services/firestoreService';
import type { Order, OrderItemStatus } from '../../utils/types';
import { getCategoriesByWorkstation } from '../../utils/categories';
import { KANBAN_DELIVERED_RETENTION_MINUTES } from '../../utils/constants';

const KitchenKanban: React.FC = () => {
  const { orders, loading } = useKitchenOrders();
  const location = useLocation();
  
  // Determine board mode from pathname (/kitchen/cocina or /kitchen/barra)
  const path = location.pathname.toLowerCase();
  const station = path.includes('/barra') ? 'barra' : 'cocina';
  const stationLabel = station === 'barra' ? 'Barra' : 'Cocina';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando pedidos...</p>
        </div>
      </div>
    );
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

  // Helper to parse dates
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

  // Filter delivered items by retention time
  const isDeliveredRecently = (item: NonNullable<Order['items']>[number]): boolean => {
    if (item.status !== 'entregado') return true;
    if (!item.updatedAt) return true;
    
    const updatedDate = parseDate(item.updatedAt);
    if (!updatedDate) return true;
    
    const now = new Date();
    const diffMinutes = (now.getTime() - updatedDate.getTime()) / (1000 * 60);
    
    return diffMinutes <= KANBAN_DELIVERED_RETENTION_MINUTES;
  };

  // Handle status change
  const handleMoveTo = async (orderId: string, itemId: string, newStatus: OrderItemStatus) => {
    await updateOrderStatusInKanban(orderId, itemId, newStatus);
  };

  // Render item card
  const renderItemCard = (entry: ItemEntry) => {
    const { item, orderId, tableNumber, waiterName } = entry;
    const dt = parseDate(item.createdAt);
    const timeLabel = dt ? dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <div key={`${orderId}_${item.id}`} className="bg-gray-900 border border-gray-700 rounded-2xl p-4 mb-3 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-white">
                  {tableNumber === 0 ? '🍹 Barra' : `Mesa ${tableNumber ?? '?'}`}
                </span>
                {item.quantity > 1 && (
                  <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-2 py-1 rounded-full">
                    x{item.quantity}
                  </span>
                )}
              </div>
              <span className="ml-auto text-xs text-gray-400">{timeLabel}</span>
            </div>

            <div className="mt-2">
              <p className="text-base font-semibold text-gray-200">{item.productName}</p>
              <p className="text-xs text-gray-400 mt-1">Mesero: {waiterName ?? 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex items-center justify-end gap-2">
          {item.status === 'pendiente' && (
            <button
              onClick={() => handleMoveTo(orderId, item.id, 'listo')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              ✓ Marcar Listo
            </button>
          )}
          {item.status === 'listo' && (
            <button
              onClick={() => handleMoveTo(orderId, item.id, 'entregado')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              → Marcar Entregado
            </button>
          )}
        </div>
      </div>
    );
  };

  // Get categories for the current station
  const categories = getCategoriesByWorkstation(station).map(c => c.key);

  // Filter items by station categories
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
      isDeliveredRecently(e.item)
    )
    .sort(sortByCreatedAt);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <span>{station === 'barra' ? '🍹' : '👨‍🍳'}</span>
          <span>Kanban de {stationLabel}</span>
        </h1>
        <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span className="text-sm text-gray-400">
            Entregados: últimos {KANBAN_DELIVERED_RETENTION_MINUTES} min
          </span>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pendientes */}
          <KanbanColumn title={`Pendientes (${pending.length})`}>
            {pending.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>✓ Todo listo</p>
              </div>
            ) : (
              pending.map(renderItemCard)
            )}
          </KanbanColumn>

          {/* Listos */}
          <KanbanColumn title={`Listos (${ready.length})`}>
            {ready.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Sin pedidos listos</p>
              </div>
            ) : (
              ready.map(renderItemCard)
            )}
          </KanbanColumn>

          {/* Entregados */}
          <KanbanColumn title={`Entregados (${delivered.length})`}>
            {delivered.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Sin entregas recientes</p>
              </div>
            ) : (
              delivered.map(renderItemCard)
            )}
          </KanbanColumn>
        </div>

        {/* Legend */}
        <div className="mt-4 flex gap-3 text-sm text-gray-300">
          {getCategoriesByWorkstation(station).map(cat => (
            <div key={cat.key} className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${cat.color}`}></span>
              <span>{cat.icon} {cat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KitchenKanban;
