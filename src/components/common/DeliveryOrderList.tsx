// src/components/common/DeliveryOrderList.tsx
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bike, Plus, Clock, MapPin, Phone, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDeliveryOrders } from '../../hooks/useDeliveryOrders';
import { createDeliveryOrder } from '../../services/deliveryOrderService';
import type { DeliveryOrderStatus } from '../../utils/types';

type AccentColor = 'red' | 'green' | 'orange';

const accentClasses: Record<AccentColor, { bg: string; hoverBg: string; text: string; ring: string }> = {
  red: { bg: 'bg-red-600', hoverBg: 'hover:bg-red-700', text: 'text-red-400', ring: 'ring-red-500' },
  green: { bg: 'bg-green-600', hoverBg: 'hover:bg-green-700', text: 'text-green-400', ring: 'ring-green-500' },
  orange: { bg: 'bg-orange-500', hoverBg: 'hover:bg-orange-600', text: 'text-orange-400', ring: 'ring-orange-500' },
};

const statusLabel: Record<DeliveryOrderStatus, string> = {
  activo: '📝 Armando pedido',
  cerrado: '🍳 Enviado a cocina',
  entregado: '✅ Entregado y cobrado',
  cancelado: 'Cancelado',
};

const statusBadgeClass: Record<DeliveryOrderStatus, string> = {
  activo: 'bg-yellow-500/20 text-yellow-300 border border-yellow-600/40',
  cerrado: 'bg-blue-500/20 text-blue-300 border border-blue-600/40',
  entregado: 'bg-green-500/20 text-green-300 border border-green-600/40',
  cancelado: 'bg-gray-500/20 text-gray-400 border border-gray-600/40',
};

interface DeliveryOrderListProps {
  basePath: '/waiter' | '/kitchen' | '/admin';
  accentColor: AccentColor;
  showAllStatuses?: boolean;
}

const DeliveryOrderList: React.FC<DeliveryOrderListProps> = ({ basePath, accentColor, showAllStatuses = false }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { orders, loading } = useDeliveryOrders();
  const accent = accentClasses[accentColor];

  const tabs: DeliveryOrderStatus[] = showAllStatuses ? ['activo', 'cerrado', 'entregado'] : ['activo', 'cerrado'];
  const [activeTab, setActiveTab] = useState<DeliveryOrderStatus>('activo');

  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [address, setAddress] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const filteredOrders = useMemo(
    () => orders.filter((o) => o.status === activeTab),
    [orders, activeTab]
  );

  const resetForm = () => {
    setCustomerName('');
    setDeliveryTime('');
    setAddress('');
    setContactPhone('');
  };

  const handleCreate = async () => {
    if (!currentUser) return;
    if (!customerName.trim() || !deliveryTime || !address.trim()) return;
    setCreating(true);
    try {
      const id = await createDeliveryOrder(
        {
          customerName: customerName.trim(),
          deliveryTime,
          address: address.trim(),
          contactPhone: contactPhone.trim() || undefined,
        },
        currentUser.id,
        currentUser.displayName || currentUser.email
      );
      setShowNewModal(false);
      resetForm();
      navigate(`${basePath}/domicilio/${id}`);
    } catch (err: any) {
      console.error('Error creando pedido a domicilio:', err);
      alert(err.message || 'Error al crear el pedido');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bike className={accent.text} size={28} />
          <h1 className="text-2xl font-bold text-white">Domicilios</h1>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className={`${accent.bg} ${accent.hoverBg} text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors`}
        >
          <Plus size={18} />
          Nuevo Pedido
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab
                ? `border-current ${accent.text}`
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {statusLabel[tab]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className={`animate-spin rounded-full h-10 w-10 border-b-2 border-current ${accent.text}`} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <Bike className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No hay pedidos en este estado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const activeItems = order.items.filter((i) => !i.isDeleted);
            const itemCount = activeItems.reduce((s, i) => s + i.quantity, 0);
            return (
              <button
                key={order.id}
                onClick={() => navigate(`${basePath}/domicilio/${order.id}`)}
                className="text-left bg-gray-800 hover:bg-gray-750 border border-gray-800 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-white truncate">{order.customerName}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${statusBadgeClass[order.status]}`}>
                    {statusLabel[order.status]}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{order.deliveryTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="flex-shrink-0" />
                    <span className="truncate">{order.address}</span>
                  </div>
                  {order.contactPhone && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={12} />
                      <span>{order.contactPhone}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-700">
                  <span className="text-xs text-gray-500">{itemCount} items · {order.waiterName}</span>
                  {typeof order.total === 'number' && order.total > 0 && (
                    <span className="font-bold text-white">${order.total.toFixed(2)}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-700">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Bike className={accent.text} size={20} />
                Nuevo Pedido a Domicilio
              </h3>
              <button onClick={() => setShowNewModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nombre del cliente *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej. Andrés"
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Hora de entrega *</label>
                <input
                  type="time"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Dirección *</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Calle, número, colonia o referencia"
                  rows={2}
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Contacto (opcional)</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Teléfono"
                  className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="p-6 bg-gray-900/50 rounded-b-2xl flex gap-3">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !customerName.trim() || !deliveryTime || !address.trim()}
                className={`flex-1 ${accent.bg} ${accent.hoverBg} text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {creating ? 'Creando...' : 'Crear y Agregar Productos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryOrderList;
