// src/pages/admin/KitchenControl.tsx
import React, { useState } from 'react';
import { useActiveOrders } from '../../hooks/useOrders';
import { updateItemStatus } from '../../services/orderService';
import KitchenStatusControl from '../../components/common/KitchenStatusControl';
import { ChefHat, Wine, Filter, RefreshCw } from 'lucide-react';
import type { OrderItemStatus } from '../../utils/types';
import { getCategoriesByWorkstation } from '../../utils/categories';

const KitchenControl: React.FC = () => {
  const { orders, loading, error } = useActiveOrders();
  const [filter, setFilter] = useState<'all' | 'kitchen' | 'bar'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderItemStatus>('all');

  // Obtener todos los items activos de todas las órdenes
  const allItems = orders.flatMap(order => 
    order.items
      .filter(item => !item.isDeleted)
      .map(item => ({
        ...item,
        orderId: order.id,
        tableNumber: order.tableNumber,
        waiterName: order.waiterName
      }))
  );

  // Filtrar items por estación de trabajo
  const kitchenCategories = getCategoriesByWorkstation('cocina').map(c => c.key);
  const barCategories = getCategoriesByWorkstation('barra').map(c => c.key);

  const filteredItems = allItems.filter(item => {
    const isKitchenItem = kitchenCategories.includes(item.category as any);
    const isBarItem = barCategories.includes(item.category as any);

    let stationMatch = true;
    if (filter === 'kitchen') stationMatch = isKitchenItem;
    if (filter === 'bar') stationMatch = isBarItem;

    let statusMatch = true;
    if (statusFilter !== 'all') statusMatch = item.status === statusFilter;

    return stationMatch && statusMatch;
  });

  // Agrupar por estado para mejor organización
  const groupedItems = {
    pendiente: filteredItems.filter(item => item.status === 'pendiente'),
    listo: filteredItems.filter(item => item.status === 'listo'),
    entregado: filteredItems.filter(item => item.status === 'entregado')
  };

  const handleStatusChange = async (orderId: string, itemId: string, newStatus: OrderItemStatus) => {
    try {
      await updateItemStatus(orderId, itemId, newStatus);
      console.log('✅ Estado actualizado exitosamente');
    } catch (error) {
      console.error('❌ Error actualizando estado:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando órdenes...</p>
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

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Control de Cocina y Barra</h1>
          <p className="text-gray-400">Gestiona el estado de preparación de todos los items</p>
        </div>
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 text-amber-400" />
          <span className="text-sm text-gray-400">Actualización en tiempo real</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filtros:</span>
          </div>
          
          {/* Station Filter */}
          <div className="flex space-x-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === 'all' 
                  ? 'bg-amber-500 text-gray-900' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('kitchen')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center ${
                filter === 'kitchen' 
                  ? 'bg-orange-500 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <ChefHat className="w-3 h-3 mr-1" />
              Cocina
            </button>
            <button
              onClick={() => setFilter('bar')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors flex items-center ${
                filter === 'bar' 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Wine className="w-3 h-3 mr-1" />
              Barra
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex space-x-2">
            {(['all', 'pendiente', 'listo', 'entregado'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === status 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {status === 'all' ? 'Todos los estados' : 
                 status === 'pendiente' ? 'Pendiente' :
                 status === 'listo' ? 'Listo' : 'Entregado'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-900/20 border border-yellow-600 p-4 rounded-lg">
          <div className="text-yellow-400 text-2xl font-bold">{groupedItems.pendiente.length}</div>
          <div className="text-yellow-300 text-sm">Pendientes</div>
        </div>
        <div className="bg-green-900/20 border border-green-600 p-4 rounded-lg">
          <div className="text-green-400 text-2xl font-bold">{groupedItems.listo.length}</div>
          <div className="text-green-300 text-sm">Listos</div>
        </div>
        <div className="bg-blue-900/20 border border-blue-600 p-4 rounded-lg">
          <div className="text-blue-400 text-2xl font-bold">{groupedItems.entregado.length}</div>
          <div className="text-blue-300 text-sm">Entregados</div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredItems.map((item) => (
          <div key={`${item.orderId}-${item.id}`} className="relative">
            {/* Table info badge */}
            <div className="absolute -top-2 -right-2 bg-amber-500 text-gray-900 text-xs font-bold px-2 py-1 rounded-full z-10">
              Mesa {item.tableNumber}
            </div>
            
            <KitchenStatusControl
              currentStatus={item.status}
              onStatusChange={(newStatus) => handleStatusChange(item.orderId, item.id, newStatus)}
              itemName={`${item.productName} (${item.quantity}x)`}
              category={item.category}
            />
            
            {/* Additional info */}
            <div className="mt-2 text-xs text-gray-500 text-center">
              Mesero: {item.waiterName}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <ChefHat className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No hay items para mostrar</h3>
          <p className="text-gray-400">
            {filter === 'all' 
              ? 'No hay órdenes activas en este momento'
              : `No hay items ${filter === 'kitchen' ? 'de cocina' : 'de barra'} con el filtro seleccionado`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default KitchenControl;
