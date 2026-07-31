// src/components/common/QuantityModal.tsx
import React, { useState, useEffect } from "react";
import { X, Plus, Minus, ShoppingCart } from "lucide-react";
import type { Product } from "../../utils/types";

interface QuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number, notes?: string) => Promise<void>;
  product: Product | null;
  loading?: boolean;
  title?: string;
  showNotes?: boolean;
}

const QuantityModal: React.FC<QuantityModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  product,
  loading = false,
  title = "Agregar Producto",
  showNotes = false,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);
  const [error, setError] = useState("");

  const ingredients = product?.defaultIngredients ?? [];

  const toggleIngredient = (ingredient: string) => {
    setRemovedIngredients((prev) =>
      prev.includes(ingredient) ? prev.filter((i) => i !== ingredient) : [...prev, ingredient]
    );
  };

  const buildNotes = (): string | undefined => {
    const parts: string[] = [];
    if (removedIngredients.length > 0) parts.push(`Sin: ${removedIngredients.join(', ')}`);
    if (notes.trim()) parts.push(notes.trim());
    return parts.length > 0 ? parts.join(' · ') : undefined;
  };

  const handleQuantityChange = (change: number) => {
    const newQuantity = Math.max(1, quantity + change);
    setQuantity(newQuantity);
  };

  const handleConfirm = async () => {
    if (quantity < 1) {
      setError("La cantidad debe ser mayor a 0");
      return;
    }

    try {
      setError("");
      await onConfirm(quantity, buildNotes());
      handleClose();
    } catch (error: any) {
      setError(error.message || "Error al agregar el producto");
    }
  };

  const handleClose = () => {
    setQuantity(1);
    setNotes("");
    setRemovedIngredients([]);
    setError("");
    onClose();
  };

  // Cerrar modal con tecla Escape
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen && !loading) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, loading]);

  // Reset quantity when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setNotes("");
      setRemovedIngredients([]);
      setError("");
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
        className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4 border border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <ShoppingCart className="w-6 h-6 text-red-500 mr-2" />
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
            <h3 className="text-lg font-semibold text-white mb-1">
              {product.name}
            </h3>
            {product.description && (
              <p className="text-gray-400 text-sm mb-2">
                {product.description}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-red-500 font-bold">
                ${product.price.toFixed(2)}
              </span>
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
              <div className="text-3xl font-bold text-white mb-1">
                {quantity}
              </div>
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

        {/* Ingredientes que se pueden quitar */}
        {ingredients.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Ingredientes <span className="text-gray-500 font-normal">(desmarca lo que no lleve)</span>
            </label>
            <div className="space-y-2">
              {ingredients.map((ingredient) => (
                <label
                  key={ingredient}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-gray-700 cursor-pointer"
                >
                  <span className="text-sm text-white">{ingredient}</span>
                  <input
                    type="checkbox"
                    checked={!removedIngredients.includes(ingredient)}
                    onChange={() => toggleIngredient(ingredient)}
                    disabled={loading}
                    className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-red-500 focus:ring-red-500"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Notes (barra drinks / platillos con preparación especial) */}
        {showNotes && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Cómo lo quiere <span className="text-gray-500 font-normal">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: divorciado, campechano, agua mineral, pura coca, término de la carne, etc."
              rows={2}
              disabled={loading}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:border-red-500 resize-none disabled:opacity-50"
            />
          </div>
        )}

        {/* Total */}
        <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-red-400 font-medium">Total:</span>
            <span className="text-2xl font-bold text-red-500">
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
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-gray-100 font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
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
