// src/services/firestoreService.ts
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  arrayUnion,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  User,
  Product,
  Table,
  Order,
  OrderItem,
  CreateData,
  UpdateData,
  FirestoreResponse
} from '../utils/types';

// Helper function to convert Firestore timestamps to Date objects
const convertTimestamps = (data: any) => {
  const converted = { ...data };
  if (converted.createdAt?.toDate) {
    converted.createdAt = converted.createdAt.toDate();
  }
  if (converted.updatedAt?.toDate) {
    converted.updatedAt = converted.updatedAt.toDate();
  }
  if (converted.completedAt?.toDate) {
    converted.completedAt = converted.completedAt.toDate();
  }
  // Convert timestamps inside items array (order items)
  if (Array.isArray(converted.items)) {
    converted.items = converted.items.map((it: any) => {
      const newItem = { ...it };
      if (newItem.createdAt?.toDate) newItem.createdAt = newItem.createdAt.toDate();
      if (newItem.updatedAt?.toDate) newItem.updatedAt = newItem.updatedAt.toDate();
      return newItem;
    });
  }
  // Convert timestamps inside payments array if present
  if (Array.isArray(converted.payments)) {
    converted.payments = converted.payments.map((p: any) => {
      const newP = { ...p };
      if (newP.createdAt?.toDate) newP.createdAt = newP.createdAt.toDate();
      return newP;
    });
  }
  return converted;
};

// USER MANAGEMENT
export const getUserByUid = async (uid: string): Promise<FirestoreResponse<User>> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const userData = convertTimestamps({ id: userDoc.id, ...userDoc.data() }) as User;
      return { success: true, data: userData };
    }
    return { success: false, error: 'Usuario no encontrado' };
  } catch (error) {
    console.error('Error getting user:', error);
    return { success: false, error: 'Error al obtener usuario' };
  }
};

export const createUser = async (uid: string, userData: CreateData<User>): Promise<FirestoreResponse<User>> => {
  try {
    const now = Timestamp.now();
    const userWithTimestamps = {
      ...userData,
      createdAt: now,
      updatedAt: now
    };
    
    await setDoc(doc(db, 'users', uid), userWithTimestamps);
    const newUser = convertTimestamps({ id: uid, ...userWithTimestamps }) as User;
    return { success: true, data: newUser };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: 'Error al crear usuario' };
  }
};

// PRODUCT MANAGEMENT
export const getProducts = async (): Promise<FirestoreResponse<Product[]>> => {
  try {
    const productsQuery = query(collection(db, 'products'), orderBy('name'));
    const querySnapshot = await getDocs(productsQuery);
    const products = querySnapshot.docs.map(doc => 
      convertTimestamps({ id: doc.id, ...doc.data() }) as Product
    );
    return { success: true, data: products };
  } catch (error) {
    console.error('Error getting products:', error);
    return { success: false, error: 'Error al obtener productos' };
  }
};

export const addProduct = async (productData: CreateData<Product>): Promise<FirestoreResponse<Product>> => {
  try {
    const now = Timestamp.now();
    const productWithTimestamps = {
      ...productData,
      createdAt: now,
      updatedAt: now
    };
    
    const docRef = await addDoc(collection(db, 'products'), productWithTimestamps);
    const newProduct = convertTimestamps({ id: docRef.id, ...productWithTimestamps }) as Product;
    return { success: true, data: newProduct };
  } catch (error) {
    console.error('Error adding product:', error);
    return { success: false, error: 'Error al agregar producto' };
  }
};

export const updateProduct = async (productId: string, updates: UpdateData<Product>): Promise<FirestoreResponse<Product>> => {
  try {
    const updateData = {
      ...updates,
      updatedAt: Timestamp.now()
    };
    
    await updateDoc(doc(db, 'products', productId), updateData);
    const updatedDoc = await getDoc(doc(db, 'products', productId));
    const updatedProduct = convertTimestamps({ id: updatedDoc.id, ...updatedDoc.data() }) as Product;
    return { success: true, data: updatedProduct };
  } catch (error) {
    console.error('Error updating product:', error);
    return { success: false, error: 'Error al actualizar producto' };
  }
};

