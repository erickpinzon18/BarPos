// src/components/common/DrinkMixerModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, GlassWater } from 'lucide-react';
import { MIXERS } from './BottleQuantityModal';
import type { Product } from '../../utils/types';

const MAX_MIXERS = 2;
const DEFAULT_MIXERS = [0, 0, 0, 0, 0];

interface DrinkMixerModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** onConfirm receives quantity and notes string (may be empty) */
  onConfirm: (quantity: number, notes: string) => Promise<void>;
  product: Product | null;
  loading?: boolean;
  isEditMode?: boolean;
  initialQuantity?: number;
  initialMixers?: number[];
  initialComment?: string;
}

/** Parse notes like "Refresco: 1x Coca Cola, 1x Squirt | sin hielo" */
export const parseDrinkNotes = (notes: string | undefined): { mixers: number[]; comment: string } => {
  const mixers = [0, 0, 0, 0, 0];
  let comment = '';
  if (!notes) return { mixers, comment };

  MIXERS.forEach((mixer, idx) => {
    const regex = new RegExp(`(\\d+)x\\s+${mixer.label}`);
    const match = notes.match(regex);
    if (match) mixers[idx] = parseInt(match[1], 10);
  });

  const pipeIdx = notes.indexOf(' | ');
  if (pipeIdx !== -1) {
    comment = notes.slice(pipeIdx + 3);
  }

  return { mixers, comment };
};

const DrinkMixerModal: React.FC<DrinkMixerModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  product,
  loading = false,
  isEditMode = false,
  initialQuantity = 1,
  initialMixers = DEFAULT_MIXERS,
  initialComment = '',
}) => {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [mixerQty, setMixerQty] = useState<number[]>(initialMixers);
  const [comment, setComment] = useState(initialComment);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuantity(initialQuantity);
      setMixerQty([...initialMixers]);
      setComment(initialComment);
      setError('');
    }
  }, [isOpen, initialQuantity, initialMixers, initialComment]);

  const totalMixers = mixerQty.reduce((s, q) => s + q, 0);
  const remaining = MAX_MIXERS - totalMixers;
  const barFull = totalMixers >= MAX_MIXERS;

  const handleMixerChange = (idx: number, delta: number) => {
    setMixerQty(prev =>
      prev.map((q, i) => {
        if (i !== idx) return q;
        if (delta > 0 && remaining <= 0) return q;
        return Math.max(0, q + delta);
      })
    );
  };

  const buildNotes = (): string => {
    const parts = MIXERS
      .map((m, i) => (mixerQty[i] > 0 ? `${mixerQty[i]}x ${m.label}` : ''))
      .filter(Boolean);
    let notes = '';
    if (parts.length > 0) {
      notes = `Refresco: ${parts.join(', ')}`;
    }
    if (comment.trim()) {
      notes = notes ? `${notes} | ${comment.trim()}` : comment.trim();
    }
    return notes;
  };

  const handleConfirm = async () => {
    if (quantity < 1) return;
    setConfirming(true);
    setError('');
    try {
      await onConfirm(quantity, buildNotes());
      handleClose();
    } catch (e: any) {
      setError(e.message || 'Error al agregar');
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    setQuantity(1);
    setMixerQty([...DEFAULT_MIXERS]);
    setComment('');
    setError('');
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading && !confirming) handleClose();
    };
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, loading, confirming]);

  if (!isOpen || !product) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleClose}
    >
      <div
        className="bg-gray-800 rounded-xl p-6 w-full max-w-sm mx-4 border border-gray-700 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GlassWater className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-bold text-white">
              {isEditMode ? 'Editar Refresco' : 'Agregar Trago'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
            disabled={loading || confirming}
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Product info */}
        <div className="bg-gray-700 rounded-lg p-3 mb-5">
          <p className="text-white font-semibold">{product.name}</p>
          <p className="text-red-400 font-bold text-sm mt-0.5">${product.price.toFixed(2)}</p>
        </div>

        {/* Quantity — only when adding new */}
        {!isEditMode && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-300 mb-3">Cantidad</label>
            <div className="flex items-center gap-4 bg-gray-900 rounded-xl p-2 border border-gray-700">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-12 h-12 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Minus className="w-6 h-6" />
              </button>
              <span className="w-12 text-center text-2xl font-bold text-white">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="w-12 h-12 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white flex items-center justify-center transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}

        {/* Total price */}
        {!isEditMode && (
          <div className="mb-5 px-3 py-2.5 bg-red-900/20 border border-red-700 rounded-lg flex justify-between items-center">
            <span className="text-red-400 font-medium text-sm">Total:</span>
            <span className="text-xl font-bold text-red-500">${(product.price * quantity).toFixed(2)} MXN</span>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-700 mb-4" />

        {/* Mixers */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-200">¿Con qué refresco?</p>
            <span className={`text-xs font-bold ${barFull ? 'text-orange-400' : 'text-gray-400'}`}>
              {totalMixers}/{MAX_MIXERS}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Puedes elegir hasta <span className="text-white font-medium">{MAX_MIXERS}</span> refrescos
          </p>

          {/* Usage bar */}
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-4 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-200 ${barFull ? 'bg-orange-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(100, (totalMixers / MAX_MIXERS) * 100)}%` }}
            />
          </div>

          <div className="space-y-2 mb-1">
            {MIXERS.map((mixer, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-700 rounded-lg px-3 py-2.5">
                <span className="text-sm text-white">{mixer.emoji} {mixer.label}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleMixerChange(idx, -1)}
                    disabled={mixerQty[idx] <= 0 || loading || confirming}
                    className="w-7 h-7 bg-gray-600 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-md flex items-center justify-center transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center text-white font-bold text-sm">{mixerQty[idx]}</span>
                  <button
                    onClick={() => handleMixerChange(idx, 1)}
                    disabled={remaining <= 0 || loading || confirming}
                    className="w-7 h-7 bg-gray-600 hover:bg-gray-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-md flex items-center justify-center transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-300 mb-2">Notas / Comentarios</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Ej: sin hielo, poco hielo, extra limón..."
            rows={2}
            disabled={loading || confirming}
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none placeholder-gray-600"
          />
        </div>

        {error && (
          <div className="mb-3 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={loading || confirming}
            className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || confirming}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {confirming || loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                {isEditMode ? 'Guardando...' : 'Agregando...'}
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                {isEditMode ? 'Guardar Cambios' : 'Agregar a la Orden'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DrinkMixerModal;
