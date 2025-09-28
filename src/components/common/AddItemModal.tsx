// src/components/common/AddItemModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Search, Plus } from 'lucide-react';
import QuantityModal from './QuantityModal';
import type { Product } from '../../utils/types';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (productId: string, quantity: number) => Promise<void>;
  products: Product[];
  loading?: boolean;
}

const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
  products,
  loading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todo');
  
  // Estados para el modal de cantidad
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const categories = ['Todo', 'Bebida', 'Comida', 'Postre', 'Entrada'];

  // Filtrar productos
  const filteredProducts = products.filter(product => {
    if (!product.available) return false;
    
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'Todo' || product.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });


  const handleAddItem = (product: Product) => {
    setSelectedProduct(product);
    setShowQuantityModal(true);
  };

  const handleConfirmQuantity = async (quantity: number) => {
    if (!selectedProduct) return;
    
    try {
      await onAddItem(selectedProduct.id, quantity);
      console.log('✅ Producto agregado:', selectedProduct.name, 'x', quantity);
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  };

  const handleCloseQuantityModal = () => {
    setShowQuantityModal(false);
    setSelectedProduct(null);
  };

  const handleClose = () => {
    setSearchTerm('');
    setSelectedCategory('Todo');
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div 
        className="bg-gray-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Agregar Producto</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-grow overflow-y-auto">
          {/* Search and Filters */}
          <div className="mb-6">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar producto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 placeholder-gray-500 text-white text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-colors ${
                    selectedCategory === category
                      ? 'text-white bg-blue-600'
                      : 'text-gray-300 bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-gray-900 rounded-lg p-4 flex flex-col">
                {/* Product Image Placeholder */}
                <div className="bg-gray-700 rounded-md mb-3 h-24 flex items-center justify-center">
                  <span className="text-gray-500 text-xs text-center px-2">
                    {product.name}
                  </span>
                </div>
                
                {/* Product Info */}
                <h4 className="font-semibold text-white text-sm mb-1 flex-grow">
                  {product.name}
                </h4>
                
                {product.description && (
                  <p className="text-gray-500 text-xs mb-2 line-clamp-2">
                    {product.description}
                  </p>
                )}
                
                <p className="text-amber-400 font-bold text-sm mb-3">
                  ${product.price.toFixed(2)}
                </p>
                
                {/* Add Button */}
                <button
                  onClick={() => handleAddItem(product)}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg transition-colors text-xs flex items-center justify-center disabled:opacity-50"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Seleccionar
                </button>
              </div>
            ))}
          </div>

          {/* No Products Found */}
          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 text-lg">No se encontraron productos</p>
              <p className="text-gray-500 text-sm mt-2">
                Intenta cambiar los filtros o el término de búsqueda
              </p>
            </div>
          )}
        </div>

        {/* Quantity Modal */}
        <QuantityModal
          isOpen={showQuantityModal}
          onClose={handleCloseQuantityModal}
          onConfirm={handleConfirmQuantity}
          product={selectedProduct}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default AddItemModal;
