// src/services/orderService.ts
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Order, OrderItem, User, OrderItemStatus, CreateData } from '../utils/types';

/**
 * Verifica el PIN de un usuario
 */
export const verifyUserPin = async (pin: string): Promise<User> => {
  try {
    console.log('🔍 Verificando PIN:', pin);
    
    // Buscar usuario por PIN
    const usersQuery = query(
      collection(db, 'users'),
      where('pin', '==', pin)
    );
    
    const querySnapshot = await getDocs(usersQuery);
    
    console.log('📊 Resultados de búsqueda:', {
      empty: querySnapshot.empty,
      size: querySnapshot.size
    });
    
    if (querySnapshot.empty) {
      throw new Error('PIN incorrecto');
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('👤 Usuario encontrado:', {
      id: userDoc.id,
      email: userData.email,
      role: userData.role,
      hasPin: !!userData.pin,
      createdAtType: typeof userData.createdAt,
      createdAtValue: userData.createdAt
    });
    
    return {
      id: userDoc.id,
      email: userData.email,
      displayName: userData.displayName,
      role: userData.role,
      pin: userData.pin,
      createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date(userData.createdAt || Date.now()),
      updatedAt: userData.updatedAt?.toDate ? userData.updatedAt.toDate() : new Date(userData.updatedAt || Date.now())
    };
  } catch (error) {
    console.error('❌ Error verificando PIN:', error);
    throw error;
  }
};

/**
 * Elimina un item de una orden (lo marca como eliminado)
 */
export const deleteOrderItem = async (
  orderId: string,
  itemId: string,
  authorizedUser: User
): Promise<void> => {
  try {
    console.log('🗑️ Eliminando item:', { orderId, itemId, authorizedBy: authorizedUser.displayName });

    // Obtener la orden actual
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Orden no encontrada');
    }

    const orderData = orderDoc.data() as Order;
    
    // Buscar y marcar el item como eliminado
    const updatedItems = orderData.items.map((item: OrderItem) => {
      if (item.id === itemId) {
        return {
          ...item,
          isDeleted: true,
          deletedBy: authorizedUser.id,
          deletedByName: authorizedUser.displayName || authorizedUser.email,
          deletedAt: new Date()
        };
      }
      return item;
    });

    // Actualizar solo los items en Firestore (totales se calculan dinámicamente)
    await updateDoc(orderRef, {
      items: updatedItems,
      updatedAt: Timestamp.now()
    });

    console.log('✅ Item eliminado exitosamente');
  } catch (error) {
    console.error('❌ Error eliminando item:', error);
    throw error;
  }
};

/**
 * Agrega un item a una orden existente
 */
export const addItemToOrder = async (
  orderId: string,
  productId: string,
  productName: string,
  productPrice: number,
  category: string,
  quantity: number,
  notes?: string
): Promise<void> => {
  try {
    console.log('➕ Agregando item a orden:', { orderId, productId, productName, quantity });

    // Obtener la orden actual
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);

    if (!orderDoc.exists()) {
      throw new Error('Orden no encontrada');
    }

    const orderData = orderDoc.data() as Order;

    // Crear nuevo item
    const newItem: OrderItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId: productId,
      productName: productName,
      productPrice: productPrice,
      quantity: quantity,
      status: 'pendiente',
      category: category as any,
      ...(notes ? { notes } : {}),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Agregar el nuevo item a la lista
    const updatedItems = [...orderData.items, newItem];

    // Actualizar la orden en Firestore
    await updateDoc(orderRef, {
      items: updatedItems,
      updatedAt: Timestamp.now()
    });

    console.log('✅ Item agregado exitosamente');
  } catch (error) {
    console.error('❌ Error agregando item:', error);
    throw error;
  }
};

/**
 * Actualiza el estado de un item específico
 */
