// src/components/common/AddItemModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Tag, Clock } from 'lucide-react';
import QuantityModal from './QuantityModal';
import BottleQuantityModal from './BottleQuantityModal';
import DrinkMixerModal from './DrinkMixerModal';
import type { Product, Promotion } from '../../utils/types';
import { FILTER_CATEGORIES, getCategoryInfo } from '../../utils/categories';
import { isPromotionWithinSchedule } from '../../hooks/usePromotions';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (productId: string, quantity: number, notes?: string) => Promise<void>;
  products: Product[];
  loading?: boolean;
  activePromotions?: Promotion[];
}

const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
  products,
  loading = false,
  activePromotions = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [showBottleModal, setShowBottleModal] = useState(false);
  const [showDrinkModal, setShowDrinkModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const categories = FILTER_CATEGORIES;

  const filteredProducts = products.filter(product => {
    if (!product.available) return false;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Promoción activa+vigente que aplique a un producto
  const getProductPromo = useMemo(() => (product: Product): Promotion | null => {
    return activePromotions.find(promo => {
      if (!isPromotionWithinSchedule(promo.cutoffTime)) return false;
      const catOk = promo.categories.length === 0 || promo.categories.includes(product.category);
      const prodOk = !promo.productIds || promo.productIds.length === 0 || promo.productIds.includes(product.id);
      return catOk && prodOk;
    }) ?? null;
  }, [activePromotions]);

  // Promoción que aplica pero está EXPIRADA (fuera de horario)
  const getExpiredPromo = useMemo(() => (product: Product): Promotion | null => {
    return activePromotions.find(promo => {
      if (isPromotionWithinSchedule(promo.cutoffTime)) return false;
      const catOk = promo.categories.length === 0 || promo.categories.includes(product.category);
      const prodOk = !promo.productIds || promo.productIds.length === 0 || promo.productIds.includes(product.id);
      return catOk && prodOk;
    }) ?? null;
  }, [activePromotions]);

  const getEffectivePrice = (product: Product, promo: Promotion | null): number => {
    if (!promo) return product.price;
    switch (promo.discountType) {
      case 'fixedprice':
        return Math.min(product.price, promo.discountValue);
      case 'percentage':
        return product.price * (1 - promo.discountValue / 100);
      case 'fixed':
        return Math.max(0, product.price - promo.discountValue);
      default:
        return product.price;
    }
  };

  const handleAddItem = (product: Product) => {
    setSelectedProduct(product);
    const requiresMixer = product.category === 'Shot' || (product.category === 'Bebida' && product.name.toLowerCase().includes('trago'));
    if (product.category === 'Botella') {
      setShowBottleModal(true);
    } else if (requiresMixer) {
      setShowDrinkModal(true);
    } else {
      setShowQuantityModal(true);
    }
  };

  // Regular (non-bottle) confirm
  const handleConfirmQuantity = async (quantity: number, notes?: string) => {
    if (!selectedProduct) return;
    try {
      await onAddItem(selectedProduct.id, quantity, notes);
    } catch (error) {
      console.error('Error adding item:', error);
      throw error;
    }
  };

  const handleCloseQuantityModal = () => {
    setShowQuantityModal(false);
    setSelectedProduct(null);
  };

  // Bottle confirm: quantity + optional services notes
  const handleConfirmBottle = async (quantity: number, notes: string) => {
    if (!selectedProduct) return;
    await onAddItem(selectedProduct.id, quantity, notes || undefined);
  };

  const handleCloseBottleModal = () => {
    setShowBottleModal(false);
    setSelectedProduct(null);
  };

  // Drink (Bebida/Shot) confirm: quantity + optional mixer notes
  const handleConfirmDrink = async (quantity: number, notes: string) => {
    if (!selectedProduct) return;
    await onAddItem(selectedProduct.id, quantity, notes || undefined);
  };

  const handleCloseDrinkModal = () => {
    setShowDrinkModal(false);
    setSelectedProduct(null);
  };

  const handleClose = () => {
    setSearchTerm('');
    setSelectedCategory('Todos');
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
        className="bg-gray-800 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-800">
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
                className="w-full bg-gray-900 border border-gray-800 placeholder-gray-500 text-white text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            {filteredProducts.map((product) => {
              const promo = getProductPromo(product);
              const expiredPromo = !promo ? getExpiredPromo(product) : null;
              const effectivePrice = getEffectivePrice(product, promo);
              const hasDiscount = promo !== null && effectivePrice < product.price;
              const hasExpired = expiredPromo !== null;
              return (
                <div key={product.id} className={`rounded-lg p-4 flex flex-col relative transition-all ${
                  hasDiscount
                    ? 'bg-green-950/40 ring-2 ring-green-500/60 border-l-4 border-green-500'
                    : hasExpired
                    ? 'bg-amber-950/20 ring-1 ring-amber-600/40 border-l-4 border-amber-600'
                    : 'bg-gray-900'
                }`}>
                  {/* Product Image Placeholder */}
                  <div className="bg-gray-700 rounded-md mb-3 h-24 flex items-center justify-center relative overflow-hidden">
                    <span className="text-gray-500 text-xs text-center px-2">
                      {product.name}
                    </span>
                    {hasDiscount && (
                      <div className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide shadow-lg flex items-center gap-0.5">
                        <Tag size={9} />
                        PROMO
                      </div>
                    )}
                    {hasExpired && (
                      <div className="absolute top-1.5 right-1.5 bg-amber-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wide shadow-lg flex items-center gap-0.5">
                        <Clock size={9} />
                        EXPIRADA
                      </div>
                    )}
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

                  {/* Price + Promo */}
                  {hasDiscount ? (
                    <div className="mb-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-green-400 font-bold text-sm">${effectivePrice.toFixed(2)}</span>
                        <span className="text-gray-500 text-xs line-through">${product.price.toFixed(2)}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-green-400">
                        <Tag size={10} />
                        <span className="font-medium truncate">{promo!.name}</span>
                        <span className="text-green-600 flex-shrink-0 flex items-center gap-0.5">
                          <Clock size={9} />{promo!.cutoffTime}
                        </span>
                      </div>
                    </div>
                  ) : hasExpired ? (
                    <div className="mb-2">
                      <p className="text-red-500 font-bold text-sm">
                        ${product.price.toFixed(2)}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                        <Clock size={10} />
                        <span className="font-medium truncate">{expiredPromo!.name}</span>
                        <span className="text-amber-500 flex-shrink-0">· expiró {expiredPromo!.cutoffTime}hrs</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-red-500 font-bold text-sm mb-3">
                      ${product.price.toFixed(2)}
                    </p>
                  )}

                  {/* Add Button */}
                  <button
                    onClick={() => handleAddItem(product)}
                    disabled={loading}
                    className={`w-full font-bold py-2 px-3 rounded-lg transition-colors text-xs flex items-center justify-center disabled:opacity-50 ${
                      hasDiscount
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : product.category === 'Botella'
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Seleccionar
                  </button>
                </div>
              );
            })}
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

        {/* Regular Quantity Modal (non-bottle products) */}
        <QuantityModal
          isOpen={showQuantityModal}
          onClose={handleCloseQuantityModal}
          onConfirm={handleConfirmQuantity}
          product={selectedProduct}
          loading={loading}
          showNotes={getCategoryInfo(selectedProduct?.category as any)?.workstation === 'barra'}
        />

        {/* Bottle Modal: quantity + services in one step */}
        <BottleQuantityModal
          isOpen={showBottleModal}
          onClose={handleCloseBottleModal}
          onConfirm={handleConfirmBottle}
          product={selectedProduct}
          isPromoX2={selectedProduct?.category === 'Botella' && selectedProduct.name.toLowerCase().includes('promo')}
          maxServicesPerBottle={
            selectedProduct 
              ? (selectedProduct.category === 'Botella' && selectedProduct.name.toLowerCase().includes('promo') 
                  ? 10 
                  : (getProductPromo(selectedProduct) ? 3 : 5)) 
              : 5
          }
          loading={loading}
        />

        {/* Drink Mixer Modal: for Bebida / Shot */}
        <DrinkMixerModal
          isOpen={showDrinkModal}
          onClose={handleCloseDrinkModal}
          onConfirm={handleConfirmDrink}
          product={selectedProduct}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default AddItemModal;
