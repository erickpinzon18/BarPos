// src/pages/waiter/Home.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTables } from '../../hooks/useTables';
import { useActiveOrders } from '../../hooks/useOrders';
import { useAuth } from '../../contexts/AuthContext';
import { openTable } from '../../services/firestoreService';
import { LogOut, User } from 'lucide-react';
import type { Table } from '../../utils/types';

const WaiterHome: React.FC = () => {
  const navigate = useNavigate();
  const { tables, loading: tablesLoading, error: tablesError } = useTables();
  const { orders, loading: ordersLoading, error: ordersError } = useActiveOrders();
  const { currentUser, logout } = useAuth();
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const loading = tablesLoading || ordersLoading;
  const error = tablesError || ordersError;

  // Separar mesas en categorías
  const myTables = tables.filter(table => 
    table.status === 'ocupada' && table.waiterId === currentUser?.id
  );
  
  const freeTables = tables.filter(table => 
    table.status === 'libre'
  );
  
  const otherWaiterTables = tables.filter(table => 
    table.status === 'ocupada' && table.waiterId !== currentUser?.id
  );

  // Ordenar: mis mesas primero, luego libres, luego de otros meseros
  const sortedTables = [...myTables, ...freeTables, ...otherWaiterTables];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando tus mesas...</p>
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
    if (!currentUser) return;

    // Si es una mesa libre, abrirla y asignarla al mesero
    if (table.status === 'libre') {
      try {
        setOpeningTableId(table.id);
        const response = await openTable(table.id, currentUser.id, currentUser.displayName || currentUser.email);
        if (response.success && response.data) {
          // Navegar a la orden recién creada
          navigate(`/waiter/order/${table.id}`);
        } else {
          console.error('Error al abrir mesa:', response.error);
          alert('No se pudo abrir la mesa. Intenta de nuevo.');
        }
      } catch (error) {
        console.error('Error al abrir mesa:', error);
        alert('No se pudo abrir la mesa. Intenta de nuevo.');
      } finally {
        setOpeningTableId(null);
      }
      return;
    }

    // Si es una mesa de otro mesero, no hacer nada
    if (table.status === 'ocupada' && table.waiterId !== currentUser?.id) {
      return;
    }
    
    // Si es mi mesa, navegar a la orden
    if (table.waiterId === currentUser?.id) {
      const currentOrder = orders.find(order => order.tableId === table.id);
      if (currentOrder) {
        navigate(`/waiter/order/${table.id}`);
      }
    }
  };

  const getTableCard = (table: Table) => {
    // Buscar la orden activa para esta mesa
    const currentOrder = orders.find(order => order.tableId === table.id);
    
    // Determinar si la mesa pertenece al mesero actual
    const isMyTable = table.status === 'ocupada' && table.waiterId === currentUser?.id;
    const isFreeTable = table.status === 'libre';
    
    // Determinar si es la barra (mesa 0)
    const isBar = table.number === 0;
    
    // Una mesa está activa solo si tiene una orden activa
    const isActive = table.status === 'ocupada' && !!currentOrder;
    
    // Contar cantidad total de items (suma de todas las cantidades, excluyendo eliminados)
    const itemCount = currentOrder ? 
      currentOrder.items
        .filter(item => !item.isDeleted)
        .reduce((total, item) => total + item.quantity, 0) : 0;
    
    // Calcular total dinámicamente basado en items activos
    const totalAmount = currentOrder ? 
      (() => {
        const activeItems = currentOrder.items.filter(item => !item.isDeleted);
        const total = activeItems.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
        return total.toFixed(2);
      })() : '0.00';
    
    // Calcular tiempo transcurrido desde la creación de la orden
    const timeMinutes = currentOrder ? 
      Math.floor((new Date().getTime() - currentOrder.createdAt.getTime()) / (1000 * 60)) : 0;
    
    const handleViewOrder = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentOrder) {
        navigate(`/waiter/order/${table.id}`);
      }
    };

    const handleCheckout = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (currentOrder) {
        navigate(`/waiter/checkout/${currentOrder.id}`);
      }
    };
    
    const isOpening = openingTableId === table.id;

    return (
      <div
        key={table.id}
        onClick={() => handleTableClick(table)}
        className={`bg-gray-800 p-6 rounded-2xl shadow-lg transition-transform duration-200 min-h-[200px] ${
          isMyTable
            ? `border-2 ${isBar ? 'border-purple-500' : 'border-green-500'} cursor-pointer hover:scale-105` 
            : isFreeTable
            ? `border-2 ${isBar ? 'border-purple-600' : 'border-green-600'} cursor-pointer hover:scale-105 ${isBar ? 'hover:border-purple-400' : 'hover:border-green-400'}`
            : 'border border-gray-700 opacity-40 cursor-not-allowed'
        }`}
      >
        {isMyTable && isActive ? (
          // Mesa Activa del Mesero
          <>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xl font-bold text-white">
                {isBar ? '🍹 Barra' : `Mesa ${table.number}`}
              </span>
              <span className={`${isBar ? 'bg-purple-500 text-purple-100' : 'bg-green-500 text-green-100'} text-sm font-bold px-3 py-1 rounded-full`}>
                {isBar ? 'Tu Barra' : 'Tu Mesa'}
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-base text-gray-400">
                Items: {itemCount}
              </p>
              <p className="text-base text-gray-400">
                Tiempo: {timeMinutes} min
              </p>
              {currentOrder && currentOrder.items.length > 0 && (
                <div className="text-xs text-gray-500 mt-2">
                  <p>Último item: {currentOrder.items[currentOrder.items.length - 1].productName}</p>
                </div>
              )}
            </div>
            {currentOrder && (
              <>
                <div className="space-y-3 mb-4">
                  <button 
                    onClick={handleViewOrder}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg text-base transition-colors"
                  >
                    Ver Pedido
                  </button>
                  {currentOrder && (
                    (() => {
                      const activeItems = currentOrder.items.filter(i => !i.isDeleted);
                      const hasUndelivered = activeItems.some(i => i.status !== 'entregado');
                      return (
                        <button
                          onClick={handleCheckout}
                          disabled={hasUndelivered}
                          className={`w-full font-medium py-3 px-4 rounded-lg text-base transition-colors ${hasUndelivered ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                        >
                          Cobrar
                        </button>
                      );
                    })()
                  )}
                </div>
                <p className={`text-3xl font-bold ${isBar ? 'text-purple-400' : 'text-green-400'} text-center`}>
                  ${totalAmount} MXN
                </p>
              </>
            )}
          </>
        ) : isFreeTable ? (
          // Mesa Libre (clickeable para abrir)
          <>
            <div className="flex justify-between items-center mb-6">
              <span className="text-xl font-bold text-white">
                {isBar ? '🍹 Barra' : `Mesa ${table.number}`}
              </span>
              <span className={`${isBar ? 'bg-purple-600' : 'bg-green-600'} text-gray-200 text-sm font-bold px-3 py-1 rounded-full`}>
                Libre
              </span>
            </div>
            {isOpening ? (
              <div className={`flex flex-col items-center justify-center flex-1 ${isBar ? 'text-purple-400' : 'text-green-400'} py-10`}>
                <div className={`animate-spin rounded-full h-16 w-16 border-b-2 ${isBar ? 'border-purple-400' : 'border-green-400'} mb-4`}></div>
                <p className="text-sm font-medium">Abriendo {isBar ? 'barra' : 'mesa'}...</p>
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center flex-1 ${isBar ? 'text-purple-400' : 'text-green-400'} py-10`}>
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                </svg>
                <p className="text-sm font-medium">{isBar ? 'Toca para abrir Barra' : 'Toca para abrir'}</p>
              </div>
            )}
          </>
        ) : (
          // Mesa de Otro Mesero (no clickeable)
          <>
            <div className="flex justify-between items-center mb-4">
              <span className="text-xl font-bold text-white">
                {isBar ? '🍹 Barra' : `Mesa ${table.number}`}
              </span>
              <span className="bg-amber-500 text-amber-100 text-sm font-bold px-3 py-1 rounded-full">
                Ocupada
              </span>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-base text-gray-400">
                Mesero: {currentOrder?.waiterName || table.waiterName || 'Otro mesero'}
              </p>
              {currentOrder && (
                <>
                  <p className="text-base text-gray-400">
                    Items: {itemCount}
                  </p>
                  <p className="text-base text-gray-400">
                    Tiempo: {timeMinutes} min
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-col items-center justify-center flex-1 text-gray-500 py-6">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
              </svg>
              <p className="text-sm font-medium">No disponible</p>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Mesas</h1>
        <p className="text-gray-400 mt-2">
          {myTables.length > 0 
            ? `Tienes ${myTables.length} mesa${myTables.length === 1 ? '' : 's'} asignada${myTables.length === 1 ? '' : 's'}`
            : 'No tienes mesas asignadas en este momento'}
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Ordenar: Barra (mesa 0) primero, luego mesas del mesero, luego libres, luego de otros */}
        {sortedTables
          .sort((a, b) => {
            if (a.number === 0) return -1; // Barra siempre primero
            if (b.number === 0) return 1;
            return 0; // Mantener orden original (mis mesas, libres, otros)
          })
          .map((table) => getTableCard(table))}
      </div>

      {/* Floating User Button */}
      <div className="fixed bottom-6 left-6 z-50">
        {/* User Menu (shown when clicked) */}
        {showUserMenu && (
          <div className="absolute bottom-full mb-2 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden w-64 animate-in slide-in-from-bottom-2">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {currentUser?.displayName || currentUser?.email || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {currentUser?.email}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await logout();
                  navigate('/waiter/login');
                } catch (error) {
                  console.error('Error al cerrar sesión:', error);
                }
              }}
              className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-700 transition-colors text-red-400 hover:text-red-300"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Cerrar Sesión</span>
            </button>
          </div>
        )}

        {/* Floating Button */}
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="bg-green-600 hover:bg-green-700 text-white rounded-full p-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3 group"
        >
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <span className="font-medium pr-2">
            {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuario'}
          </span>
        </button>
      </div>
    </div>
  );
};

export default WaiterHome;
