// src/components/common/DeliveryOrderDetails.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bike, Clock, MapPin, Phone, Package, Plus, Trash2, Send, DollarSign, Printer } from 'lucide-react';
import { useDeliveryOrderById } from '../../hooks/useDeliveryOrders';
import { useProducts } from '../../hooks/useProducts';
import { useAuth } from '../../contexts/AuthContext';
import { usePaperSize } from '../../hooks/usePaperSize';
import {
  addItemToDeliveryOrder,
  deleteDeliveryOrderItemSimple,
  closeDeliveryOrder,
  cancelDeliveryOrder,
  deliverDeliveryOrder,
} from '../../services/deliveryOrderService';
import { verifyUserPin } from '../../services/orderService';
import { printDeliveryTicket } from '../../utils/printDeliveryTicket';
import AddItemModal from './AddItemModal';
import PinModal from './PinModal';
import type { OrderItem, Product, CardType } from '../../utils/types';

const CARD_COMMISSION_RATE = 0.04;

type AccentColor = 'red' | 'green' | 'orange';
const accentClasses: Record<AccentColor, { bg: string; hoverBg: string; text: string }> = {
  red: { bg: 'bg-red-600', hoverBg: 'hover:bg-red-700', text: 'text-red-400' },
  green: { bg: 'bg-green-600', hoverBg: 'hover:bg-green-700', text: 'text-green-400' },
  orange: { bg: 'bg-orange-500', hoverBg: 'hover:bg-orange-600', text: 'text-orange-400' },
};

interface DeliveryOrderDetailsProps {
  basePath: '/waiter' | '/kitchen' | '/admin';
  accentColor: AccentColor;
}

