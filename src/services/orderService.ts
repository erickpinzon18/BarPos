// src/services/orderService.ts
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs, addDoc, writeBatch, arrayUnion, runTransaction, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from './firebase';
import type { Order, OrderItem, User, OrderItemStatus, CreateData, Table } from '../utils/types';

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
      superAdmin: userData.superAdmin === true,
      active: userData.active,
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
  authorizedUser: User,
  cancelReason?: string
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
          deletedAt: new Date(),
          pendingCancelPrint: true,
          ...(cancelReason ? { cancelReason } : {}),
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

/** Tiempo máximo que el botón espera la confirmación del servidor antes de soltarse */
const ADD_ITEM_ACK_TIMEOUT_MS = 8000;

/**
 * Agrega un item a una orden existente.
 * Una sola escritura (arrayUnion): no lee la orden ni reescribe la lista completa, así que es
 * rápida con mala señal y dos personas pueden agregar a la misma cuenta sin pisarse.
 * Si el servidor tarda más de ADD_ITEM_ACK_TIMEOUT_MS, regresa igual (el producto ya se ve en
 * la cuenta y Firestore lo sigue enviando) y avisa si al final falla.
 */
export const addItemToOrder = async (
  orderId: string,
  productId: string,
  productName: string,
  productPrice: number,
  category: string,
  quantity: number,
  notes?: string,
  addedBy?: { id: string; name: string },
  /** Comisión por unidad ya conocida (producto cargado en pantalla); sin definir = se consulta */
  knownTipPerUnit?: number | null
): Promise<void> => {
  // Propina por unidad del producto (se copia al item para que no cambie si después se edita el catálogo)
  let tipPerUnit = knownTipPerUnit;
  if (tipPerUnit === undefined) {
    const productDoc = await getDoc(doc(db, 'products', productId));
    tipPerUnit = productDoc.exists() ? productDoc.data().tipPerUnit : undefined;
  }

  const newItem: OrderItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    productId,
    productName,
    productPrice,
    quantity,
    status: 'pendiente',
    category: category as OrderItem['category'],
    ...(notes ? { notes } : {}),
    ...(typeof tipPerUnit === 'number' ? { tipPerUnit } : {}),
    // Quién lo agregó: cualquier mesero puede atender cualquier mesa, así queda el registro
    ...(addedBy ? { addedBy: addedBy.id, addedByName: addedBy.name } : {}),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const write = updateDoc(doc(db, 'orders', orderId), {
    items: arrayUnion(newItem),
    updatedAt: Timestamp.now()
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<'slow'>((resolve) => { timer = setTimeout(() => resolve('slow'), ADD_ITEM_ACK_TIMEOUT_MS); });
  try {
    const result = await Promise.race([write.then(() => 'ok' as const), slow]);
    if (result === 'slow') {
      console.warn('⏳ Conexión lenta al agregar item; se sigue enviando en segundo plano', { orderId, productName });
      toast('Conexión lenta: el producto se está enviando. No cierres la app.', { icon: '📶', duration: 6000 });
      write.catch((error) => {
        console.error('❌ Error agregando item (en segundo plano):', error);
        toast.error(`No se pudo agregar ${productName}. Revisa la cuenta y vuelve a intentarlo.`, { duration: 10000 });
      });
    }
  } catch (error) {
    console.error('❌ Error agregando item:', error);
    throw error;
  } finally {
    clearTimeout(timer);
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
        const { printedAt: _omit, ...rest } = item;
        return {
          ...rest,
          productId: newProductId,
          productName: newProductName,
          swapFromName: item.productName,
          updatedAt: new Date(),
        };
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

export interface SplitItemReq {
  originalItemId: string;
  quantityToMove: number;
}

/**
 * Mueve items de una orden a una mesa nueva (creando una nueva orden)
 */
export const splitOrderItemsToNewTable = async (
  sourceOrderId: string,
  splitItems: SplitItemReq[],
  targetTableId: string,
  adminUser: User
): Promise<string> => {
  try {
    console.log('✂️ Separando cuenta a nueva mesa:', { sourceOrderId, targetTableId, splitItems });

    // 1. Obtener la orden de origen
    const sourceOrderRef = doc(db, 'orders', sourceOrderId);
    const sourceOrderDoc = await getDoc(sourceOrderRef);
    if (!sourceOrderDoc.exists()) throw new Error('Orden origen no encontrada');
    const sourceOrderData = sourceOrderDoc.data() as Order;

    // 2. Verificar la mesa destino
    const targetTableRef = doc(db, 'tables', targetTableId);
    const targetTableDoc = await getDoc(targetTableRef);
    if (!targetTableDoc.exists()) throw new Error('Mesa destino no encontrada');
    const targetTableData = targetTableDoc.data() as Table;

    if (targetTableData.status !== 'libre') {
      throw new Error('La mesa destino no está libre');
    }

    // 3. Crear items para la nueva orden y actualizar los de la origen
    const newOrderItems: OrderItem[] = [];
    const updatedSourceItems = sourceOrderData.items.map(item => {
      const splitReq = splitItems.find(req => req.originalItemId === item.id);
      if (!splitReq || splitReq.quantityToMove <= 0) return item;
      
      const qtyToMove = Math.min(splitReq.quantityToMove, item.quantity);
      
      // Crear el item para la nueva mesa
      newOrderItems.push({
        ...item,
        id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        quantity: qtyToMove,
        updatedAt: new Date()
      });

      // Actualizar item de la orden origen
      const remainingQty = item.quantity - qtyToMove;
      if (remainingQty <= 0) {
        return {
          ...item,
          isDeleted: true,
          deletedBy: adminUser.id,
          deletedByName: `Separado a mesa ${targetTableData.number} por ${adminUser.displayName || adminUser.email}`,
          deletedAt: new Date(),
          pendingCancelPrint: false
        };
      } else {
        return {
          ...item,
          quantity: remainingQty,
          updatedAt: new Date()
        };
      }
    });

    if (newOrderItems.length === 0) {
      throw new Error('No se seleccionaron items válidos para separar');
    }

    // 4. Actualizar orden origen
    await updateDoc(sourceOrderRef, {
      items: updatedSourceItems,
      updatedAt: Timestamp.now()
    });

    // 5. Crear la nueva orden
    const newOrderData: CreateData<Order> = {
      tableId: targetTableId,
      tableNumber: targetTableData.number,
      waiterId: sourceOrderData.waiterId,
      waiterName: sourceOrderData.waiterName,
      items: newOrderItems,
      status: 'activo'
    };

    const newOrderRef = await addDoc(collection(db, 'orders'), {
      ...newOrderData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // 6. Actualizar la nueva mesa
    await updateDoc(targetTableRef, {
      status: 'ocupada',
      currentOrderId: newOrderRef.id,
      waiterId: sourceOrderData.waiterId,
      waiterName: sourceOrderData.waiterName,
      updatedAt: Timestamp.now()
    });

    console.log('✅ Separación completada exitosamente a la orden:', newOrderRef.id);
    return newOrderRef.id;

  } catch (error) {
    console.error('❌ Error separando cuenta:', error);
    throw error;
  }
};

/**
 * Actualiza los servicios (mixers) de una botella y crea un ticket para barra
 */
export const updateBottleMixers = async (
  orderId: string,
  bottleItemId: string,
  newNotes: string,
  diffText: string,
  _tableNumber: number
) => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) throw new Error('Orden no encontrada');
    const orderData = orderSnap.data() as Order;
    
    // 1. Actualizar las notas de la botella original
    const updatedItems = orderData.items.map(item => {
      if (item.id === bottleItemId) {
        return {
          ...item,
          notes: newNotes,
          updatedAt: new Date()
        };
      }
      return item;
    });

    // 2. Crear un ítem de "Cambio de servicios" para que se imprima en barra
    const changeItem: OrderItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      productId: 'change_mixers',
      productName: '🔄 CAMBIO DE SERVICIOS',
      productPrice: 0,
      quantity: 1,
      category: 'Servicio',
      status: 'pendiente',
      notes: diffText,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDeleted: false,
    };

    updatedItems.push(changeItem);

    // Guardar cambios
    await updateDoc(orderRef, {
      items: updatedItems,
      updatedAt: Timestamp.now()
    });

  } catch (error) {
    console.error('Error al actualizar servicios:', error);
    throw error;
  }
};

/**
 * Mueve una orden activa completa (con todos sus items) a otra mesa que esté libre.
 * Libera la mesa origen y ocupa la mesa destino, conservando el mesero asignado
 * salvo que se reasigne explícitamente con `reassignOrderWaiter`.
 */
export const moveOrderToTable = async (
  orderId: string,
  targetTableId: string
): Promise<void> => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    if (!orderDoc.exists()) throw new Error('Orden no encontrada');
    const orderData = orderDoc.data() as Order;

    if (orderData.tableId === targetTableId) {
      throw new Error('La orden ya está en esa mesa');
    }

    const targetTableRef = doc(db, 'tables', targetTableId);
    const targetTableDoc = await getDoc(targetTableRef);
    if (!targetTableDoc.exists()) throw new Error('Mesa destino no encontrada');
    const targetTableData = targetTableDoc.data() as Table;

    if (targetTableData.status !== 'libre') {
      throw new Error('La mesa destino no está libre');
    }

    const sourceTableRef = doc(db, 'tables', orderData.tableId);

    const batch = writeBatch(db);

    batch.update(orderRef, {
      tableId: targetTableId,
      tableNumber: targetTableData.number,
      updatedAt: Timestamp.now()
    });

    batch.update(sourceTableRef, {
      status: 'libre',
      currentOrderId: null,
      waiterId: null,
      waiterName: null,
      updatedAt: Timestamp.now()
    });

    batch.update(targetTableRef, {
      status: 'ocupada',
      currentOrderId: orderId,
      waiterId: orderData.waiterId,
      waiterName: orderData.waiterName,
      updatedAt: Timestamp.now()
    });

    await batch.commit();
    console.log('✅ Orden movida a nueva mesa:', { orderId, targetTableId });
  } catch (error) {
    console.error('❌ Error moviendo orden a otra mesa:', error);
    throw error;
  }
};

