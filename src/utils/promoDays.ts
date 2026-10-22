// src/utils/promoDays.ts
// Productos de la categoría Promos: solo se venden los días configurados (activeDays).
import type { Product } from './types';
import { getCurrentShiftDate } from './shift';

export const PROMO_CATEGORY = 'Promos';

/** 0=Dom … 6=Sáb (igual que Date.getDay) */
export const WEEKDAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
/** Orden para mostrar: lunes primero */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const isPromoProduct = (p: Pick<Product, 'category'>): boolean => p.category === PROMO_CATEGORY;

/**
 * ¿Se puede vender hoy? Solo aplica a Promos con días definidos. El día es el del turno
 * (después de medianoche y antes de abrir sigue contando como el día anterior).
 */
export const isSellableToday = (p: Pick<Product, 'category' | 'activeDays'>): boolean => {
  if (!isPromoProduct(p) || !p.activeDays || p.activeDays.length === 0) return true;
  return p.activeDays.includes(getCurrentShiftDate().getDay());
};

/** "Lun, Vie" / "Todos los días" */
export const formatPromoDays = (days?: number[]): string =>
  !days || days.length === 0 || days.length === 7
    ? 'Todos los días'
    : WEEKDAY_ORDER.filter(d => days.includes(d)).map(d => WEEKDAY_LABELS[d]).join(', ');
