// src/components/common/TipAuthGate.tsx
// La propina del cliente no se captura a mano: solo se aplica la automática de promos (10%).
// Mientras `unlocked` sea false, en lugar de los controles de propina se muestra solo el aviso.
import React from 'react';

interface TipAuthGateProps {
  unlocked: boolean;
  onUnlock?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const TipAuthGate: React.FC<TipAuthGateProps> = ({ unlocked, children }) => {
  if (unlocked) return <>{children}</>;

  return (
    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-800">
      <h3 className="font-semibold text-white">Propina</h3>
      <p className="text-xs text-gray-400 mt-1">La propina de promos (10%) se agrega sola.</p>
    </div>
  );
};

export default TipAuthGate;
