// src/pages/admin/Home.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTables } from '../../hooks/useTables';
import { useActiveOrders } from '../../hooks/useOrders';
import { useAuth } from '../../contexts/AuthContext';
import { createEmptyOrder } from '../../services/orderService';
import '../../utils/addUserPins'; // Para exponer la función globalmente
import '../../utils/createSampleProducts'; // Para exponer la función globalmente
import type { Table } from '../../utils/types';

const AdminHome: React.FC = () => {
  const navigate = useNavigate();
  const { tables, loading: tablesLoading, error: tablesError } = useTables();
  const { orders, loading: ordersLoading, error: ordersError } = useActiveOrders();
  const { currentUser } = useAuth();

  const loading = tablesLoading || ordersLoading;
  const error = tablesError || ordersError;

  // Log para ver todas las mesas y órdenes que llegan
  // console.log('🏠 AdminHome - Estado actual:', {
  //   currentUser: currentUser ? {
  //     id: currentUser.id,
  //     email: currentUser.email,
  //     displayName: currentUser.displayName,
  //     role: currentUser.role
  //   } : null,
  //   tablesCount: tables.length,
  //   ordersCount: orders.length,
  //   loading,
  //   error,
  //   tables: tables.map(t => ({
  //     id: t.id,
  //     status: t.status,
  //     waiterName: t.waiterName,
  //     currentOrderId: t.currentOrderId
  //   })),
  //   orders: orders.map(o => ({
  //     id: o.id,
  //     tableNumber: o.tableNumber,
  //     itemsCount: o.items.length,
  //     status: o.status
  //   }))
  // });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
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
    if (table.status === 'libre') {
      console.log('Abrir mesa:', table.id);
      try {
        // Verificar que hay usuario autenticado
        if (!currentUser) {
          throw new Error('No hay usuario autenticado');
        }

        // Crear una orden vacía (sin productos) con el usuario actual
        await createEmptyOrder(
          table.id, 
          table.number, 
          currentUser.id, 
          currentUser.displayName || currentUser.email
        );
        console.log('✅ Mesa abierta con orden vacía:', table.number, 'por:', currentUser.displayName);
        
        // Navegar directamente a los detalles para agregar productos
        navigate(`/admin/order/${table.id}`);
      } catch (error) {
        console.error('❌ Error abriendo mesa:', error);
      }
    } else {
      console.log('Ver detalles de mesa:', table.id);
      // Buscar la orden activa para esta mesa
      const currentOrder = orders.find(order => order.tableId === table.id);
      if (currentOrder) {
        navigate(`/admin/order/${table.id}`);
      }
    }
  };

  const getTableCard = (table: Table) => {
    // Buscar la orden activa para esta mesa
    const currentOrder = orders.find(order => order.tableId === table.id);
    
    // Una mesa está activa solo si tiene una orden activa
    const isActive = table.status === 'ocupada' && !!currentOrder;
    
    // Determinar si es la barra (mesa 0)
    const isBar = table.number === 0;
    
    // Logs para debugging
    // console.log('🔍 Renderizando tarjeta para mesa:', {
    //   id: table.id,
    //   number: table.number,
    //   status: table.status,
    //   capacity: table.capacity,
    //   waiterId: table.waiterId,
    //   waiterName: table.waiterName,
    //   currentOrderId: table.currentOrderId,
    //   isActive: isActive,
    //   currentOrder: currentOrder ? {
    //     id: currentOrder.id,
    //     itemsCount: currentOrder.items.length,
    //     items: currentOrder.items
    //   } : null,
    //   fullTable: table
    // });
    
    // Solo usar datos reales de la BD - NO datos dummy
    // Contar cantidad total de items (suma de todas las cantidades, excluyendo eliminados)
    const itemCount = currentOrder ? 
      currentOrder.items
        .filter(item => !item.isDeleted) // Excluir items eliminados
        .reduce((total, item) => total + item.quantity, 0) : 0;
    
    // Calcular total dinámicamente basado en items activos
    const totalAmount = currentOrder ? 
      (() => {
        const activeItems = currentOrder.items.filter(item => !item.isDeleted);
        const total = activeItems.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
        return total.toFixed(2);
      })() : '0.00';
    
    // Calcular tiempo transcurrido desde la creación de la orden (solo si existe)
    const timeMinutes = currentOrder ? 
      Math.floor((new Date().getTime() - currentOrder.createdAt.getTime()) / (1000 * 60)) : 0;
    
    // console.log('📊 Datos REALES de BD para mesa', table.number, ':', {
    //   itemCount: `${itemCount} items totales`,
    //   itemTypes: currentOrder ? currentOrder.items.filter(item => !item.isDeleted).length : 0,
    //   timeMinutes,
    //   totalAmount,
    //   hasOrder: !!currentOrder,
    //   orderFromDB: currentOrder ? {
    //     id: currentOrder.id,
    //     status: currentOrder.status,
    //     waiterName: currentOrder.waiterName,
    //     itemsBreakdown: currentOrder.items
    //       .filter(item => !item.isDeleted)
    //       .map(item => ({
    //         name: item.productName,
    //         quantity: item.quantity,
    //         price: item.productPrice,
    //         status: item.status,
    //         isDeleted: item.isDeleted
    //       }))
    //   } : null
    // });
    
    const handleViewOrder = (e: React.MouseEvent) => {
      e.stopPropagation();
      // console.log('Ver pedido de mesa:', table.id);
      if (currentOrder) {
        navigate(`/admin/order/${table.id}`);
      }
    };

    const handleCheckout = (e: React.MouseEvent) => {
      e.stopPropagation();
      // console.log('Cobrar mesa:', table.id);
      if (currentOrder) {
        navigate(`/admin/checkout/${currentOrder.id}`);
      }
    };
    
    return (
      <div
        key={table.id}
        onClick={() => handleTableClick(table)}
        className={`bg-gray-800 p-6 rounded-2xl shadow-lg hover:scale-105 transition-transform duration-200 cursor-pointer min-h-[200px] ${
          isActive 
            ? `border-2 ${isBar ? 'border-purple-500' : 'border-amber-500'}` 
            : `border border-gray-700 hover:border-${isBar ? 'purple' : 'amber'}-400 transition-colors duration-200`
        }`}
      >
        {isActive ? (
          // Mesa/Barra Activa
          <>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xl font-bold text-white">
                {isBar ? '🍹 Barra' : `Mesa ${table.number}`}
              </span>
              <span className={`${isBar ? 'bg-purple-500 text-purple-100' : 'bg-amber-500 text-amber-100'} text-sm font-bold px-3 py-1 rounded-full`}>
                Activa
              </span>
            </div>
            {currentOrder?.tableName && (
              <div className="mb-3 px-3 py-2 bg-gray-700/50 rounded-lg border border-gray-600">
                <p className="text-sm font-medium text-amber-300 truncate">🏷️ {currentOrder.tableName}</p>
              </div>
            )}
            <div className="space-y-2 mb-4">
              <p className="text-base text-gray-400">
                Mesero: {currentOrder?.waiterName || 'Sin asignar'}
              </p>
              <p className="text-base text-gray-400">
                Items: {itemCount}
              </p>
              <p className="text-base text-gray-400">
                Tiempo: {timeMinutes} min
              </p>
              {currentOrder && currentOrder.items.length > 0 && (
                <div className="text-xs text-gray-500 mt-2">
                  <p>Último item: {currentOrder.items[currentOrder.items.length - 1].productName}</p>
                  <p>Estado orden: {currentOrder.status}</p>
                </div>
              )}
            </div>
            {currentOrder && (
              <>
                <div className="space-y-3 mb-4">
                  <button 
                    onClick={handleViewOrder}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium py-3 px-4 rounded-lg text-base transition-colors"
                  >
                    Ver Pedido
                  </button>
                  {currentOrder && (
                    (() => {
                      const activeItems = currentOrder.items.filter(i => !i.isDeleted);
                      const hasUndelivered = activeItems.some(i => i.status !== 'entregado');
                      return (
                        <>
                          <button
                            onClick={handleCheckout}
                            disabled={hasUndelivered}
                            className={`w-full font-medium py-3 px-4 rounded-lg text-base transition-colors ${hasUndelivered ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                          >
                            Cobrar
                          </button>
                          {/* {hasUndelivered && (
                            <p className="text-xs text-yellow-300 mt-1">No puedes cobrar: la mesa tiene ítems pendientes, en preparación o listos (no entregados).</p>
                          )} */}
                        </>
                      );
                    })()
                  )}
                </div>
                <p className={`text-3xl font-bold ${isBar ? 'text-purple-400' : 'text-amber-400'} text-center`}>
                  ${totalAmount} MXN
                </p>
              </>
            )}
            
            {!currentOrder && (
              <div className="text-center text-gray-500 py-4">
                <p className="text-sm">Mesa ocupada sin orden activa</p>
                <p className="text-xs text-gray-600 mt-1">Verificar estado en BD</p>
              </div>
            )}
          </>
        ) : (
          // Mesa/Barra Libre
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
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
              <p className="text-lg font-medium">{isBar ? 'Abrir Barra' : 'Abrir Mesa'}</p>
              {/* <p className="text-sm text-gray-600 mt-1">Capacidad: {table.capacity} personas</p> */}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold text-white mb-6">Panel de Mesas</h1>
      
      {/* Grid de Mesas - Tarjetas más grandes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
        {/* Ordenar: Barra (mesa 0) primero, luego el resto por número */}
        {tables
          .sort((a, b) => {
            if (a.number === 0) return -1; // Barra siempre primero
            if (b.number === 0) return 1;
            return a.number - b.number; // Resto por número ascendente
          })
          .map((table) => getTableCard(table))}
      </div>
    </div>
  );
};

export default AdminHome;
