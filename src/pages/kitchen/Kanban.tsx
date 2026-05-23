// src/pages/kitchen/Kanban.tsx
import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useKitchenOrders } from '../../hooks/useKitchenOrders';
import KanbanColumn from '../../components/common/KanbanColumn';
import type { Order } from '../../utils/types';
import { getCategoriesByWorkstation } from '../../utils/categories';
import { playNotificationSound } from '../../utils/notificationSound';
import { printStationTicket } from '../../utils/printStationTicket';
import { usePrintQueue } from '../../hooks/usePrintQueue';
import type { PaperSize } from '../../utils/printTicket';

const KitchenKanban: React.FC = () => {
  const { orders, loading } = useKitchenOrders();
  const location = useLocation();

  const path = location.pathname.toLowerCase();
  const station = path.includes('/barra') ? 'barra' : 'cocina';
  const stationLabel = station === 'barra' ? 'Barra' : 'Cocina';

  // Escuchar la cola de impresión de Firestore y auto-imprimir en este dispositivo
  usePrintQueue(station);

  const prevPendingCountRef = useRef<number>(0);
  const isFirstRenderRef = useRef<boolean>(true);
  const [soundEnabled, setSoundEnabled] = React.useState<boolean>(false);

  const enableSound = () => {
    playNotificationSound();
    setSoundEnabled(true);
    localStorage.setItem('kitchen-sound-enabled', 'true');
  };

  React.useEffect(() => {
    const enabled = localStorage.getItem('kitchen-sound-enabled') === 'true';
    setSoundEnabled(enabled);
  }, []);

  type ItemEntry = {
    orderId: string;
    tableNumber?: number;
    waiterName?: string;
    createdAt?: Date | null;
    item: NonNullable<Order['items']>[number];
  };

  const allItems: ItemEntry[] = orders.flatMap(order =>
    (order.items || []).map(item => ({
      orderId: order.id as string,
      tableNumber: order.tableNumber,
      waiterName: order.waiterName,
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

  const categories = getCategoriesByWorkstation(station).map(c => c.key);

  // Barra only cares about pendiente items (informative — no status changes here)
  const pending = allItems
    .filter(e => categories.includes(e.item.category) && e.item.status === 'pendiente' && !e.item.isDeleted)
    .sort(sortByCreatedAt);

  const delivered = allItems
    .filter(e => categories.includes(e.item.category) && e.item.status === 'entregado' && !e.item.isDeleted)
    .sort(sortByCreatedAt);

  // Sound on new pending items
  useEffect(() => {
    if (loading) return;
    const currentPendingCount = pending.length;

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevPendingCountRef.current = currentPendingCount;
      return;
    }

    if (currentPendingCount > prevPendingCountRef.current && soundEnabled) {
      playNotificationSound();
    }

    prevPendingCountRef.current = currentPendingCount;
  }, [pending.length, loading, soundEnabled]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${station === 'barra' ? 'border-purple-400' : 'border-orange-400'} mx-auto mb-4`}></div>
          <p className="text-gray-400">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  const renderItemCard = (entry: ItemEntry, isDelivered = false) => {
    const { item, tableNumber, waiterName } = entry;
    const dt = parseDate(item.createdAt);
    const timeLabel = dt ? dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <div
        key={`${entry.orderId}_${item.id}`}
        className={`border rounded-2xl p-4 mb-3 shadow-sm transition-opacity ${
          isDelivered
            ? 'bg-gray-900/50 border-gray-700 opacity-50'
            : 'bg-gray-900 border-gray-800'
        }`}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-lg font-bold text-white">
            {tableNumber === 0 ? '🍹 Barra' : `Mesa ${tableNumber ?? '?'}`}
          </span>
          {item.quantity > 1 && (
            <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded-full">
              x{item.quantity}
            </span>
          )}
          <span className="ml-auto text-xs text-gray-400">{timeLabel}</span>
        </div>

        <p className="text-base font-semibold text-gray-200">{item.productName}</p>
        {item.notes && (
          <p className="text-xs text-amber-400 mt-1 italic">📝 {item.notes}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">Mesero: {waiterName ?? 'N/A'}</p>

        {/* READ-ONLY — no action buttons. Mesero manages statuses. */}
        {isDelivered && (
          <div className="mt-2">
            <span className="text-xs text-gray-500 font-medium">✅ Recogido por mesero</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <span>{station === 'barra' ? '🍹' : '👨‍🍳'}</span>
          <span>Tablero de {stationLabel}</span>
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          {/* Sound toggle */}
          {!soundEnabled ? (
            <button
              onClick={enableSound}
              className={`flex items-center gap-2 ${
                station === 'barra'
                  ? 'bg-purple-600 hover:bg-purple-700 border-purple-500'
                  : 'bg-orange-600 hover:bg-orange-700 border-orange-500'
              } text-white px-4 py-2 rounded-lg border transition-colors`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                ></path>
              </svg>
              <span className="text-sm font-medium">Habilitar Sonido</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-green-600/20 text-green-400 px-4 py-2 rounded-lg border border-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                ></path>
              </svg>
              <span className="text-sm font-medium">Sonido Activo</span>
            </div>
          )}

          {/* Test print button — barra only */}
          {station === 'barra' && (
            <div className="flex gap-2">
              {(['58mm', '80mm'] as PaperSize[]).map(size => (
                <button
                  key={size}
                  onClick={() => printStationTicket({
                    station: 'barra',
                    tableNumber: 5,
                    tableName: 'VIP',
                    waiterName: 'Mesero Prueba',
                    items: [
                      { productName: 'Whisky Jack Daniels', quantity: 1, notes: 'Servicios: 3x Coca Cola, 2x Agua Mineral' },
                      { productName: 'Vodka Absolut', quantity: 2 },
                    ],
                    paperSize: size,
                  })}
                  className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-2 rounded-lg border border-purple-500 transition-colors"
                >
                  🖨️ Probar {size}
                </button>
              ))}
            </div>
          )}

          {/* Info badge — read-only reminder */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm ${
            station === 'barra'
              ? 'bg-purple-900/20 border-purple-700/50 text-purple-300'
              : 'bg-orange-900/20 border-orange-700/50 text-orange-300'
          }`}>
            <span>👁️ Solo lectura · Mesero gestiona los estados</span>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Por preparar */}
          <KanbanColumn title={`Por Preparar (${pending.length})`}>
            {pending.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <p className="text-3xl mb-3">✓</p>
                <p className="font-medium">Sin pedidos pendientes</p>
                <p className="text-xs mt-1">Todo está al día</p>
              </div>
            ) : (
              pending.map(e => renderItemCard(e, false))
            )}
          </KanbanColumn>

          {/* Entregados recientes */}
          <KanbanColumn title={`Recogidos por mesero (${delivered.length})`}>
            {delivered.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <p className="text-3xl mb-3">📭</p>
                <p>Sin entregas aún</p>
              </div>
            ) : (
              delivered.map(e => renderItemCard(e, true))
            )}
          </KanbanColumn>

        </div>

        {/* Category legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-300">
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
