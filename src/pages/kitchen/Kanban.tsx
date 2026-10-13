// src/pages/kitchen/Kanban.tsx
import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useKitchenOrders } from '../../hooks/useKitchenOrders';
import StationBoard from '../../components/common/StationBoard';
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

  const categories = getCategoriesByWorkstation(station).map(c => c.key);

  const pendingCount = orders.reduce((sum, order) =>
    sum + (order.items || []).filter(i => categories.includes(i.category) && i.status === 'pendiente' && !i.isDeleted).length, 0);

  // Sound on new pending items
  useEffect(() => {
    if (loading) return;
    const currentPendingCount = pendingCount;

    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevPendingCountRef.current = currentPendingCount;
      return;
    }

    if (currentPendingCount > prevPendingCountRef.current && soundEnabled) {
      playNotificationSound();
    }

    prevPendingCountRef.current = currentPendingCount;
  }, [pendingCount, loading, soundEnabled]);

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

        </div>
      </div>

      <StationBoard orders={orders} station={station} />
    </div>
  );
};

export default KitchenKanban;