/**
 * Reasigna el mesero responsable de una orden activa, actualizando tanto la orden
 * como la mesa vinculada (para que aparezca correctamente en los paneles de mesero).
 */
export const reassignOrderWaiter = async (
  orderId: string,
  waiterId: string,
  waiterName: string
): Promise<void> => {
  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderDoc = await getDoc(orderRef);
    if (!orderDoc.exists()) throw new Error('Orden no encontrada');
    const orderData = orderDoc.data() as Order;

    const batch = writeBatch(db);

    batch.update(orderRef, {
      waiterId,
      waiterName,
      updatedAt: Timestamp.now()
    });

    if (orderData.tableId) {
      const tableRef = doc(db, 'tables', orderData.tableId);
      batch.update(tableRef, {
        waiterId,
        waiterName,
        updatedAt: Timestamp.now()
      });
    }

    await batch.commit();
    console.log('✅ Mesero reasignado:', { orderId, waiterId, waiterName });
  } catch (error) {
    console.error('❌ Error reasignando mesero:', error);
    throw error;
  }
};

export interface TransferItemReq {
  itemId: string;
  quantity: number;
}

/** Destino de un traspaso: la orden activa de una mesa ocupada, o una mesa libre (se abre una orden nueva) */
export type TransferTarget =
  | { kind: 'order'; orderId: string }
  | { kind: 'table'; tableId: string };