const DeliveryOrderDetails: React.FC<DeliveryOrderDetailsProps> = ({ basePath, accentColor }) => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { order, loading, error } = useDeliveryOrderById(orderId);
  const { products } = useProducts();
  const { currentUser } = useAuth();
  const [paperSize] = usePaperSize(currentUser?.id);
  const accent = accentClasses[accentColor];

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemLoading, setAddItemLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  // Cobro
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'transferencia'>('efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [cardOperationNumber, setCardOperationNumber] = useState('');
  const [cardType, setCardType] = useState<CardType>('Visa');
  const [cardDetail, setCardDetail] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);

  const handleAddItem = async (productId: string, quantity: number, notes?: string) => {
    if (!order) return;
    setAddItemLoading(true);
    try {
      const product = products.find((p: Product) => p.id === productId);
      if (!product) throw new Error('Producto no encontrado');
      await addItemToDeliveryOrder(order.id, product.id, product.name, product.price, product.category, quantity, notes);
    } finally {
      setAddItemLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!order) return;
    try {
      await deleteDeliveryOrderItemSimple(order.id, itemId);
    } catch (err: any) {
      alert(err.message || 'Error al quitar el producto');
    }
  };

  const handleCloseOrder = async () => {
    if (!order) return;
    setClosing(true);
    try {
      const closed = await closeDeliveryOrder(order.id);
      printDeliveryTicket({
        order: closed,
        subtotal: closed.subtotal ?? 0,
        total: closed.total ?? 0,
        paperSize,
        businessName: undefined,
      });
      navigate(`${basePath}/domicilios`);
    } catch (err: any) {
      alert(err.message || 'Error al enviar el pedido a cocina');
    } finally {
      setClosing(false);
    }
  };

  const handleReprint = () => {
    if (!order) return;
    printDeliveryTicket({
      order,
      subtotal: order.subtotal ?? 0,
      total: order.total ?? 0,
      paperSize,
      businessName: undefined,
    });
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    try {
      await cancelDeliveryOrder(order.id);
      navigate(`${basePath}/domicilios`);
    } catch (err: any) {
      alert(err.message || 'Error al cancelar el pedido');
    }
  };

  const subtotal = order?.total ?? 0;
  const cardCommission = paymentMethod === 'tarjeta' ? subtotal * CARD_COMMISSION_RATE : 0;
  const totalToCharge = subtotal + cardCommission;

  const handleOpenCharge = () => {
    setChargeError(null);
    if (paymentMethod === 'tarjeta' && !cardOperationNumber.trim()) {
      setChargeError('Ingresa el número de operación (Verifone) de la tarjeta.');
      return;
    }
    setShowPinModal(true);
  };

  const handleConfirmPin = async (pin: string) => {
    if (!order) return;
    setPinLoading(true);
    try {
      const authorizedUser = await verifyUserPin(pin);
      const received = Number(cashReceived) || totalToCharge;
      await deliverDeliveryOrder(order.id, paymentMethod, {
        receivedAmount: paymentMethod === 'efectivo' ? received : undefined,
        change: paymentMethod === 'efectivo' ? Math.max(0, received - totalToCharge) : undefined,
        cardOperationNumber: paymentMethod === 'tarjeta' ? cardOperationNumber : undefined,
        cardType: paymentMethod === 'tarjeta' ? cardType : undefined,
        cardDetail: paymentMethod === 'tarjeta' ? cardDetail : undefined,
        cashierId: authorizedUser.id,
        cashierName: authorizedUser.displayName || authorizedUser.email,
      });
      setShowPinModal(false);
      navigate(`${basePath}/domicilios`);
    } catch (err: any) {
      throw new Error(err.message || 'Error al registrar el cobro');
    } finally {
      setPinLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${accent.text} border-current mx-auto`} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="text-center py-8 px-4">
        <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Pedido no encontrado</h2>
        <button
          onClick={() => navigate(`${basePath}/domicilios`)}
          className={`${accent.bg} ${accent.hoverBg} text-white px-6 py-3 rounded-lg font-medium`}
        >
          Volver a Domicilios
        </button>
      </div>
    );
  }

  const activeItems = order.items.filter((i) => !i.isDeleted);
  const calculatedTotal = activeItems.reduce((s, i) => s + i.productPrice * i.quantity, 0);
  const isActivo = order.status === 'activo';
  const isCerrado = order.status === 'cerrado';
  const isEntregado = order.status === 'entregado';

  return (
    <div className="pb-24">
      <div className="flex items-center mb-6">
        <button onClick={() => navigate(`${basePath}/domicilios`)} className="mr-3 p-2 hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bike className={accent.text} size={24} />
            {order.customerName}
          </h1>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
            <span className="flex items-center gap-1"><Clock size={12} />{order.deliveryTime}</span>
            <span className="flex items-center gap-1"><MapPin size={12} />{order.address}</span>
            {order.contactPhone && <span className="flex items-center gap-1"><Phone size={12} />{order.contactPhone}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">${(order.total ?? calculatedTotal).toFixed(2)}</p>
          {order.folio && <p className="text-xs text-gray-500">Folio {order.folio}</p>}
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-800 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Productos</h2>
          {isActivo && (
            <button
              onClick={() => setShowAddItemModal(true)}
              className={`${accent.bg} ${accent.hoverBg} text-white p-2 rounded-lg transition-colors`}
            >
              <Plus className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-700">
          {activeItems.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-sm text-gray-400 mb-6">Agrega productos a este pedido.</p>
              {isActivo && (
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className={`${accent.bg} ${accent.hoverBg} text-white font-medium py-3 px-6 rounded-lg inline-flex items-center`}
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Agregar Productos
                </button>
              )}
            </div>
          ) : (
            activeItems.map((item: OrderItem) => (
              <div key={item.id} className="p-4 flex items-start justify-between hover:bg-gray-700/30">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{item.quantity}x {item.productName}</h3>
                  <p className="text-sm text-gray-400">${(item.productPrice * item.quantity).toFixed(2)}</p>
                  {item.notes && <p className="text-xs text-gray-500 mt-1 italic">"{item.notes}"</p>}
                </div>
                {isActivo && (
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors ml-2"
                    title="Quitar"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-gray-800/80 border-t border-gray-700 flex justify-between text-lg font-bold text-white">
          <span>Total</span>
          <span>${(order.total ?? calculatedTotal).toFixed(2)}</span>
        </div>
      </div>

      {(isCerrado || isEntregado) && (
        <button
          onClick={handleReprint}
          className="w-full mb-6 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Printer size={18} />
          Reimprimir Ticket
        </button>
      )}

      {isActivo && (
        <div className="flex gap-3">
          <button
            onClick={handleCancelOrder}
            disabled={activeItems.length > 0}
            className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-4 rounded-lg transition-colors"
          >
            Cancelar Pedido
          </button>
          <button
            onClick={handleCloseOrder}
            disabled={closing || activeItems.length === 0}
            className={`flex-1 ${accent.bg} ${accent.hoverBg} disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transition-colors flex items-center justify-center gap-2`}
          >
            <Send size={18} />
            {closing ? 'Enviando...' : 'Cerrar y Enviar a Cocina'}
          </button>
        </div>
      )}

      {isCerrado && (
        <div className="bg-gray-800 p-6 rounded-2xl border border-gray-800">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign size={18} className={accent.text} />
            Cobrar Entrega
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(['efectivo', 'tarjeta', 'transferencia'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`py-3 px-2 rounded-lg font-bold text-sm transition-colors ${
                  paymentMethod === m
                    ? `${accent.bg} text-white`
                    : 'bg-transparent text-gray-400 border border-gray-700 hover:bg-gray-700/40'
                }`}
              >
                {m === 'efectivo' ? 'Efectivo' : m === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}
              </button>
            ))}
          </div>

          {paymentMethod === 'efectivo' && (
            <div className="mb-4">
              <div className="text-sm text-gray-300 mb-2">Monto a cobrar: ${totalToCharge.toFixed(2)}</div>
              <label className="text-xs text-gray-500 block mb-1">Recibido</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
              />
              {Number(cashReceived) > 0 && (
                <div className={`mt-2 text-sm font-semibold ${Number(cashReceived) < totalToCharge ? 'text-red-400' : 'text-green-400'}`}>
                  {Number(cashReceived) < totalToCharge
                    ? `Faltan $${(totalToCharge - Number(cashReceived)).toFixed(2)}`
                    : `Cambio: $${(Number(cashReceived) - totalToCharge).toFixed(2)}`}
                </div>
              )}
            </div>
          )}

          {paymentMethod === 'tarjeta' && (
            <div className="mb-4 space-y-2">
              <div className="text-sm text-amber-400">
                + Comisión tarjeta (4%): ${cardCommission.toFixed(2)} — cobrar ${totalToCharge.toFixed(2)} en la terminal
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Operación (Verifone)</label>
                  <input
                    type="text"
                    value={cardOperationNumber}
                    onChange={(e) => setCardOperationNumber(e.target.value)}
                    placeholder="Ej. 123456"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                  <select
                    value={cardType}
                    onChange={(e) => setCardType(e.target.value as CardType)}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                  >
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Amex">Amex</option>
                    <option value="Otra">Otra</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Detalle (opcional)</label>
                <input
                  type="text"
                  value={cardDetail}
                  onChange={(e) => setCardDetail(e.target.value)}
                  placeholder="Notas, últimos 4 dígitos, etc."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
          )}

          {paymentMethod === 'transferencia' && (
            <div className="mb-4 text-sm text-gray-300">Monto a cobrar: ${totalToCharge.toFixed(2)}</div>
          )}

          {chargeError && <p className="text-sm text-red-400 mb-3">{chargeError}</p>}

          <button
            onClick={handleOpenCharge}
            className={`w-full ${accent.bg} ${accent.hoverBg} text-white font-bold py-3 rounded-lg transition-colors`}
          >
            Confirmar Cobro (${totalToCharge.toFixed(2)})
          </button>
        </div>
      )}

      {isEntregado && (
        <div className="bg-green-900/20 border border-green-700/50 rounded-2xl p-6 text-center">
          <p className="text-green-300 font-semibold mb-1">✅ Entregado y cobrado</p>
          <p className="text-sm text-gray-400">
            {order.paymentMethod === 'efectivo' ? 'Efectivo' : order.paymentMethod === 'tarjeta' ? 'Tarjeta' : 'Transferencia'}
            {' · '}${(order.total ?? 0).toFixed(2)}
          </p>
        </div>
      )}

      {showAddItemModal && (
        <AddItemModal
          isOpen={showAddItemModal}
          onClose={() => setShowAddItemModal(false)}
          onAddItem={handleAddItem}
          products={products}
          loading={addItemLoading}
        />
      )}

      <PinModal
        isOpen={showPinModal}
        onClose={() => setShowPinModal(false)}
        onConfirm={handleConfirmPin}
        loading={pinLoading}
        title="Confirmar Cobro"
        message="Ingresa tu PIN para autorizar el cobro y registrar quién recibió el pago."
      />
    </div>
  );
};

export default DeliveryOrderDetails;