export const deleteProduct = async (productId: string): Promise<FirestoreResponse<void>> => {
  try {
    await deleteDoc(doc(db, 'products', productId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: 'Error al eliminar producto' };
  }
};

// TABLE MANAGEMENT
export const getTables = async (): Promise<FirestoreResponse<Table[]>> => {
  try {
    const tablesQuery = query(collection(db, 'tables'), orderBy('number'));
    const querySnapshot = await getDocs(tablesQuery);
    const tables = querySnapshot.docs.map(doc => 
      convertTimestamps({ id: doc.id, ...doc.data() }) as Table
    );
    return { success: true, data: tables };
  } catch (error) {
    console.error('Error getting tables:', error);
    return { success: false, error: 'Error al obtener mesas' };
  }
};

export const getTablesRealtime = (callback: (tables: Table[]) => void) => {
  const tablesQuery = query(collection(db, 'tables'), orderBy('number'));
  
  return onSnapshot(tablesQuery, (snapshot) => {
    const tables = snapshot.docs.map(doc => 
      convertTimestamps({ id: doc.id, ...doc.data() }) as Table
    );
    callback(tables);
  }, (error) => {
    console.error('Error in tables realtime listener:', error);
  });
};

export const openTable = async (tableId: string, waiterId: string, waiterName: string): Promise<FirestoreResponse<Order>> => {
  try {
    const batch = writeBatch(db);
    
    // Update table status
    const tableRef = doc(db, 'tables', tableId);
    batch.update(tableRef, {
      status: 'ocupada',
      waiterId,
      waiterName,
      updatedAt: Timestamp.now()
    });
    
    // Create new order
    const orderRef = doc(collection(db, 'orders'));
    const tableDoc = await getDoc(tableRef);
    const tableData = tableDoc.data() as Table;
    
    const orderData = {
      tableId,
      tableNumber: tableData.number,
      waiterId,
      waiterName,
      items: [],
      status: 'activo' as const,
      subtotal: 0,
      total: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    batch.set(orderRef, orderData);
    
    // Update table with current order ID
    batch.update(tableRef, { currentOrderId: orderRef.id });
    
    await batch.commit();
    
    const newOrder = convertTimestamps({ id: orderRef.id, ...orderData }) as Order;
    return { success: true, data: newOrder };
  } catch (error) {
    console.error('Error opening table:', error);
    return { success: false, error: 'Error al abrir mesa' };
  }
};

// CONFIG MANAGEMENT
export const getConfig = async (docId = 'general'): Promise<FirestoreResponse<any>> => {
  try {
    const ref = doc(db, 'config', docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: true, data: null };
    return { success: true, data: convertTimestamps({ id: snap.id, ...snap.data() }) };
  } catch (error) {
    console.error('Error getting config:', error);
    return { success: false, error: 'Error al obtener configuración' };
  }
};

export const saveConfig = async (payload: any, docId = 'general'): Promise<FirestoreResponse<any>> => {
  try {
    const now = Timestamp.now();
    const ref = doc(db, 'config', docId);
    const toSave = {
      ...payload,
      updatedAt: now,
      ...(payload.createdAt ? {} : { createdAt: now })
    };
    await setDoc(ref, toSave, { merge: true });
    const snap = await getDoc(ref);
    return { success: true, data: convertTimestamps({ id: snap.id, ...snap.data() }) };
  } catch (error) {
    console.error('Error saving config:', error);
    return { success: false, error: 'Error al guardar configuración' };
  }
};

// ========================================
// TERMINAL CONFIGURATION MANAGEMENT
// ========================================

/**
 * Obtiene la configuración de terminales habilitadas/deshabilitadas
 * Retorna un objeto con los IDs de terminal como keys y el estado enabled como valor
 */
export const getTerminalsConfig = async (): Promise<FirestoreResponse<Record<string, boolean>>> => {
  try {
    const ref = doc(db, 'config', 'terminals');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { success: true, data: {} };
    }
    const data = snap.data();
    return { success: true, data: data.enabled || {} };
  } catch (error) {
    console.error('Error getting terminals config:', error);
    return { success: false, error: 'Error al obtener configuración de terminales' };
  }
};

/**
 * Obtiene los nombres personalizados de terminales
 * Retorna un objeto con los IDs de terminal como keys y el nombre personalizado como valor
 */
export const getTerminalsNames = async (): Promise<FirestoreResponse<Record<string, string>>> => {
  try {
    const ref = doc(db, 'config', 'terminals');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { success: true, data: {} };
    }
    const data = snap.data();
    return { success: true, data: data.names || {} };
  } catch (error) {
    console.error('Error getting terminals names:', error);
    return { success: false, error: 'Error al obtener nombres de terminales' };
  }
};

