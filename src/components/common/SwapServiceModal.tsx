// src/components/common/SwapServiceModal.tsx
import React, { useState } from 'react';
import { X, Search, ArrowLeftRight } from 'lucide-react';
import type { Product } from '../../utils/types';

interface SwapServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newProduct: Product) => Promise<void>;
  currentItem: { productName: string; productPrice: number } | null;
  products: Product[];
  loading?: boolean;
}

const SwapServiceModal: React.FC<SwapServiceModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentItem,
  products,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen || !currentItem) return null;

  const servicios = products.filter(p =>
    p.available &&
    p.category === 'Servicio' &&
    p.name.toLowerCase() !== currentItem.productName.toLowerCase() &&
    p.price === currentItem.productPrice &&
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = async (product: Product) => {
    await onConfirm(product);
    setSearchTerm('');
  };

  const handleClose = () => {
    setSearchTerm('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div
        className="bg-gray-800 rounded-2xl w-full max-w-md flex flex-col border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-purple-400" />
              Cambiar Servicio
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Cambiar <span className="text-white font-semibold">{currentItem.productName}</span> por:
            </p>
          </div>
          <button onClick={handleClose} disabled={loading} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar servicio..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 placeholder-gray-500 text-white text-sm rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-72 p-3 space-y-2">
          {servicios.length === 0 ? (
            <p className="text-center text-gray-500 text-sm py-8">
              No hay servicios disponibles al mismo precio (${currentItem.productPrice.toFixed(2)})
            </p>
          ) : (
            servicios.map(product => (
              <button
                key={product.id}
                onClick={() => handleSelect(product)}
                disabled={loading}
                className="w-full flex items-center justify-between bg-gray-700 hover:bg-purple-900/40 border border-gray-600 hover:border-purple-500 rounded-lg px-4 py-3 transition-colors disabled:opacity-50 text-left"
              >
                <span className="font-medium text-white text-sm">{product.name}</span>
                <span className="text-purple-400 font-semibold text-sm">${product.price.toFixed(2)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SwapServiceModal;
