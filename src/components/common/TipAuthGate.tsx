// src/components/common/TipAuthGate.tsx
// La propina del cliente no se captura a mano: solo se aplica la automática de promos (10%).
// Mientras `unlocked` sea false, en lugar de los controles de propina se muestra el aviso
// y el campo de "propina extra" (lo que el cliente dejó de más), que se suma a la propina de la cuenta.
import React from 'react';

interface TipAuthGateProps {
  unlocked: boolean;
  onUnlock?: () => void;
  disabled?: boolean;
  extraTip?: string;
  onExtraTipChange?: (value: string) => void;
  children: React.ReactNode;
}

const TipAuthGate: React.FC<TipAuthGateProps> = ({ unlocked, disabled, extraTip, onExtraTipChange, children }) => {
  if (unlocked) return <>{children}</>;

  return (
    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-800">
      <h3 className="font-semibold text-white">Propina</h3>
      <p className="text-xs text-gray-400 mt-1">La propina de promos (10%) se agrega sola.</p>
      {onExtraTipChange && (
        <div className="mt-4">
          <label className="block text-sm text-gray-300 mb-1">Propina extra (si el cliente dejó de más)</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">$</span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              disabled={disabled}
              value={extraTip ?? ''}
              onChange={(e) => onExtraTipChange(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-red-500 focus:border-red-500 disabled:opacity-50"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Se suma al total cobrado y cuenta como propina del mesero en el cierre de caja.</p>
        </div>
      )}
    </div>
  );
};

export default TipAuthGate;