/**
 * Guarda el nombre personalizado de una terminal
 */
export const setTerminalName = async (terminalId: string, name: string): Promise<FirestoreResponse<any>> => {
  try {
    const ref = doc(db, 'config', 'terminals');
    const now = Timestamp.now();
    
    await setDoc(ref, {
      names: {
        [terminalId]: name
      },
      updatedAt: now
    }, { merge: true });

    return { success: true, data: { terminalId, name } };
  } catch (error) {
    console.error('Error setting terminal name:', error);
    return { success: false, error: 'Error al actualizar nombre de terminal' };
  }
};

/**
 * Guarda el estado habilitado/deshabilitado de una terminal
 */
export const setTerminalEnabled = async (terminalId: string, enabled: boolean): Promise<FirestoreResponse<any>> => {
  try {
    const ref = doc(db, 'config', 'terminals');
    const now = Timestamp.now();
    
    await setDoc(ref, {
      enabled: {
        [terminalId]: enabled
      },
      updatedAt: now
    }, { merge: true });

    return { success: true, data: { terminalId, enabled } };
  } catch (error) {
    console.error('Error setting terminal enabled:', error);
    return { success: false, error: 'Error al actualizar estado de terminal' };
  }
};

/**
 * Actualiza múltiples terminales a la vez
 */
export const setMultipleTerminalsEnabled = async (terminals: Record<string, boolean>): Promise<FirestoreResponse<any>> => {
  try {
    const ref = doc(db, 'config', 'terminals');
    const now = Timestamp.now();
    
    await setDoc(ref, {
      enabled: terminals,
      updatedAt: now
    }, { merge: true });

    return { success: true, data: terminals };
  } catch (error) {
    console.error('Error setting multiple terminals:', error);
    return { success: false, error: 'Error al actualizar terminales' };
  }
};

// Placeholder: disabling/enabling users requires Firebase Admin SDK (server-side).
// Provide a thin client-side helper that will call a cloud function or other admin endpoint
// once one is available. For now it returns an explanatory response so the UI can show a toast.
export async function requestDisableUser(email: string, disable = true) {
  try {
    // Find user document by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const snap = await getDocs(q);
    if (snap.empty) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    const userDoc = snap.docs[0];
    const userId = userDoc.id;
    const newActive = !disable; // disable=true => active=false

    await updateDoc(doc(db, 'users', userId), { active: newActive, updatedAt: Timestamp.now() });

    const updated = await getDoc(doc(db, 'users', userId));
    return { success: true, data: convertTimestamps({ id: updated.id, ...updated.data() }) };
  } catch (err: any) {
    console.error('Error toggling user active flag', err);
    return { success: false, error: err?.message || 'Error al actualizar usuario' };
  }
}

