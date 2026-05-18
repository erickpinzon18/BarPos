// src/components/common/BottleQuantityModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Wine } from 'lucide-react';
import type { Product } from '../../utils/types';

interface MixerDef {
  label: string;
  emoji: string;
}

const MIXERS: MixerDef[] = [
  { label: 'Agua Mineral', emoji: '💧' },
  { label: 'Coca Cola',   emoji: '🥤' },
  { label: 'Sprite',      emoji: '🍋' },
  { label: 'Manzanita',   emoji: '🍎' },
];

interface BottleQuantityModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** onConfirm receives bottle quantity and a services notes string (may be empty) */
  onConfirm: (quantity: number, notes: string) => Promise<void>;
  product: Product | null;
  /** 5 for regular price, 3 for promo */
  maxServicesPerBottle: number;
  loading?: boolean;
}

const BottleQuantityModal: React.FC<BottleQuantityModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  product,
  maxServicesPerBottle,
  loading = false,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [mixerQty, setMixerQty] = useState<number[]>([0, 0, 0, 0]);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setMixerQty([0, 0, 0, 0]);
      setError('');
    }
  }, [isOpen]);

  // When bottle quantity changes downward, clamp mixer totals if they exceed new max
  const handleBottleChange = (delta: number) => {
    const newQty = Math.max(1, quantity + delta);
    const newMax = newQty * maxServicesPerBottle;
    if (delta < 0) {
      const total = mixerQty.reduce((s, q) => s + q, 0);
      if (total > newMax) {
        // Scale each mixer down proportionally
        const ratio = newMax / total;
        setMixerQty(mixerQty.map(q => Math.floor(q * ratio)));
      }
    }
    setQuantity(newQty);
  };

  const maxTotal = quantity * maxServicesPerBottle;
  const totalUsed = mixerQty.reduce((s, q) => s + q, 0);
  const remaining = maxTotal - totalUsed;
  const barFull = totalUsed >= maxTotal;

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
    return parts.length > 0 ? `Servicios: ${parts.join(', ')}` : '';
  };

  const handleConfirm = async () => {
    if (quantity < 1) return;
    setConfirming(true);
    setError('');
    try {
      await onConfirm(quantity, buildNotes());
      handleClose();
    } catch (e: any) {
      setError(e.message || 'Error al agregar la botella');
    } finally {
      setConfirming(false);
    }
  };

  const handleClose = () => {
    setQuantity(1);
    setMixerQty([0, 0, 0, 0]);
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
        className="bg-gray-800 rounded-xl p-6 w-full max-w-sm mx-4 border border-gray-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wine className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-bold text-white">Agregar Botella</h2>
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

        {/* Bottle quantity */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-300 mb-3">Cantidad de botellas</label>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => handleBottleChange(-1)}
              disabled={quantity <= 1 || loading || confirming}
              className="w-12 h-12 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
            >
              <Minus className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{quantity}</div>
              <div className="text-xs text-gray-400">botellas</div>
            </div>
            <button
              onClick={() => handleBottleChange(1)}
              disabled={loading || confirming}
              className="w-12 h-12 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg flex items-center justify-center transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Total price */}
        <div className="mb-5 px-3 py-2.5 bg-red-900/20 border border-red-700 rounded-lg flex justify-between items-center">
          <span className="text-red-400 font-medium text-sm">Total botella{quantity > 1 ? 's' : ''}:</span>
          <span className="text-xl font-bold text-red-500">${(product.price * quantity).toFixed(2)} MXN</span>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 mb-4" />

        {/* Services section */}
        <div className="mb-1">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-200">Mezcladores incluidos</p>
            <span className={`text-xs font-bold ${barFull ? 'text-orange-400' : 'text-gray-400'}`}>
              {totalUsed}/{maxTotal}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Máx. <span className="text-white font-medium">{maxServicesPerBottle}</span> por botella
            {quantity > 1 ? ` · ${maxTotal} en total` : ''}
          </p>
          {/* Usage bar */}
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-4 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-200 ${barFull ? 'bg-orange-500' : 'bg-purple-500'}`}
              style={{ width: `${Math.min(100, (totalUsed / maxTotal) * 100)}%` }}
            />
          </div>
        </div>

        {!barFull && (
          <p className="text-xs text-orange-400 mb-3">
            Selecciona {remaining} servicio{remaining !== 1 ? 's' : ''} más para continuar
          </p>
        )}

        <div className="space-y-2 mb-5">
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
            disabled={loading || confirming || totalUsed < maxTotal}
            className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {confirming || loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Agregando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Agregar a la Orden
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BottleQuantityModal;
