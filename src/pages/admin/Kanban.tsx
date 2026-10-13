// src/pages/admin/Kanban.tsx
import React, { useEffect, useRef } from 'react';
import { useKitchenOrders } from '../../hooks/useKitchenOrders';
import { useLocation } from 'react-router-dom';
import StationBoard from '../../components/common/StationBoard';

import { getCategoriesByWorkstation } from '../../utils/categories';
import { KANBAN_DELIVERED_RETENTION_MINUTES } from '../../utils/constants';
import { playNotificationSound } from '../../utils/notificationSound';

const AdminKanban: React.FC = () => {
  const { orders, loading } = useKitchenOrders();
  const location = useLocation();
  // Determine board mode from pathname (routes are /admin/kanban/cocina and /admin/kanban/barra)
  const path = location.pathname.toLowerCase();
  const board = path.includes('/kanban/barra') ? 'barra' : path.includes('/kanban/cocina') ? 'cocina' : null;
  
  // Track previous pending items count to detect new orders
  const prevPendingCountRef = useRef<number>(0);
  const isFirstRenderRef = useRef<boolean>(true);
  const [soundEnabled, setSoundEnabled] = React.useState<boolean>(false);
  
  // Enable sound with user interaction
  const enableSound = () => {
    console.log('🔊 Habilitando notificaciones sonoras...');
    // Play a test sound to unlock audio
    playNotificationSound();
    setSoundEnabled(true);
    localStorage.setItem('kanban-sound-enabled', 'true');
  };
  
  // Check if sound was previously enabled
  React.useEffect(() => {
    const enabled = localStorage.getItem('kanban-sound-enabled') === 'true';
    setSoundEnabled(enabled);
  }, []);

  // Decide which board(s) to show based on the route param
  const showCocina = !board || board === 'cocina';
  const showBarra = !board || board === 'barra';

  // Calculate pending items for current board
  const cocinaCategories = getCategoriesByWorkstation('cocina').map(c => c.key);
  const barraCategories = getCategoriesByWorkstation('barra').map(c => c.key);
  
  const relevantCategories = [
    ...(showCocina ? cocinaCategories : []),
    ...(showBarra ? barraCategories : [])
  ];
  
  const currentPendingCount = orders.reduce((sum, order) =>
    sum + (order.items || []).filter(i => relevantCategories.includes(i.category) && i.status === 'pendiente' && !i.isDeleted).length, 0);

  // Play notification sound when new pending items arrive
  useEffect(() => {
    if (loading) return; // Don't play sound while loading
    
    if (isFirstRenderRef.current) {
      // Skip on first render
      isFirstRenderRef.current = false;
      prevPendingCountRef.current = currentPendingCount;
      return;
    }

    if (currentPendingCount > prevPendingCountRef.current) {
      // New pending items detected!
      if (soundEnabled) {
        console.log('🔔 Nuevo pedido detectado, reproduciendo sonido...');
        playNotificationSound();
      } else {
        console.log('🔕 Nuevo pedido detectado pero sonido deshabilitado');
      }
    }

    prevPendingCountRef.current = currentPendingCount;
  }, [currentPendingCount, loading, soundEnabled]);

  if (loading) {
    return <div className="text-center py-8">Cargando pedidos...</div>;
  }


  const renderBoard = (label: string, workstation: 'cocina' | 'barra') => (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
        <span>{workstation === 'barra' ? '🍹' : '👨‍🍳'}</span>
        <span>{label}</span>
      </h2>
      <StationBoard orders={orders} station={workstation} />
    </div>
  );

  // If only one of the boards is shown, use a single-column layout so it takes full width
  const gridColsClass = (showCocina && showBarra) ? 'lg:grid-cols-2' : 'lg:grid-cols-1';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Kanban</h1>
        <div className="flex items-center gap-3">
          {!soundEnabled && (
            <button
              onClick={enableSound}
              className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg border border-red-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
              </svg>
              <span className="text-sm font-medium">Habilitar Sonido</span>
            </button>
          )}
          {soundEnabled && (
            <div className="flex items-center gap-2 bg-green-600/20 text-green-400 px-4 py-2 rounded-lg border border-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
              </svg>
              <span className="text-sm font-medium">Sonido Activo</span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-gray-800 px-4 py-2 rounded-lg border border-gray-800">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span className="text-sm text-gray-400">
              Entregados: últimos {KANBAN_DELIVERED_RETENTION_MINUTES} min
            </span>
          </div>
        </div>
      </div>
      <div className={`grid grid-cols-1 ${gridColsClass} gap-8`}>
        {showCocina && renderBoard('Cocina', 'cocina')}
        {showBarra && renderBoard('Barra', 'barra')}
      </div>
    </div>
  );
};

export default AdminKanban;
