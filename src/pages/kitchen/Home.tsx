// src/pages/kitchen/Home.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTables } from '../../hooks/useTables';
import { useActiveOrders } from '../../hooks/useOrders';
import { useAuth } from '../../contexts/AuthContext';
import { createEmptyOrder } from '../../services/orderService';
import { VenueMap } from '../../components/common/VenueMap';
import TableGrid from '../../components/common/TableGrid';
import toast from 'react-hot-toast';
import type { Table } from '../../utils/types';

const KitchenHome: React.FC = () => {
  const navigate = useNavigate();
  const { tables, loading: tablesLoading, error: tablesError } = useTables();
  const { orders, loading: ordersLoading, error: ordersError } = useActiveOrders();
  const { currentUser } = useAuth();
  const [openingTableId, setOpeningTableId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');

  const loading = tablesLoading || ordersLoading;
  const error = tablesError || ordersError;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400 mx-auto mb-4" />
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
    if (table.status === 'ocupada') {
      const currentOrder = orders.find(o => o.tableId === table.id);
      if (currentOrder) navigate(`/kitchen/order/${table.id}`);
      return;
    }

    if (!currentUser) { toast.error('No hay usuario autenticado'); return; }
    if (openingTableId) return;

    setOpeningTableId(table.id);
    const label = table.number === 0 ? 'Barra' : `Mesa ${table.number}`;
    const toastId = toast.loading(`Abriendo ${label}...`);
    try {
      await createEmptyOrder(
        table.id,
        table.number,
        currentUser.id,
        currentUser.displayName || currentUser.email
      );
      toast.success('Mesa abierta', { id: toastId });
      navigate(`/kitchen/order/${table.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Error al abrir la mesa', { id: toastId });
    } finally {
      setOpeningTableId(null);
    }
  };

  return (
    <div className="p-2 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-white">Panel de Mesas</h1>
        <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
          <button
            onClick={() => setViewMode('map')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'map' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Mapa
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Tarjetas
          </button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <VenueMap
          tables={tables}
          orders={orders}
          onTableClick={handleTableClick}
          onCheckout={orderId => navigate(`/kitchen/checkout/${orderId}`)}
          accentColor="orange"
        />
      ) : (
        <TableGrid
          tables={tables}
          orders={orders}
          onTableClick={handleTableClick}
          onViewOrder={tableId => navigate(`/kitchen/order/${tableId}`)}
          onCheckout={orderId => navigate(`/kitchen/checkout/${orderId}`)}
          accentColor="orange"
        />
      )}
    </div>
  );
};

export default KitchenHome;