// Fetch all users from the 'users' collection (client-side view). This reads
// the documents that represent users in Firestore. Note: some user fields
// (like 'disabled') are only available if you store them in Firestore as well.
export async function getUsers() {
  try {
    const q = query(collection(db, 'users'));
    const snap = await getDocs(q);
    const items: any[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...convertTimestamps(d.data()) }));
    return { success: true, data: items };
  } catch (err: any) {
    console.error('Error fetching users', err);
    return { success: false, error: err?.message };
  }
}

// Create a user document with auto-generated ID in Firestore.
// Note: this does NOT create a Firebase Auth account. Use this for storing
// a user profile document; creating the actual Auth account must be done
// via admin SDK / invitation flow.
export async function addUserClient(userData: Partial<User>) {
  try {
    const now = Timestamp.now();
    const toSave = {
      ...userData,
      active: userData.active ?? true,
      createdAt: now,
      updatedAt: now
    } as any;
    const ref = await addDoc(collection(db, 'users'), toSave);
    const snap = await getDoc(ref);
    return { success: true, data: convertTimestamps({ id: snap.id, ...snap.data() }) };
  } catch (err: any) {
    console.error('Error adding user client-side', err);
    return { success: false, error: err?.message };
  }
}

export const closeTable = async (
  tableId: string,
  orderId: string,
  paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia',
  peopleCount?: number,
  paymentDetails?: { receivedAmount?: number; change?: number; tipAmount?: number; tipPercent?: number; cashierId?: string }
): Promise<FirestoreResponse<void>> => {
  try {
    const batch = writeBatch(db);
    
    // Get current order to calculate totals
    const orderDoc = await getDoc(doc(db, 'orders', orderId));
    if (!orderDoc.exists()) {
      return { success: false, error: 'Orden no encontrada' };
    }
    
    const orderData = orderDoc.data();
    const items = orderData.items || [];
    
    // Calculate subtotal from active items
    const subtotal = items
      .filter((item: any) => !item.isDeleted)
      .reduce((sum: number, item: any) => sum + (item.productPrice * item.quantity), 0);
    
    // Get tip amount (default to 0 if not provided)
    const tipAmount = paymentDetails?.tipAmount ?? 0;
    
    // Calculate total (subtotal + tip, NO TAX)
    const total = subtotal + tipAmount;
    
    // Update table status
    const tableRef = doc(db, 'tables', tableId);
    batch.update(tableRef, {
      status: 'libre',
      waiterId: null,
      waiterName: null,
      currentOrderId: null,
      updatedAt: Timestamp.now()
    });
    
    // Update order status with calculated totals
    const orderRef = doc(db, 'orders', orderId);
    const orderUpdate: any = {
      status: 'pagado',
      paymentMethod,
      subtotal,
      total,
      tax: null, // Explicitly set to null to remove any old tax values
      completedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    if (typeof peopleCount === 'number') {
      orderUpdate.peopleCount = peopleCount;
    }
    batch.update(orderRef, orderUpdate);

    // If payment details were provided, append a payment object to the order document's payments array
    if (paymentDetails) {
      const paymentObj: any = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        method: paymentMethod,
        receivedAmount: typeof paymentDetails.receivedAmount === 'number' ? paymentDetails.receivedAmount : null,
        change: typeof paymentDetails.change === 'number' ? paymentDetails.change : null,
        tipAmount: typeof paymentDetails.tipAmount === 'number' ? paymentDetails.tipAmount : 0,
        tipPercent: typeof paymentDetails.tipPercent === 'number' ? paymentDetails.tipPercent : 0,
        cashierId: paymentDetails.cashierId ?? null,
        createdAt: Timestamp.now()
      };
      // Use arrayUnion to add the payment object into the payments array on the order
      batch.update(orderRef, {
        payments: arrayUnion(paymentObj)
      });
    }
    
    await batch.commit();
    console.log('✅ Mesa cerrada correctamente:', {
      orderId,
      subtotal,
      tipAmount,
      total,
      paymentMethod
    });
    return { success: true };
  } catch (error) {
    console.error('Error closing table:', error);
    return { success: false, error: 'Error al cerrar mesa' };
  }
};

