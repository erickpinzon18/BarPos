// src/components/common/PinModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Lock, AlertTriangle } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (pin: string) => Promise<void>;
  title: string;
  message: string;
  loading?: boolean;
}

const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  loading = false
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);

  // Detectar si es desktop (no móvil/tablet)
  useEffect(() => {
    const checkIfDesktop = () => {
      // Verificar si es un dispositivo táctil
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      // Verificar el ancho de pantalla (desktop > 1024px)
      const isWideScreen = window.innerWidth > 1024;
      
      setIsDesktop(!isTouchDevice && isWideScreen);
    };

    checkIfDesktop();
    window.addEventListener('resize', checkIfDesktop);
    
    return () => window.removeEventListener('resize', checkIfDesktop);
  }, []);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(pin + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setPin('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pin.trim()) {
      setError('Por favor ingresa el PIN');
      return;
    }

    if (pin.length < 4) {
      setError('El PIN debe tener al menos 4 dígitos');
      return;
    }

    try {
      setError('');
      await onConfirm(pin);
      setPin('');
      onClose();
    } catch (error: any) {
      setError(error.message || 'PIN incorrecto');
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onClose();
  };

  // Manejar entrada de teclado (solo desktop)
  useEffect(() => {
    if (!isOpen || !isDesktop) return;

    const handleKeyPress = (event: KeyboardEvent) => {
      // Prevenir el comportamiento por defecto solo para números y teclas específicas
      if (/^[0-9]$/.test(event.key) || ['Backspace', 'Delete', 'Enter'].includes(event.key)) {
        event.preventDefault();
      }

      // Números 0-9
      if (/^[0-9]$/.test(event.key) && pin.length < 4 && !loading) {
        handleNumberClick(event.key);
      }
      // Backspace o Delete
      else if ((event.key === 'Backspace' || event.key === 'Delete') && !loading) {
        handleBackspace();
      }
      // Enter para confirmar
      else if (event.key === 'Enter' && pin.length >= 4 && !loading) {
        handleSubmit(event as any);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, isDesktop, pin, loading]);

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

  if (!isOpen) return null;

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
            <Lock className="w-6 h-6 text-amber-400 mr-2" />
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

        {/* Warning */}
        <div className="flex items-start bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-red-200 text-sm">{message}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              PIN de Autorización
            </label>
            
            {/* Indicador de entrada por teclado (solo desktop) */}
            {isDesktop && (
              <div className="flex items-center justify-center gap-2 mb-3 text-xs text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Puedes usar el teclado numérico</span>
              </div>
            )}
            
            {/* PIN Display */}
            <div className="w-full px-4 py-4 bg-gray-900 border-2 border-gray-600 rounded-lg mb-4">
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-3xl font-bold transition-all ${
                      pin.length > index
                        ? 'bg-amber-500 text-gray-900 scale-110'
                        : 'bg-gray-700 text-gray-500'
                    }`}
                  >
                    {pin.length > index ? '•' : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Pinpad Numérico */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleNumberClick(num)}
                  disabled={loading || pin.length >= 4}
                  className="h-14 bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={loading || pin.length === 0}
                className="h-14 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={() => handleNumberClick('0')}
                disabled={loading || pin.length >= 4}
                className="h-14 bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={loading || pin.length === 0}
                className="h-14 bg-gray-600 hover:bg-gray-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                ⌫
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm mt-2 text-center font-medium">{error}</p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !pin.trim() || pin.length < 4}
            >
              {loading ? 'Verificando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PinModal;
