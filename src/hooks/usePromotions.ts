// src/hooks/usePromotions.ts
import { useState, useEffect } from 'react';
import { getPromotions, getActivePromotionsRealtime } from '../services/firestoreService';
import type { Promotion } from '../utils/types';

/**
 * Hook para obtener todas las promociones (admin management)
 */
export const usePromotions = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await getPromotions();
      if (res.success && res.data) {
        setPromotions(res.data);
      } else {
        setError(res.error || 'Error al obtener promociones');
      }
    } catch (err: any) {
      setError(err?.message || 'Error al obtener promociones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return { promotions, loading, error, refresh };
};

/**
 * Hook realtime para obtener solo promociones activas (para checkout)
 */
export const useActivePromotions = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = getActivePromotionsRealtime((data) => {
      setPromotions(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { promotions, loading };
};

/**
 * Verifica si una promoción está dentro de su horario y día válidos.
 * @param cutoffTime Hora de corte en formato "HH:mm" (24h)
 * @param referenceTime Fecha/hora de referencia (default: ahora)
 * @param activeDays Días de la semana activos (0=Dom…6=Sáb). Vacío = todos los días.
 */
export const isPromotionWithinSchedule = (
  cutoffTime: string,
  referenceTime?: Date | any,
  activeDays?: number[]
): boolean => {
  const timeToCheck = referenceTime ? new Date(referenceTime) : new Date();
  if (isNaN(timeToCheck.getTime())) return true; // Fallback si fecha inválida

  // Validar día de la semana
  if (activeDays && activeDays.length > 0) {
    const dayOfWeek = timeToCheck.getDay(); // 0=Dom, 4=Jue, 6=Sáb
    if (!activeDays.includes(dayOfWeek)) return false;
  }

  if (!cutoffTime) return true; // Sin hora de corte = siempre aplica en días válidos

  const [hours, minutes] = cutoffTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return true;

  const cutoff = new Date(timeToCheck);
  cutoff.setHours(hours, minutes, 0, 0);

  return timeToCheck <= cutoff;
};