// ORDER MANAGEMENT
export const getOrdersByTable = async (tableId: string): Promise<FirestoreResponse<Order[]>> => {
  try {
    const ordersQuery = query(
      collection(db, 'orders'),
      where('tableId', '==', tableId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(ordersQuery);
    const orders = querySnapshot.docs.map(doc => 
      convertTimestamps({ id: doc.id, ...doc.data() }) as Order
    );
    return { success: true, data: orders };
  } catch (error) {
    console.error('Error getting orders:', error);
    return { success: false, error: 'Error al obtener pedidos' };
  }
};

export const getCurrentOrder = async (orderId: string): Promise<FirestoreResponse<Order>> => {
  try {
    const orderDoc = await getDoc(doc(db, 'orders', orderId));
    if (orderDoc.exists()) {
      const order = convertTimestamps({ id: orderDoc.id, ...orderDoc.data() }) as Order;
      return { success: true, data: order };
    }
    return { success: false, error: 'Pedido no encontrado' };
  } catch (error) {
    console.error('Error getting current order:', error);
    return { success: false, error: 'Error al obtener pedido actual' };
  }
};

export const addItemToOrder = async (orderId: string, product: Product, quantity: number, notes?: string): Promise<FirestoreResponse<Order>> => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      return { success: false, error: 'Pedido no encontrado' };
    }
    
    const orderData = orderDoc.data() as Order;
    const newItem: OrderItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId: product.id,
      productName: product.name,
      productPrice: product.price,
      quantity,
      status: 'pendiente',
      notes,
      category: product.category,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const updatedItems = [...orderData.items, newItem];
    const subtotal = updatedItems.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
    const total = subtotal;
    
    await updateDoc(orderRef, {
      items: updatedItems,
      subtotal,
      total,
      updatedAt: Timestamp.now()
    });
    
    const updatedOrderDoc = await getDoc(orderRef);
    const updatedOrder = convertTimestamps({ id: updatedOrderDoc.id, ...updatedOrderDoc.data() }) as Order;
    return { success: true, data: updatedOrder };
  } catch (error) {
    console.error('Error adding item to order:', error);
    return { success: false, error: 'Error al agregar item al pedido' };
  }
};

export const updateItemStatus = async (orderId: string, itemId: string, newStatus: OrderItem['status']): Promise<FirestoreResponse<Order>> => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      return { success: false, error: 'Pedido no encontrado' };
    }
    
    const orderData = orderDoc.data() as Order;
    const updatedItems = orderData.items.map(item => 
      item.id === itemId 
        ? { ...item, status: newStatus, updatedAt: new Date() }
        : item
    );
    
    await updateDoc(orderRef, {
      items: updatedItems,
      updatedAt: Timestamp.now()
    });
    
    const updatedOrderDoc = await getDoc(orderRef);
    const updatedOrder = convertTimestamps({ id: updatedOrderDoc.id, ...updatedOrderDoc.data() }) as Order;
    return { success: true, data: updatedOrder };
  } catch (error) {
    console.error('Error updating item status:', error);
    return { success: false, error: 'Error al actualizar estado del item' };
  }
};

// KITCHEN MANAGEMENT
export const getKitchenOrdersRealtime = (callback: (orders: Order[]) => void) => {
  const ordersQuery = query(
    collection(db, 'orders'),
    where('status', '==', 'activo'),
    orderBy('createdAt', 'asc')
  );
  
  return onSnapshot(ordersQuery, (snapshot) => {
    const orders = snapshot.docs
      .map(doc => convertTimestamps({ id: doc.id, ...doc.data() }) as Order)
      .filter(order => 
        order.items.some(item => 
          // include any item that is pending, ready or delivered (exclude only deleted items)
          ['pendiente', 'listo', 'entregado'].includes(item.status) && !item.isDeleted
        )
      );
    callback(orders);
  }, (error) => {
    console.error('Error in kitchen orders realtime listener:', error);
  });
};

