// src/pages/waiter/Kanban.tsx
import React from 'react';
import { useKitchenOrders } from '../../hooks/useKitchenOrders';
import KanbanColumn from '../../components/common/KanbanColumn';
import { updateOrderStatusInKanban } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import type { Order } from '../../utils/types';
import { KANBAN_DELIVERED_RETENTION_MINUTES } from '../../utils/constants';

const WaiterKanban: React.FC = () => {
  const { orders, loading } = useKitchenOrders();
  const { currentUser } = useAuth();

  type ItemEntry = {
    orderId: string;
    tableNumber?: number | string;
    tableName?: string;
    waiterId?: string;
    createdAt?: Date | null;
    item: NonNullable<Order['items']>[number];
  };

  const allItems: ItemEntry[] = orders.flatMap(order =>
    (order.items || []).map(item => ({
      orderId: order.id as string,
      tableNumber: order.tableNumber,
      tableName: order.tableName,
      waiterId: order.waiterId,
      createdAt: order.createdAt ?? null,
      item
    }))
  );

  const parseDate = (d: any): Date | null => {
    if (!d) return null;
    if (typeof d.toDate === 'function') return d.toDate();
    if (d instanceof Date) return d;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const sortByCreatedAt = (a: ItemEntry, b: ItemEntry) => {
    const da = parseDate(a.item.createdAt) ?? parseDate(a.createdAt) ?? new Date(0);
    const db = parseDate(b.item.createdAt) ?? parseDate(b.createdAt) ?? new Date(0);
    return da.getTime() - db.getTime();
  };

  // Only this waiter's non-deleted items
  const myItems = allItems.filter(e =>
    !e.item.isDeleted && (currentUser ? e.waiterId === currentUser.id : true)
  );

  const pending = myItems
    .filter(e => e.item.status === 'pendiente')
    .sort(sortByCreatedAt);

  // Delivered: filter by retention window so the list doesn't grow forever
  const delivered = myItems
    .filter(e => {
      if (e.item.status !== 'entregado') return false;
      const updated = parseDate(e.item.updatedAt);
      if (!updated) return true;
      const diffMin = (Date.now() - updated.getTime()) / 60000;
      return diffMin <= KANBAN_DELIVERED_RETENTION_MINUTES;
    })
    .sort(sortByCreatedAt);

  // Mark item as picked up
  const handlePickUp = async (orderId: string, itemId: string) => {
    await updateOrderStatusInKanban(orderId, itemId, 'entregado');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  const renderItemCard = (entry: ItemEntry, showPickup: boolean) => {
    const { item, orderId, tableNumber, tableName } = entry;
    const dt = parseDate(item.createdAt);
    const timeLabel = dt
      ? dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : '';
    const isBar = tableNumber === 0;
    const tableLabel = isBar ? '🍹 Barra' : `Mesa ${tableNumber ?? '?'}`;
    const displayName = tableName || tableLabel;

    return (
      <div
        key={`${orderId}_${item.id}`}
        className={`rounded-2xl p-4 mb-3 shadow-sm border transition-all ${
          showPickup
            ? 'bg-yellow-950/30 border-yellow-700/40 ring-1 ring-yellow-700/20'
            : 'bg-gray-900/60 border-gray-700/50 opacity-70'
        }`}
      >
        {/* Table + time */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-base font-bold ${isBar ? 'text-purple-300' : 'text-white'}`}>
            {displayName}
          </span>
          <div className="flex items-center gap-2">
            {item.quantity > 1 && (
              <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full">
                x{item.quantity}
              </span>
            )}
            <span className="text-xs text-gray-500">{timeLabel}</span>
          </div>
        </div>

        {/* Product */}
        <p className="text-base font-semibold text-gray-100">{item.productName}</p>
        {item.notes && (
          <p className="text-xs text-amber-400 mt-1 italic">📝 {item.notes}</p>
        )}

        {/* Action */}
        {showPickup && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => handlePickUp(orderId, item.id)}
              className="px-5 py-2 bg-green-600 hover:bg-green-500 active:scale-95 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-green-900/40"
            >
              ✋ Marcar Recogido
            </button>
          </div>
        )}

        {!showPickup && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-xs text-green-500 font-medium">✅ Entregado</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span>🍽️</span>
            <span>Mis Pedidos</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {currentUser?.displayName || currentUser?.email} · Solo ves tus mesas
          </p>
        </div>

        {pending.length > 0 && (
          <div className="flex items-center gap-2 bg-yellow-600/20 text-yellow-300 px-4 py-2 rounded-lg border border-yellow-600/50">
            <span className="text-sm font-semibold">
              ⏳ {pending.length} pedido{pending.length > 1 ? 's' : ''} en espera
            </span>
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Pendientes — en espera de que barra prepare, mesero recoge */}
          <KanbanColumn title={`Pendientes (${pending.length})`}>
            {pending.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <p className="text-3xl mb-3">✓</p>
                <p className="font-medium">Sin pedidos pendientes</p>
                <p className="text-xs mt-1 text-gray-600">
                  Cuando pidas algo aparecerá aquí
                </p>
              </div>
            ) : (
              pending.map(e => renderItemCard(e, true))
            )}
          </KanbanColumn>

          {/* Entregados recientes */}
          <KanbanColumn title={`Entregados (${delivered.length})`}>
            {delivered.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <p className="text-3xl mb-3">📭</p>
                <p>Sin entregas recientes</p>
                <p className="text-xs mt-1 text-gray-600">
                  Últimos {KANBAN_DELIVERED_RETENTION_MINUTES} min
                </p>
              </div>
            ) : (
              delivered.map(e => renderItemCard(e, false))
            )}
          </KanbanColumn>

        </div>
      </div>
    </div>
  );
};

export default WaiterKanban;
