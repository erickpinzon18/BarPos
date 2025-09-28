// src/components/common/QuantityModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, ShoppingCart } from 'lucide-react';
import type { Product } from '../../utils/types';

interface QuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => Promise<void>;
  product: Product | null;
  loading?: boolean;
  title?: string;
}

const QuantityModal: React.FC<QuantityModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  product,
  loading = false,
  title = "Agregar Producto"
}) => {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  const handleQuantityChange = (change: number) => {
    const newQuantity = Math.max(1, quantity + change);
    setQuantity(newQuantity);
  };

  const handleConfirm = async () => {
    if (quantity < 1) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }

    try {
      setError('');
      await onConfirm(quantity);
      handleClose();
    } catch (error: any) {
      setError(error.message || 'Error al agregar el producto');
    }
  };

  const handleClose = () => {
    setQuantity(1);
    setError('');
    onClose();
  };

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !loading) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, loading]);

  // Reset quantity when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const totalPrice = product.price * quantity;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div 
        className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <ShoppingCart className="w-6 h-6 text-amber-400 mr-2" />
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Product Info */}
        <div className="mb-6">
          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-white mb-1">{product.name}</h3>
            {product.description && (
              <p className="text-gray-400 text-sm mb-2">{product.description}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-amber-400 font-bold">${product.price.toFixed(2)}</span>
              <span className="text-xs text-gray-500 bg-gray-600 px-2 py-1 rounded">
                {product.category}
              </span>
            </div>
          </div>
        </div>

        {/* Quantity Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Cantidad
          </label>
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1 || loading}
              className="w-12 h-12 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
            >
              <Minus className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <div className="text-3xl font-bold text-white mb-1">{quantity}</div>
              <div className="text-xs text-gray-400">unidades</div>
            </div>
            
            <button
              onClick={() => handleQuantityChange(1)}
              disabled={loading}
              className="w-12 h-12 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Total */}
        <div className="mb-6 p-4 bg-amber-900/20 border border-amber-600 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-amber-300 font-medium">Total:</span>
            <span className="text-2xl font-bold text-amber-400">
              ${totalPrice.toFixed(2)} MXN
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-gray-900 font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                Agregando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Agregar a la Orden
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuantityModal;