export const updateOrderStatusInKanban = async (orderId: string, itemId: string, newStatus: OrderItem['status']): Promise<FirestoreResponse<void>> => {
  try {
    const result = await updateItemStatus(orderId, itemId, newStatus);
    return { success: result.success, error: result.error };
  } catch (error) {
    console.error('Error updating order status in kanban:', error);
    return { success: false, error: 'Error al actualizar estado en kanban' };
  }
};

// Update people count for an order (number of persons at the table)
export const updateOrderPeopleCount = async (orderId: string, peopleCount: number): Promise<FirestoreResponse<void>> => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      peopleCount,
      updatedAt: Timestamp.now()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating people count:', error);
    return { success: false, error: 'Error al actualizar cantidad de personas' };
  }
};

// Update order table name (custom name for the table)
export const updateOrderTableName = async (orderId: string, tableName: string): Promise<FirestoreResponse<void>> => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      tableName: tableName.trim() || null,
      updatedAt: Timestamp.now()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating table name:', error);
    return { success: false, error: 'Error al actualizar nombre de mesa' };
  }
};

// Update order admin comments (administrative notes, not visible on customer ticket)
export const updateOrderAdminComments = async (orderId: string, comments: string): Promise<FirestoreResponse<void>> => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, {
      adminComments: comments.trim() || null,
      updatedAt: Timestamp.now()
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating admin comments:', error);
    return { success: false, error: 'Error al actualizar comentarios' };
  }
};

// STATISTICS AND REPORTS
export const getDailyStats = async (date: Date): Promise<FirestoreResponse<any>> => {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const ordersQuery = query(
      collection(db, 'orders'),
      where('createdAt', '>=', Timestamp.fromDate(startOfDay)),
      where('createdAt', '<=', Timestamp.fromDate(endOfDay)),
      where('status', '==', 'pagado')
    );
    
    const querySnapshot = await getDocs(ordersQuery);
    const orders = querySnapshot.docs.map(doc => 
      convertTimestamps({ id: doc.id, ...doc.data() }) as Order
    );
    
    const totalSales = orders.reduce((sum, order) => {
      // Use explicit total if present, otherwise compute from items
      if (typeof order.total === 'number') return sum + order.total;
      const itemsSubtotal = (order.items || []).reduce((s, it) => s + ((it.productPrice || 0) * (it.quantity || 0)), 0);
      return sum + itemsSubtotal;
    }, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    return {
      success: true,
      data: {
        totalSales,
        totalOrders,
        averageOrderValue,
        orders
      }
    };
  } catch (error) {
    console.error('Error getting daily stats:', error);
    return { success: false, error: 'Error al obtener estadísticas diarias' };
  }
};

// ========================================
// MERCADO PAGO PAYMENTS
// ========================================

/**
 * Interfaz para los datos del usuario que hizo el pago
 */
export interface PaymentUserData {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

/**
 * Interfaz para el documento de pago completo en Firestore
 */
export interface PaymentDocument {
  // Datos de la orden de Mercado Pago (respuesta completa de la API)
  id: string;
  type: string;
  processing_mode: string;
  external_reference: string;
  description: string;
  expiration_time?: string;
  country_code: string;
  user_id: string;
  status: string;
  status_detail: string;
  currency: string;
  created_date: string;
  last_updated_date: string;
  integration_data?: any;
  transactions?: any;
  config?: any;
  
  // Datos del usuario que hizo el cobro
  userData: PaymentUserData;
  
