// src/utils/promoDays.ts
// Productos de la categoría Promos: solo se venden los días configurados (activeDays).
import type { Product, OrderItem } from './types';
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

/** Propina automática: 10% sobre lo que se cobra de productos Promos (los de comisión no llevan). */
export const PROMO_TIP_RATE = 0.1;

/** Base de la propina de promos: importe de los items Promos menos su descuento. */
export const getPromoTipBase = (
  items: Pick<OrderItem, 'id' | 'category' | 'productPrice' | 'quantity' | 'isDeleted'>[],
  itemDiscounts: Record<string, number> = {}
): number =>
  items
    .filter(i => !i.isDeleted && i.category === PROMO_CATEGORY)
    .reduce((s, i) => s + i.productPrice * i.quantity - (itemDiscounts[i.id] ?? 0), 0);
