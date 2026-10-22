// src/components/common/TipAuthGate.tsx
// La propina del cliente no se sugiere: solo se puede agregar si la autoriza el dueño
// (usuario superAdmin) con su PIN.
import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import PinModal from './PinModal';
import { verifyUserPin } from '../../services/orderService';

interface TipAuthGateProps {
  unlocked: boolean;
  onUnlock: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const TipAuthGate: React.FC<TipAuthGateProps> = ({ unlocked, onUnlock, disabled, children }) => {
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);

  if (unlocked) return <>{children}</>;

  const handleConfirm = async (pin: string) => {
    setLoading(true);
    try {
      const user = await verifyUserPin(pin);
      if (!user.superAdmin) throw new Error('Solo el dueño puede autorizar propina');
      setShowPin(false);
      onUnlock();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-2xl border border-gray-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Propina</h3>
          <p className="text-xs text-gray-400 mt-1">Sin propina. Solo se agrega con autorización del dueño.</p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowPin(true)}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Lock className="w-4 h-4" />
          Autorizar
        </button>
      </div>
      <PinModal
        isOpen={showPin}
        onClose={() => { setShowPin(false); setLoading(false); }}
        onConfirm={handleConfirm}
        title="Autorizar propina"
        message="Ingresa la clave del dueño para agregar propina a esta cuenta."
        loading={loading}
      />
    </div>
  );
};

export default TipAuthGate;