  // Timestamps de Firestore
  savedAt: any; // Timestamp de cuando se guardó en Firestore
}

/**
 * Guarda un pago de Mercado Pago en Firestore
 * 
 * @param paymentResponse - Respuesta completa de la API de Mercado Pago
 * @param userData - Datos del usuario que realizó el cobro
 * @returns Promesa con el resultado de la operación
 */
export const savePayment = async (
  paymentResponse: any,
  userData: PaymentUserData
): Promise<FirestoreResponse<PaymentDocument>> => {
  try {
    // console.log('💾 [Firestore] Guardando pago en Firestore...');
    // console.log('💾 [Firestore] Payment ID:', paymentResponse.id);
    // console.log('💾 [Firestore] Usuario:', userData.displayName);
    
    const paymentDoc: PaymentDocument = {
      // Toda la respuesta de Mercado Pago
      ...paymentResponse,
      
      // Datos del usuario que hizo el cobro
      userData: {
        id: userData.id,
        displayName: userData.displayName,
        email: userData.email,
        role: userData.role
      },
      
      // Timestamp de guardado
      savedAt: Timestamp.now()
    };
    
    // Usar el ID de la orden de Mercado Pago como ID del documento
    const paymentRef = doc(db, 'payments', paymentResponse.id);
    
    await setDoc(paymentRef, paymentDoc);
    
    // console.log('✅ [Firestore] Pago guardado exitosamente');
    // console.log('✅ [Firestore] Document ID:', paymentResponse.id);
    
    return {
      success: true,
      data: paymentDoc
    };
  } catch (error: any) {
    console.error('❌ [Firestore] Error al guardar pago:', error);
    return {
      success: false,
      error: error.message || 'Error al guardar el pago'
    };
  }
};

/**
 * Obtiene un pago por su ID
 * 
 * @param paymentId - ID del pago (ID de la orden de Mercado Pago)
 * @returns Promesa con el documento del pago
 */
export const getPayment = async (
  paymentId: string
): Promise<FirestoreResponse<PaymentDocument>> => {
  try {
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnap = await getDoc(paymentRef);
    
    if (!paymentSnap.exists()) {
      return {
        success: false,
        error: 'Pago no encontrado'
      };
    }
    
    return {
      success: true,
      data: paymentSnap.data() as PaymentDocument
    };
  } catch (error: any) {
    console.error('❌ [Firestore] Error al obtener pago:', error);
    return {
      success: false,
      error: error.message || 'Error al obtener el pago'
    };
  }
};

/**
 * Obtiene todos los pagos de un usuario
 * 
 * @param userId - ID del usuario
 * @returns Promesa con la lista de pagos
 */
export const getPaymentsByUser = async (
  userId: string
): Promise<FirestoreResponse<PaymentDocument[]>> => {
  try {
    const paymentsRef = collection(db, 'payments');
    const q = query(
      paymentsRef,
      where('userData.id', '==', userId),
      orderBy('created_date', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const payments = querySnapshot.docs.map(doc => doc.data() as PaymentDocument);
    
    return {
      success: true,
      data: payments
    };
  } catch (error: any) {
    console.error('❌ [Firestore] Error al obtener pagos del usuario:', error);
    return {
      success: false,
      error: error.message || 'Error al obtener pagos del usuario'
    };
  }
};

/**
 * Obtiene todos los pagos de prueba (aquellos con orderId "setting")
 * 
 * @returns Promesa con la lista de pagos de prueba
 */
export const getTestPayments = async (): Promise<FirestoreResponse<PaymentDocument[]>> => {
  try {
    const paymentsRef = collection(db, 'payments');
    const querySnapshot = await getDocs(paymentsRef);
    
    // Filtrar pagos que tienen "setting" en el external_reference
    const testPayments = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as PaymentDocument & { id: string }))
      .filter(payment => 
        payment.external_reference && 
        payment.external_reference.toLowerCase().includes('setting')
      )
      .sort((a, b) => {
        // Ordenar por fecha de creación descendente
        const dateA = a.created_date || '';
        const dateB = b.created_date || '';
        return dateB.localeCompare(dateA);
      });
    
    return {
      success: true,
      data: testPayments
    };
  } catch (error: any) {
    console.error('❌ [Firestore] Error al obtener pagos de prueba:', error);
    return {
      success: false,
      error: error.message || 'Error al obtener pagos de prueba'
    };
  }
};
