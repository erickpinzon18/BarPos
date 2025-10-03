// src/utils/constants.ts

export const ORDER_STATUSES = {
  ACTIVE: 'activo',
  PAID: 'pagado',
  CANCELLED: 'cancelado',
} as const;

export const ORDER_ITEM_STATUSES = {
  PENDING: 'pendiente',
  IN_PROGRESS: 'en_preparacion',
  READY: 'listo',
  DELIVERED: 'entregado',
} as const;

export const TABLE_STATUSES = {
  FREE: 'libre',
  OCCUPIED: 'ocupada',
  RESERVED: 'reservada',
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  WAITER: 'waiter',
  KITCHEN: 'kitchen',
} as const;

export const PRODUCT_CATEGORIES = {
  DRINK: 'Bebida',
  FOOD: 'Comida',
  DESSERT: 'Postre',
  APPETIZER: 'Entrada',
} as const;

export const PAYMENT_METHODS = {
  CASH: 'efectivo',
  CARD: 'tarjeta',
  TRANSFER: 'transferencia',
} as const;

export const TAX_RATE = 0.16; // 16% IVA

export const TOAST_DURATION = 4000;

/**
 * Tiempo en minutos que los items entregados permanecen visibles en el Kanban
 * antes de ser ocultados automáticamente.
 * 
 * Por defecto: 30 minutos
 * 
 * Este valor determina cuánto tiempo se muestran los items con estado "entregado"
 * en las columnas del Kanban de Cocina y Barra. Después de este tiempo, los items
 * desaparecen automáticamente para mantener la vista limpia.
 * 
 * Ejemplos de valores:
 * - 15 minutos = Vista más limpia, items desaparecen rápido
 * - 30 minutos = Balance recomendado (por defecto)
 * - 60 minutos = Vista con más historial
 * 
 * Para desactivar el filtro y mostrar todos los entregados, usar: Infinity
 */
export const KANBAN_DELIVERED_RETENTION_MINUTES = 30;

export const STATUS_COLORS = {
  [ORDER_ITEM_STATUSES.PENDING]: 'bg-yellow-600/20 text-yellow-400',
  [ORDER_ITEM_STATUSES.IN_PROGRESS]: 'bg-blue-600/20 text-blue-400',
  [ORDER_ITEM_STATUSES.READY]: 'bg-green-600/20 text-green-400',
  [ORDER_ITEM_STATUSES.DELIVERED]: 'bg-gray-600/20 text-gray-400',
  [TABLE_STATUSES.FREE]: 'bg-green-600/20 text-green-400',
  [TABLE_STATUSES.OCCUPIED]: 'bg-red-600/20 text-red-400',
  [TABLE_STATUSES.RESERVED]: 'bg-yellow-600/20 text-yellow-400',
} as const;
