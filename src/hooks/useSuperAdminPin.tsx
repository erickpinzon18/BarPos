// src/hooks/useSuperAdminPin.tsx
// Pide el PIN de un super administrador antes de ejecutar una acción sensible
// (cambiar precios, crear o modificar promociones). Siempre pide el PIN, aunque
// la sesión sea de un super admin, para que quede quién autorizó.
import { useState } from 'react';
import PinModal from '../components/common/PinModal';
import { verifyUserPin } from '../services/orderService';
import type { User } from '../utils/types';

interface PinRequest {
  title: string;
  message: string;
  action: (authorizedBy: User) => Promise<void>;
}

export const useSuperAdminPin = () => {
  const [request, setRequest] = useState<PinRequest | null>(null);
  const [loading, setLoading] = useState(false);

  /** Abre el PIN; `action` corre solo si el PIN es de un super admin. */
  const requireSuperAdmin = (title: string, message: string, action: PinRequest['action']) =>
    setRequest({ title, message, action });

  const handleConfirm = async (pin: string) => {
    if (!request) return;
    setLoading(true);
    try {
      const user = await verifyUserPin(pin);
      if (!user.superAdmin) throw new Error('Solo un super administrador puede autorizar este cambio');
      await request.action(user);
      setRequest(null);
    } finally {
      setLoading(false);
    }
  };

  const pinModal = (
    <PinModal
      isOpen={!!request}
      onClose={() => setRequest(null)}
      onConfirm={handleConfirm}
      title={request?.title ?? ''}
      message={request?.message ?? ''}
      loading={loading}
    />
  );

  return { requireSuperAdmin, pinModal };
};