export const updateItemStatus = async (
  orderId: string,
  itemId: string,
  newStatus: OrderItemStatus
): Promise<void> => {
  try {
    console.log('🔄 Actualizando estado de item:', { orderId, itemId, newStatus });

    // Obtener la orden actual
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Orden no encontrada');
    }

    const orderData = orderDoc.data() as Order;
    
    // Actualizar el estado del item específico
    const updatedItems = orderData.items.map((item: OrderItem) => {
      if (item.id === itemId) {
        return {
          ...item,
          status: newStatus,
          updatedAt: new Date()
        };
      }
      return item;
    });

    // Actualizar la orden en Firestore
    await updateDoc(orderRef, {
      items: updatedItems,
      updatedAt: Timestamp.now()
    });

    console.log('✅ Estado de item actualizado exitosamente');
  } catch (error) {
    console.error('❌ Error actualizando estado de item:', error);
    throw error;
  }
};

/**
 * Crea una orden vacía para una mesa
 */
export const createEmptyOrder = async (
  tableId: string,
  tableNumber: number | string,
  waiterId: string,
  waiterName: string
): Promise<string> => {
  try {
    console.log('📝 Creando orden vacía para mesa', tableNumber, 'asignada a:', waiterName, `(ID: ${waiterId})`);

    // Crear orden vacía
    const orderData: CreateData<Order> = {
      tableId: tableId,
      tableNumber: tableNumber,
      waiterId: waiterId,
      waiterName: waiterName,
      items: [], // Sin items iniciales
      status: 'activo'
    };

    // Guardar en Firestore
    const orderRef = await addDoc(collection(db, 'orders'), {
      ...orderData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log('✅ Orden vacía creada con ID:', orderRef.id);

    // Actualizar la mesa para marcarla como ocupada
    await updateDoc(doc(db, 'tables', tableId), {
      status: 'ocupada',
      currentOrderId: orderRef.id,
      waiterId: waiterId,
      waiterName: waiterName,
      updatedAt: Timestamp.now()
    });

    console.log('✅ Mesa actualizada a ocupada');

    return orderRef.id;

  } catch (error) {
    console.error('❌ Error creando orden vacía:', error);
    throw error;
  }
};

/**
 * Cambia el producto de un item de tipo Servicio por otro Servicio
 */
export const swapOrderItem = async (
  orderId: string,
  itemId: string,
  newProductId: string,
  newProductName: string
): Promise<void> => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    if (!orderDoc.exists()) throw new Error('Orden no encontrada');

    const orderData = orderDoc.data() as Order;
    const updatedItems = orderData.items.map((item: OrderItem) => {
      if (item.id === itemId) {
        return { ...item, productId: newProductId, productName: newProductName, updatedAt: new Date() };
      }
      return item;
    });

    await updateDoc(orderRef, { items: updatedItems, updatedAt: Timestamp.now() });
  } catch (error) {
    console.error('❌ Error cambiando servicio:', error);
    throw error;
  }
};

/**
 * Restaura un item eliminado
 */
export const restoreOrderItem = async (
  orderId: string,
  itemId: string,
  authorizedUser: User
): Promise<void> => {
  try {
    console.log('🔄 Restaurando item:', { orderId, itemId, authorizedBy: authorizedUser.displayName });

    // Obtener la orden actual
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    
    if (!orderDoc.exists()) {
      throw new Error('Orden no encontrada');
    }

    const orderData = orderDoc.data() as Order;
    
    // Buscar y restaurar el item
    const updatedItems = orderData.items.map((item: OrderItem) => {
      if (item.id === itemId) {
        const { isDeleted, deletedBy, deletedByName, deletedAt, ...restoredItem } = item;
        return restoredItem;
      }
      return item;
    });

    // Actualizar solo los items en Firestore (totales se calculan dinámicamente)
    await updateDoc(orderRef, {
      items: updatedItems,
      updatedAt: Timestamp.now()
    });

    console.log('✅ Item restaurado exitosamente');
  } catch (error) {
    console.error('❌ Error restaurando item:', error);
    throw error;
  }
};
