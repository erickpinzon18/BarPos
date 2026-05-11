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
 * Verifica si una promoción está dentro de su horario válido (antes de la hora de corte).
 * @param cutoffTime Hora de corte en formato "HH:mm" (24h)
 * @returns true si la promoción aún se puede aplicar
 */
export const isPromotionWithinSchedule = (cutoffTime: string, referenceTime?: Date | any): boolean => {
  if (!cutoffTime) return true; // Sin hora de corte = siempre aplica

  const timeToCheck = referenceTime ? new Date(referenceTime) : new Date();
  if (isNaN(timeToCheck.getTime())) return true; // Fallback if invalid date

  const [hours, minutes] = cutoffTime.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes)) return true;

  const cutoff = new Date(timeToCheck);
  cutoff.setHours(hours, minutes, 0, 0);

  return timeToCheck <= cutoff;
};
