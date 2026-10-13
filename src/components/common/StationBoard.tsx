// src/components/common/StationBoard.tsx
// Tablero por estación (barra / cocina): agrupa los items por mesa y permite
// marcarlos como entregados (o regresarlos a pendiente) desde el propio tablero.
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import KanbanColumn from './KanbanColumn';
import type { Order, OrderItem } from '../../utils/types';
import { getCategoriesByWorkstation, getCategoryInfo } from '../../utils/categories';
import { KANBAN_DELIVERED_RETENTION_MINUTES } from '../../utils/constants';
import { updateItemsStatus } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';

type Station = 'cocina' | 'barra';

interface StationBoardProps {
  orders: Order[];
  station: Station;
}

interface OrderGroup {
  order: Order;
  pending: OrderItem[];
  delivered: OrderItem[];
  cancelled: OrderItem[];
  oldestPending: Date | null;
}

const parseDate = (d: any): Date | null => {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate();
  if (d instanceof Date) return d;
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const formatTime = (d: Date | null) =>
  d ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

const minutesSince = (d: Date | null, now: number) =>
  d ? Math.max(0, Math.floor((now - d.getTime()) / 60000)) : 0;

const formatWait = (min: number) => {
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
};

// Color del tiempo de espera: verde < 10 min, amarillo < 20 min, rojo después
const waitColor = (min: number) =>
  min >= 20 ? 'bg-red-500/20 text-red-300 border-red-500/40'
  : min >= 10 ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
  : 'bg-green-500/15 text-green-300 border-green-500/30';

const isRecent = (d: Date | null, now: number) =>
  !d || (now - d.getTime()) / 60000 <= KANBAN_DELIVERED_RETENTION_MINUTES;

// Re-render periódico para que los tiempos de espera avancen solos
const useNow = (intervalMs: number) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
};