/**
 * Mueve items (completos o parte de su cantidad) de una orden activa a otra mesa.
 * Todo va en una transacción: si alguien agrega algo a cualquiera de las dos cuentas al mismo
 * tiempo, Firestore reintenta con los datos frescos y nadie se pisa.
 * Los items movidos conservan estado, impresión y quién los agregó, así que no se reimprimen
 * en barra/cocina ni aparecen como cancelados; el origen simplemente deja de tenerlos.
 * Cada traspaso se registra después en la colección `itemTransfers`.
 */
export const transferOrderItems = async (
  sourceOrderId: string,
  moves: TransferItemReq[],
  target: TransferTarget,
  movedBy: User
): Promise<string> => {
  const movedByName = movedBy.displayName || movedBy.email;
  const wanted = new Map(moves.filter(m => m.quantity > 0).map(m => [m.itemId, m.quantity]));
  if (wanted.size === 0) throw new Error('Selecciona al menos un producto para mover');

  const { targetOrderId, log } = await runTransaction(db, async (tx) => {
    const sourceRef = doc(db, 'orders', sourceOrderId);
    const sourceSnap = await tx.get(sourceRef);
    if (!sourceSnap.exists()) throw new Error('La cuenta de origen ya no existe');
    const source = sourceSnap.data() as Order;
    if (source.status !== 'activo') throw new Error('La cuenta de origen ya se cerró');

    // Destino: orden existente o mesa libre
    let targetRef;
    let targetItems: OrderItem[] = [];
    let targetTableNumber: number | string;
    let targetTableId: string;
    let newTableRef = null;

    if (target.kind === 'order') {
      if (target.orderId === sourceOrderId) throw new Error('El origen y el destino son la misma cuenta');
      targetRef = doc(db, 'orders', target.orderId);
      const targetSnap = await tx.get(targetRef);
      if (!targetSnap.exists()) throw new Error('La cuenta destino ya no existe');
      const targetOrder = targetSnap.data() as Order;
      if (targetOrder.status !== 'activo') throw new Error('La cuenta destino ya se cerró');
      targetItems = targetOrder.items || [];
      targetTableNumber = targetOrder.tableNumber;
      targetTableId = targetOrder.tableId;
    } else {
      if (target.tableId === source.tableId) throw new Error('El origen y el destino son la misma mesa');
      newTableRef = doc(db, 'tables', target.tableId);
      const tableSnap = await tx.get(newTableRef);
      if (!tableSnap.exists()) throw new Error('La mesa destino no existe');
      const table = tableSnap.data() as Table;
      // Revisa que no tenga una cuenta activa (la mesa puede decir 'ocupada' por error sin orden)
      const activeQ = query(
        collection(db, 'orders'),
        where('tableId', '==', target.tableId),
        where('status', '==', 'activo'),
        limit(1)
      );
      const activeSnap = await getDocs(activeQ);
      if (!activeSnap.empty) throw new Error('La mesa destino ya tiene una cuenta abierta; elígela como mesa ocupada');
      targetRef = doc(collection(db, 'orders'));
      targetTableNumber = table.number;
      targetTableId = target.tableId;
    }

    const sourceLabel = String(source.tableNumber);
    const now = Timestamp.now();
    const movedItems: OrderItem[] = [];
    const summary: { productName: string; quantity: number; price: number }[] = [];

    const remainingSource: OrderItem[] = [];
    for (const item of source.items || []) {
      const qty = wanted.get(item.id);
      if (!qty || item.isDeleted) {
        remainingSource.push(item);
        continue;
      }
      const toMove = Math.min(qty, item.quantity);
      const whole = toMove === item.quantity;
      movedItems.push({
        ...item,
        // Si se mueve completo conserva su id; si se parte, la parte movida lleva id nuevo
        id: whole ? item.id : `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        quantity: toMove,
        movedFromTable: sourceLabel,
        movedByName,
        movedAt: now as unknown as Date,
        updatedAt: now as unknown as Date,
      });
      summary.push({ productName: item.productName, quantity: toMove, price: item.productPrice });
      if (!whole) {
        remainingSource.push({ ...item, quantity: item.quantity - toMove, updatedAt: now as unknown as Date });
      }
    }

    if (movedItems.length === 0) throw new Error('Los productos seleccionados ya no están en la cuenta');

    tx.update(sourceRef, { items: remainingSource, updatedAt: now });

    if (target.kind === 'order') {
      tx.update(targetRef, { items: [...targetItems, ...movedItems], updatedAt: now });
    } else {
      tx.set(targetRef, {
        tableId: targetTableId,
        tableNumber: targetTableNumber,
        waiterId: source.waiterId,
        waiterName: source.waiterName,
        items: movedItems,
        status: 'activo',
        createdAt: now,
        updatedAt: now,
      });
      tx.update(newTableRef!, {
        status: 'ocupada',
        currentOrderId: targetRef.id,
        waiterId: source.waiterId,
        waiterName: source.waiterName,
        updatedAt: now,
      });
    }

    const log = {
      sourceOrderId,
      sourceTableId: source.tableId,
      sourceTableNumber: source.tableNumber,
      targetOrderId: targetRef.id,
      targetTableId,
      targetTableNumber,
      newOrder: target.kind === 'table',
      items: summary,
      movedBy: movedBy.id,
      movedByName,
      createdAt: now,
    };

    return { targetOrderId: targetRef.id, log };
  });

  // Bitácora aparte: si falla no debe deshacer el traspaso
  addDoc(collection(db, 'itemTransfers'), log).catch(err =>
    console.warn('⚠️ No se pudo registrar el traspaso en itemTransfers:', err)
  );

  return targetOrderId;
};
