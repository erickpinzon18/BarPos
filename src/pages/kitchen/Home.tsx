// src/pages/kitchen/Home.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTables } from '../../hooks/useTables';
import { useActiveOrders } from '../../hooks/useOrders';
import { useAuth } from '../../contexts/AuthContext';
import { createEmptyOrder } from '../../services/orderService';
import toast from 'react-hot-toast';
import type { Table } from '../../utils/types';

const KitchenHome: React.FC = () => {
  const navigate = useNavigate();
  const { tables, loading: tablesLoading, error: tablesError } = useTables();
  const { orders, loading: ordersLoading, error: ordersError } = useActiveOrders();
  const { currentUser } = useAuth();
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);

  const loading = tablesLoading || ordersLoading;
  const error = tablesError || ordersError;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  const handleTableClick = async (table: Table) => {
    console.log('🖱️ Click en mesa:', table.number, '| status:', table.status);

    if (table.status === 'ocupada') {
      const currentOrder = orders.find(order => order.tableId === table.id);
      if (currentOrder) {
        navigate(`/kitchen/order/${table.id}`);
      }
      return;
    }

    // Libre (o cualquier otro estado) → abrir nueva orden
    if (!currentUser) {
      toast.error('No hay usuario autenticado');
      return;
    }

    if (openingTableId) return; // evitar doble click

    setOpeningTableId(table.id);
    const toastId = toast.loading(`Abriendo ${table.number === 0 ? 'Barra' : `Mesa ${table.number}`}...`);
    try {
      console.log('📝 Creando orden para mesa', table.number, 'con usuario:', currentUser.id);
      await createEmptyOrder(
        table.id,
        table.number,
        currentUser.id,
        currentUser.displayName || currentUser.email
      );
      toast.success('Mesa abierta', { id: toastId });
      navigate(`/kitchen/order/${table.id}`);
    } catch (err: any) {
      console.error('❌ Error abriendo mesa:', err);
      toast.error(err?.message || 'Error al abrir la mesa', { id: toastId });
    } finally {
      setOpeningTableId(null);
    }
  };

  const getTableCard = (table: Table) => {
    const currentOrder = orders.find(order => order.tableId === table.id);
    const isActive = table.status === 'ocupada' && !!currentOrder;
    const isBar = table.number === 0;

    const itemCount = currentOrder
      ? currentOrder.items
          .filter(item => !item.isDeleted)
          .reduce((total, item) => total + item.quantity, 0)
      : 0;

    const totalAmount = currentOrder
      ? (() => {
          const activeItems = currentOrder.items.filter(item => !item.isDeleted);
          return activeItems.reduce((sum, item) => sum + item.productPrice * item.quantity, 0).toFixed(2);
        })()
      : '0.00';

    const timeMinutes = currentOrder
      ? Math.floor((new Date().getTime() - currentOrder.createdAt.getTime()) / (1000 * 60))
      : 0;

    const handleViewOrder = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentOrder) navigate(`/kitchen/order/${table.id}`);
    };

    const handleCheckout = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentOrder) navigate(`/kitchen/checkout/${currentOrder.id}`);
    };

    return (
      <div
        key={table.id}
        onClick={() => handleTableClick(table)}
        className={`bg-gray-800 p-6 rounded-2xl shadow-lg hover:scale-105 transition-transform duration-200 cursor-pointer min-h-[200px] ${
          isActive
            ? `border-2 ${isBar ? 'border-purple-500' : 'border-orange-500'}`
            : `border border-gray-700 hover:border-${isBar ? 'purple' : 'orange'}-400 transition-colors duration-200`
        }`}
      >
        {isActive ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xl font-bold text-white">
                {isBar ? '🍹 Barra' : `Mesa ${table.number}`}
              </span>
              <span className={`${isBar ? 'bg-purple-500 text-purple-100' : 'bg-orange-500 text-orange-100'} text-sm font-bold px-3 py-1 rounded-full`}>
                Activa
              </span>
            </div>
            {currentOrder?.tableName && (
              <div className="mb-3 px-3 py-2 bg-gray-700/50 rounded-lg border border-gray-600">
                <p className="text-sm font-medium text-orange-300 truncate">🏷️ {currentOrder.tableName}</p>
              </div>
            )}
            <div className="space-y-2 mb-4">
              <p className="text-base text-gray-400">Mesero: {currentOrder?.waiterName || 'Sin asignar'}</p>
              <p className="text-base text-gray-400">Items: {itemCount}</p>
              <p className="text-base text-gray-400">Tiempo: {timeMinutes} min</p>
            </div>
            {currentOrder && (
              <>
                <div className="space-y-3 mb-4">
                  <button
                    onClick={handleViewOrder}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-gray-900 font-medium py-3 px-4 rounded-lg text-base transition-colors"
                  >
                    Ver Pedido
                  </button>
                  {(() => {
                    const activeItems = currentOrder.items.filter(i => !i.isDeleted);
                    const hasUndelivered = activeItems.some(i => i.status !== 'entregado');
                    return (
                      <button
                        onClick={handleCheckout}
                        disabled={hasUndelivered}
                        className={`w-full font-medium py-3 px-4 rounded-lg text-base transition-colors ${
                          hasUndelivered
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                      >
                        Cobrar
                      </button>
                    );
                  })()}
                </div>
                <p className={`text-3xl font-bold ${isBar ? 'text-purple-400' : 'text-orange-400'} text-center`}>
                  ${totalAmount} MXN
                </p>
              </>
            )}
            {!currentOrder && (
              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">Mesa ocupada sin orden activa</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <span className="text-xl font-bold text-white">
                {isBar ? '🍹 Barra' : `Mesa ${table.number}`}
              </span>
              <span className={`${isBar ? 'bg-purple-600' : 'bg-gray-600'} text-gray-200 text-sm font-bold px-3 py-1 rounded-full`}>
                Libre
              </span>
            </div>
            <div className="flex flex-col items-center justify-center flex-1 text-gray-500 py-10">
              {openingTableId === table.id ? (
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4" />
              ) : (
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
              )}
              <p className="text-lg font-medium">{isBar ? 'Abrir Barra' : 'Abrir Mesa'}</p>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Panel de Mesas</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
        {tables
          .sort((a, b) => {
            if (a.number === 0) return -1;
            if (b.number === 0) return 1;
            return a.number - b.number;
          })
          .map(table => getTableCard(table))}
      </div>
    </div>
  );
};

export default KitchenHome;
