// src/utils/types.ts
import type { CategoryKey } from './categories';

export type UserRole = 'admin' | 'waiter' | 'kitchen';

export interface User {
  id: string;
  email: string;
  displayName?: string;
  active?: boolean; // true = activo, false = inactivo
  role: UserRole;
  pin?: string; // PIN para autorizar eliminaciones
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
  number: number;
  // capacity: number;
  status: TableStatus;
  waiterId?: string;
  waiterName?: string;
  currentOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 'activo' | 'pagado' | 'cancelado';
export type OrderItemStatus = 'pendiente' | 'en_preparacion' | 'listo' | 'entregado';

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
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  tableId: string;
  tableNumber: number;
  waiterId: string;
  waiterName: string;
  items: OrderItem[];
  status: OrderStatus;
  paymentMethod?: 'efectivo' | 'tarjeta' | 'transferencia';
  peopleCount?: number; // number of people at the table when the order was closed
  payments?: Payment[];
  subtotal?: number;
  tax?: number;
  total?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface Payment {
  id?: string;
  method: 'efectivo' | 'tarjeta' | 'transferencia';
  receivedAmount?: number;
  change?: number;
  tipAmount?: number;
  tipPercent?: number; // Percentage as decimal (e.g., 0.15 for 15%)
  cashierId?: string;
  createdAt: Date;
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
