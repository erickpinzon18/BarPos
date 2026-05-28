// src/components/common/CancelReasonModal.tsx
import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, MessageSquare } from 'lucide-react';

const PRESET_REASONS = [
  'El cliente cambió de opinión',
  'Producto agotado',
  'Error al ordenar',
  'El cliente se fue',
  'Pedido duplicado',
  'Otro',
];

interface CancelReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  itemName: string;
}

const CancelReasonModal: React.FC<CancelReasonModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setSelectedReason('');
      setCustomReason('');
      setError('');
    }
  }, [isOpen]);

  // Cerrar con Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const finalReason =
      selectedReason === 'Otro' ? customReason.trim() : selectedReason.trim();

    if (!finalReason) {
      setError('Por favor selecciona o escribe un motivo');
      return;
    }
    onConfirm(finalReason);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-900/40 rounded-lg">
              <MessageSquare className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-white">Motivo de Cancelación</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Warning */}
          <div className="flex items-start gap-3 bg-red-900/20 border border-red-800/60 rounded-xl p-3">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-200 text-sm font-medium">Cancelando item:</p>
              <p className="text-white text-sm font-bold">{itemName}</p>
            </div>
          </div>

          {/* Razones predefinidas */}
          <div>
            <p className="text-sm font-medium text-gray-300 mb-2">
              ¿Por qué se cancela?
            </p>
            <div className="grid grid-cols-1 gap-2">
              {PRESET_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => {
                    setSelectedReason(reason);
                    setError('');
                  }}
                  className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    selectedReason === reason
                      ? 'bg-red-700/30 border-red-500 text-red-200'
                      : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>

          {/* Campo personalizado si elige "Otro" */}
          {selectedReason === 'Otro' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Describe el motivo
              </label>
              <textarea
                autoFocus
                value={customReason}
                onChange={(e) => {
                  setCustomReason(e.target.value);
                  setError('');
                }}
                placeholder="Escribe el motivo aquí..."
                rows={2}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
              />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm font-medium text-center">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-5 pt-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex-1 px-4 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-xl transition-colors"
          >
            Continuar →
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelReasonModal;
