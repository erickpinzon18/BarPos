// src/utils/types.ts
import type { CategoryKey } from './categories';

export type UserRole = 'admin' | 'waiter' | 'kitchen' | 'barra' | 'capitan';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  active?: boolean; // true = activo, false = inactivo
  role: UserRole;
  pin?: string; // PIN para autorizar eliminaciones
  superAdmin?: boolean; // Acceso a módulo de modificación de precios en cuenta
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: CategoryKey;
  imageUrl?: string;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TableStatus = 'libre' | 'ocupada' | 'reservada' | 'limpieza';

export interface Table {
  id: string;
  number: number | string;
  // capacity: number;
  status: TableStatus;
  waiterId?: string;
  waiterName?: string;
  currentOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ReservationStatus = 'pendiente' | 'aceptada' | 'cancelada' | 'llegó';
export type ReservationPriority = 'baja' | 'media' | 'alta';

export interface Reservation {
  id: string;
  customerName: string;
  pax: number;
  reservationDate: Date; // when is the reservation for
  status: ReservationStatus;
  priority: ReservationPriority;
  notes?: string;
  tableId?: string; // assigned table
  tableName?: string; // name of the assigned table
  createdBy: string; // user ID who made the reservation
  createdByName: string; // name of the user who made the reservation
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 'activo' | 'pagado' | 'cancelado' | 'cortesia';
export type OrderItemStatus = 'pendiente' | 'entregado';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productPrice: number;
  quantity: number;
  status: OrderItemStatus;
  notes?: string;
  category: Product['category'];
  isDeleted?: boolean; // Item eliminado
  deletedBy?: string; // ID del usuario que lo eliminó
  deletedByName?: string; // Nombre del usuario que lo eliminó
  deletedAt?: Date; // Fecha de eliminación
  printedAt?: Date; // Timestamp de cuando se imprimió la comanda automáticamente
  swapFromName?: string; // Nombre del producto anterior cuando se cambió por swap (para reimprimir ticket de cambio)
  cancelReason?: string; // Motivo de cancelación del item
  pendingCancelPrint?: boolean; // Marca un item recién cancelado para que se imprima ticket de cancelación en barra/cocina
  // Auditoría de modificación de precio por superAdmin
  originalPrice?: number;
  priceModifiedBy?: string;
  priceModifiedByName?: string;
  priceModifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  tableId: string;
  tableNumber: number | string;
  tableName?: string; // Nombre personalizado de la mesa (ej: "Mesa de Andrea")
  waiterId: string;
  waiterName: string;
  items: OrderItem[];
  status: OrderStatus;
  paymentMethod?: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  peopleCount?: number; // number of people at the table when the order was closed
  payments?: Payment[];
  subtotal?: number;
  tax?: number;
  total?: number;
  adminComments?: string; // Comentarios administrativos (no visibles en ticket de cliente)
  folio?: number; // Folio consecutivo global, asignado al cerrar la cuenta
  // Campos de cortesía (cuando la mesa se cierra sin cobro)
  courtesyBy?: string;
  courtesyByName?: string;
  courtesyAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export type CardType = 'Visa' | 'Mastercard' | 'Amex' | 'Otra';

export interface Payment {
  id?: string;
  method: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  amount?: number;
  receivedAmount?: number;
  change?: number;
  tipAmount?: number;
  tipPercent?: number; // Percentage as decimal (e.g., 0.15 for 15%)
  cashierId?: string;
  cashierName?: string;
  cardOperationNumber?: string;
  cardType?: CardType; // Tipo de tarjeta (solo cuando method === 'tarjeta')
  cardDetail?: string; // Detalle opcional (ej: "últimos 4 dígitos", nota libre)
  closedAt?: Date;
  createdAt: Date;
}

// Promotion type
export type DiscountType = 'percentage' | 'fixed' | '2x1' | 'nxprice' | 'fixedprice';

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  /**
   * Valor del descuento según tipo:
   * - percentage: 0-100
   * - fixed: monto a descontar en pesos
   * - 2x1: ignorado
   * - nxprice: precio del bundle
   * - fixedprice: precio final por unidad (ej: $1000 por botella)
   */
  discountValue: number;
  /** Categorías a las que aplica; vacío = aplica a todas */
  categories: CategoryKey[];
  /**
   * IDs de productos específicos a los que aplica dentro de las categorías seleccionadas.
   * Vacío = todos los productos de las categorías seleccionadas (o todos si categories también está vacío).
   */
  productIds: string[];
  /** Hora límite para aplicar la promoción, formato "HH:mm" (24h). Después de esta hora ya no se puede usar */
  cutoffTime: string;
  /**
   * Días de la semana en los que aplica la promoción (0=Dom, 1=Lun, ..., 6=Sáb).
   * Vacío o undefined = todos los días.
   */
  activeDays?: number[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Form interfaces for components
export interface LoginFormData {
  email: string;
  password: string;
}

export interface ProductFormData {
  name: string;
  description: string;
  price: number;
  category: Product['category'];
  available: boolean;
}

export interface TableFormData {
  number: number;
  capacity: number;
}

// Context interfaces
export interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
}

// API Response types
export interface FirestoreResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Utility types
export type WithId<T> = T & { id: string };
export type CreateData<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateData<T> = Partial<Omit<T, 'id' | 'createdAt'>>;