export const StationBoard: React.FC<StationBoardProps> = ({ orders, station }) => {
  const { currentUser } = useAuth();
  const now = useNow(30000);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const categories = getCategoriesByWorkstation(station).map(c => c.key);
  const itemCreated = (item: OrderItem, order: Order) => parseDate(item.createdAt) ?? parseDate(order.createdAt);

  const groups: OrderGroup[] = orders.map(order => {
    const stationItems = (order.items || []).filter(i => categories.includes(i.category));
    const pending = stationItems
      .filter(i => i.status === 'pendiente' && !i.isDeleted)
      .sort((a, b) => (itemCreated(a, order)?.getTime() ?? 0) - (itemCreated(b, order)?.getTime() ?? 0));
    const delivered = stationItems
      .filter(i => i.status === 'entregado' && !i.isDeleted && isRecent(parseDate(i.deliveredAt) ?? parseDate(i.updatedAt), now))
      .sort((a, b) => (parseDate(b.deliveredAt ?? b.updatedAt)?.getTime() ?? 0) - (parseDate(a.deliveredAt ?? a.updatedAt)?.getTime() ?? 0));
    const cancelled = stationItems
      .filter(i => i.isDeleted && isRecent(parseDate(i.deletedAt), now));
    const oldestPending = pending.length ? itemCreated(pending[0], order) : null;
    return { order, pending, delivered, cancelled, oldestPending };
  });

  const pendingGroups = groups
    .filter(g => g.pending.length > 0)
    .sort((a, b) => (a.oldestPending?.getTime() ?? 0) - (b.oldestPending?.getTime() ?? 0));

  // Los cancelados se muestran en la tarjeta de pendientes si la mesa tiene pendientes; si no, en entregados
  const deliveredGroups = groups
    .filter(g => g.delivered.length > 0 || (g.pending.length === 0 && g.cancelled.length > 0))
    .sort((a, b) => {
      const last = (g: OrderGroup) => parseDate(g.delivered[0]?.deliveredAt ?? g.delivered[0]?.updatedAt ?? g.cancelled[0]?.deletedAt)?.getTime() ?? 0;
      return last(b) - last(a);
    });

  const pendingCount = pendingGroups.reduce((s, g) => s + g.pending.reduce((q, i) => q + (i.quantity || 1), 0), 0);
  const oldestWait = pendingGroups.length ? minutesSince(pendingGroups[0].oldestPending, now) : 0;

  const changeStatus = async (orderId: string, itemIds: string[], status: OrderItem['status']) => {
    const keys = itemIds.map(id => `${orderId}_${id}`);
    setBusy(prev => new Set([...prev, ...keys]));
    const res = await updateItemsStatus(
      orderId,
      itemIds,
      status,
      currentUser ? { id: currentUser.id, name: currentUser.displayName || currentUser.email } : undefined
    );
    if (!res.success) toast.error(res.error || 'No se pudo actualizar');
    setBusy(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.delete(k));
      return next;
    });
  };

  const tableTitle = (order: Order) => {
    const base = order.tableNumber === 0 ? '🍹 Barra' : `Mesa ${order.tableNumber ?? '?'}`;
    return order.tableName ? `${base} · ${order.tableName}` : base;
  };

  const renderOrderHeader = (g: OrderGroup, showWait: boolean) => {
    const wait = minutesSince(g.oldestPending, now);
    return (
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-white truncate">{tableTitle(g.order)}</p>
          <p className="text-xs text-gray-400">
            👤 {g.order.waiterName || 'N/A'}
            {g.order.peopleCount ? ` · 👥 ${g.order.peopleCount}` : ''}
            {parseDate(g.order.createdAt) ? ` · Abierta ${formatTime(parseDate(g.order.createdAt))}` : ''}
          </p>
        </div>
        {showWait && (
          <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full border ${waitColor(wait)}`}>
            ⏱ {formatWait(wait)}
          </span>
        )}
      </div>
    );
  };

  const renderItemDetail = (item: OrderItem) => {
    const cat = getCategoryInfo(item.category);
    return (
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="bg-red-500 text-black text-sm font-bold px-2 py-0.5 rounded-full shrink-0">{item.quantity}x</span>
          <span className="text-base font-semibold text-gray-100 break-words">{item.productName}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
          {cat && <span>{cat.icon} {cat.label}</span>}
          {item.swapFromName && <span className="text-sky-300">🔄 Cambio de: {item.swapFromName}</span>}
        </div>
        {item.notes && <p className="text-sm text-amber-400 mt-1 italic">📝 {item.notes}</p>}
      </div>
    );
  };

  const renderCancelled = (items: OrderItem[]) =>
    items.length > 0 && (
      <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
        {items.map(item => (
          <div key={item.id} className="text-xs text-red-400">
            <span className="line-through">{item.quantity}x {item.productName}</span>
            <span className="ml-2 font-semibold">❌ Cancelado{item.deletedByName ? ` por ${item.deletedByName}` : ''}</span>
            {item.cancelReason && <span className="text-red-300/80"> · {item.cancelReason}</span>}
          </div>
        ))}
      </div>
    );

  const renderPendingCard = (g: OrderGroup) => {
    const orderId = g.order.id;
    const allBusy = g.pending.every(i => busy.has(`${orderId}_${i.id}`));
    return (
      <div key={orderId} className="bg-gray-900 border border-gray-700 rounded-2xl p-4 shadow-sm">
        {renderOrderHeader(g, true)}
        <div className="space-y-3">
          {g.pending.map(item => {
            const created = itemCreated(item, g.order);
            const isBusy = busy.has(`${orderId}_${item.id}`);
            return (
              <div key={item.id} className="flex items-start gap-3 bg-gray-800/60 rounded-xl p-3">
                {renderItemDetail(item)}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-gray-400">
                    {formatTime(created)} · {formatWait(minutesSince(created, now))}
                  </span>
                  <span className={`text-[11px] ${item.printedAt ? 'text-gray-500' : 'text-orange-400'}`}>
                    {item.printedAt ? '🖨️ Impreso' : '🖨️ Sin imprimir'}
                  </span>
                  <button
                    onClick={() => changeStatus(orderId, [item.id], 'entregado')}
                    disabled={isBusy}
                    className="mt-1 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 active:scale-95 text-white rounded-xl text-sm font-bold transition-all"
                  >
                    {isBusy ? '...' : '✓ Entregar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {renderCancelled(g.cancelled)}
        {g.pending.length > 1 && (
          <button
            onClick={() => changeStatus(orderId, g.pending.map(i => i.id), 'entregado')}
            disabled={allBusy}
            className="mt-3 w-full py-2.5 bg-green-700/80 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
          >
            ✓ Entregar todo ({g.pending.length})
          </button>
        )}
      </div>
    );
  };

  const renderDeliveredCard = (g: OrderGroup) => {
    const orderId = g.order.id;
    return (
      <div key={orderId} className="bg-gray-900/50 border border-gray-700/60 rounded-2xl p-4">
        {renderOrderHeader(g, false)}
        <div className="space-y-2">
          {g.delivered.map(item => {
            const deliveredAt = parseDate(item.deliveredAt ?? item.updatedAt);
            const isBusy = busy.has(`${orderId}_${item.id}`);
            return (
              <div key={item.id} className="flex items-start gap-3 rounded-xl p-2 opacity-80">
                {renderItemDetail(item)}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-green-400 font-medium">
                    ✅ {formatTime(deliveredAt)}{item.deliveredByName ? ` · ${item.deliveredByName}` : ''}
                  </span>
                  <button
                    onClick={() => changeStatus(orderId, [item.id], 'pendiente')}
                    disabled={isBusy}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded-lg text-xs font-medium transition-colors"
                  >
                    {isBusy ? '...' : '↩ Regresar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {g.pending.length === 0 && renderCancelled(g.cancelled)}
      </div>
    );
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-200">
          🧾 Mesas en espera: <b className="text-white">{pendingGroups.length}</b>
        </span>
        <span className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-200">
          ⏳ Productos por entregar: <b className="text-white">{pendingCount}</b>
        </span>
        {pendingGroups.length > 0 && (
          <span className={`px-3 py-1.5 rounded-lg border ${waitColor(oldestWait)}`}>
            ⏱ Espera más larga: <b>{formatWait(oldestWait)}</b>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KanbanColumn title={`Por Entregar (${pendingGroups.length})`}>
          {pendingGroups.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p className="text-3xl mb-3">✓</p>
              <p className="font-medium">Sin pedidos pendientes</p>
              <p className="text-xs mt-1">Todo está al día</p>
            </div>
          ) : (
            pendingGroups.map(renderPendingCard)
          )}
        </KanbanColumn>

        <KanbanColumn title={`Entregados · últimos ${KANBAN_DELIVERED_RETENTION_MINUTES} min (${deliveredGroups.length})`}>
          {deliveredGroups.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <p className="text-3xl mb-3">📭</p>
              <p>Sin entregas recientes</p>
            </div>
          ) : (
            deliveredGroups.map(renderDeliveredCard)
          )}
        </KanbanColumn>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-300">
        {getCategoriesByWorkstation(station).map(cat => (
          <div key={cat.key} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${cat.color}`}></span>
            <span>{cat.icon} {cat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StationBoard;
