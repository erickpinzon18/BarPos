import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Scissors } from 'lucide-react';
import { useTables } from '../../hooks/useTables';
import { splitOrderItemsToNewTable, verifyUserPin } from '../../services/orderService';
import type { OrderItem, Order } from '../../utils/types';
import PinModal from './PinModal';

interface SplitOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order;
  onSuccess: () => void;
}

const SplitOrderModal: React.FC<SplitOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
}) => {
  const { tables, loading: tablesLoading } = useTables();
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);

  const activeItems = order.items.filter(item => !item.isDeleted);
  const freeTables = tables.filter(t => t.status === 'libre');

  useEffect(() => {
    if (isOpen) {
      setQuantities({});
      setSelectedTableId('');
      setError('');
      setShowPinModal(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleIncrement = (item: OrderItem) => {
    const current = quantities[item.id] || 0;
    if (current < item.quantity) {
      setQuantities(prev => ({ ...prev, [item.id]: current + 1 }));
    }
  };

  const handleDecrement = (itemId: string) => {
    const current = quantities[itemId] || 0;
    if (current > 0) {
      setQuantities(prev => ({ ...prev, [itemId]: current - 1 }));
    }
  };

  const totalItemsToMove = Object.values(quantities).reduce((acc, curr) => acc + curr, 0);

  const handleNext = () => {
    if (totalItemsToMove === 0) {
      setError('Debes seleccionar al menos un producto para separar.');
      return;
    }
    if (!selectedTableId) {
      setError('Debes seleccionar una mesa destino.');
      return;
    }
    setError('');
    setShowPinModal(true);
  };

  const handleConfirm = async (pin: string) => {
    if (pin.length !== 4) {
      throw new Error('El PIN debe tener 4 dígitos');
    }

    try {
      const adminUser = await verifyUserPin(pin);
      if (adminUser.role !== 'admin') {
        throw new Error('Solo los administradores pueden separar cuentas.');
      }

      const splitItems = Object.entries(quantities)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({ originalItemId: id, quantityToMove: qty }));

      await splitOrderItemsToNewTable(order.id, splitItems, selectedTableId, adminUser);
      onSuccess();
      onClose();
    } catch (err: any) {
      throw new Error(err.message || 'Error al separar la cuenta');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl border border-gray-800 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between shrink-0">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Scissors className="w-6 h-6 text-orange-400" />
            Separar Cuenta
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-900/50 border border-red-500 rounded-lg flex items-center gap-3 shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Mesa Destino (solo mesas libres)
            </label>
            {tablesLoading ? (
              <p className="text-gray-400 text-sm">Cargando mesas...</p>
            ) : (
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
              >
                <option value="">-- Selecciona una mesa libre --</option>
                {freeTables.map(t => (
                  <option key={t.id} value={t.id}>
                    Mesa {t.number}
                  </option>
                ))}
              </select>
            )}
            {freeTables.length === 0 && !tablesLoading && (
              <p className="text-red-400 text-xs mt-2">No hay mesas libres disponibles.</p>
            )}
          </div>

          <h3 className="text-lg font-medium text-white mb-4">Selecciona los productos a mover</h3>
          {activeItems.length === 0 ? (
            <p className="text-gray-400 text-sm">No hay productos en esta mesa.</p>
          ) : (
            <div className="space-y-3">
              {activeItems.map(item => {
                const toMove = quantities[item.id] || 0;
                return (
                  <div key={item.id} className="bg-gray-800 p-4 rounded-xl border border-gray-700 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{item.productName}</p>
                      <p className="text-sm text-gray-400">Cantidad total: {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-4 bg-gray-900 rounded-lg p-1 border border-gray-700">
                      <button
                        onClick={() => handleDecrement(item.id)}
                        className="w-10 h-10 rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
                        disabled={toMove === 0}
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-bold text-white">
                        {toMove}
                      </span>
                      <button
                        onClick={() => handleIncrement(item)}
                        className="w-10 h-10 rounded-md bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50"
                        disabled={toMove === item.quantity}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-gray-800 bg-gray-900 shrink-0 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleNext}
            disabled={totalItemsToMove === 0 || !selectedTableId}
            className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-xl font-semibold transition-all"
          >
            Continuar ({totalItemsToMove} items)
          </button>
        </div>

        {showPinModal && (
          <PinModal
            isOpen={showPinModal}
            onClose={() => setShowPinModal(false)}
            onConfirm={handleConfirm}
            title="Autorización Requerida"
            message={`Se moverán ${totalItemsToMove} items a la nueva mesa. Ingresa el PIN de administrador para confirmar.`}
          />
        )}
      </div>
    </div>
  );
};

export default SplitOrderModal;
