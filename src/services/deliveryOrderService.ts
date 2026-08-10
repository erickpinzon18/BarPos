// src/services/deliveryOrderService.ts
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { DeliveryOrder, DeliveryOrderFormData, OrderItem, CardType } from '../utils/types';
import { getNextFolio, checkOperationNumberUnique } from './firestoreService';

// Misma comisión que se traslada al cliente cuando paga con tarjeta en Checkout.
const CARD_COMMISSION_RATE = 0.04;

/** Crea un pedido a domicilio vacío (sin items) y lo deja en estado "activo". */
export const createDeliveryOrder = async (
  data: DeliveryOrderFormData,
  waiterId: string,
  waiterName: string
): Promise<string> => {
  const ref = await addDoc(collection(db, 'deliveryOrders'), {
    ...data,
    waiterId,
    waiterName,
    items: [],
    status: 'activo',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
};

/** Agrega un producto al pedido a domicilio (mismo patrón que addItemToOrder). */
export const addItemToDeliveryOrder = async (
  orderId: string,
  productId: string,
  productName: string,
  productPrice: number,
  category: string,
  quantity: number,
  notes?: string
): Promise<void> => {
  const orderRef = doc(db, 'deliveryOrders', orderId);
  const orderDoc = await getDoc(orderRef);
  if (!orderDoc.exists()) throw new Error('Pedido no encontrado');

  const orderData = orderDoc.data() as DeliveryOrder;

  const newItem: OrderItem = {
    id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    productId,
    productName,
    productPrice,
    quantity,
    status: 'pendiente',
    category: category as any,
    ...(notes ? { notes } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await updateDoc(orderRef, {
    items: [...(orderData.items || []), newItem],
    updatedAt: Timestamp.now(),
  });
};

/** Quita un item del pedido (sin soft-delete: aún no se envió a cocina). */
export const deleteDeliveryOrderItemSimple = async (
  orderId: string,
  itemId: string
): Promise<void> => {
  const orderRef = doc(db, 'deliveryOrders', orderId);
  const orderDoc = await getDoc(orderRef);
  if (!orderDoc.exists()) throw new Error('Pedido no encontrado');

  const orderData = orderDoc.data() as DeliveryOrder;
  const updatedItems = (orderData.items || []).filter((i) => i.id !== itemId);

  await updateDoc(orderRef, {
    items: updatedItems,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Cierra el pedido y lo "envía a cocina": asigna folio, calcula subtotal/total
 * y marca status "cerrado". No cobra nada todavía (se cobra al entregar).
 * Devuelve el doc actualizado para poder imprimir el ticket inmediatamente.
 */
export const closeDeliveryOrder = async (orderId: string): Promise<DeliveryOrder> => {
  const orderRef = doc(db, 'deliveryOrders', orderId);
  const orderDoc = await getDoc(orderRef);
  if (!orderDoc.exists()) throw new Error('Pedido no encontrado');

  const orderData = orderDoc.data() as DeliveryOrder;
  const activeItems = (orderData.items || []).filter((i) => !i.isDeleted);
  if (activeItems.length === 0) throw new Error('Agrega al menos un producto antes de enviar a cocina');

  const subtotal = activeItems.reduce((s, i) => s + i.productPrice * i.quantity, 0);

  let folio: string | undefined;
  let folioSeq: number | undefined;
  try {
    const next = await getNextFolio();
    folio = next.folio;
    folioSeq = next.seq;
  } catch (err) {
    console.error('No se pudo asignar folio al pedido a domicilio:', err);
  }

  const update: any = {
    status: 'cerrado',
    subtotal,
    total: subtotal,
    closedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  if (folio !== undefined) {
    update.folio = folio;
    update.folioSeq = folioSeq;
  }

  await updateDoc(orderRef, update);

  return {
    ...orderData,
    id: orderId,
    status: 'cerrado',
    subtotal,
    total: subtotal,
    folio,
    folioSeq,
    closedAt: new Date(),
  };
};

/** Borra el pedido si nunca se le agregaron items (equivalente a cancelEmptyOrder). */
export const cancelDeliveryOrder = async (orderId: string): Promise<void> => {
  const orderRef = doc(db, 'deliveryOrders', orderId);
  const orderDoc = await getDoc(orderRef);
  if (!orderDoc.exists()) return;
  const orderData = orderDoc.data() as DeliveryOrder;
  if ((orderData.items || []).length > 0) {
    throw new Error('No se puede cancelar un pedido con productos ya agregados');
  }
  await deleteDoc(orderRef);
};

export interface DeliverPaymentDetails {
  receivedAmount?: number; // Solo efectivo
  change?: number; // Solo efectivo
  cardOperationNumber?: string; // Solo tarjeta
  cardType?: CardType; // Solo tarjeta
  cardDetail?: string; // Solo tarjeta
  cashierId?: string;
  cashierName?: string;
}

/**
 * Marca el pedido como entregado y cobrado. Calcula el total final (con 4% de
 * comisión si es tarjeta), guarda el pago en el pedido, y además crea un
 * registro espejo en la colección `orders` (status "pagado") para que el
 * pedido entre automáticamente al Cierre de Caja / Tickets / reportes, igual
 * que una mesa — sin tener que duplicar la lógica de esos módulos.
 */
export const deliverDeliveryOrder = async (
  orderId: string,
  paymentMethod: 'efectivo' | 'tarjeta' | 'transferencia',
  paymentDetails: DeliverPaymentDetails
): Promise<void> => {
  const orderRef = doc(db, 'deliveryOrders', orderId);
  const orderDoc = await getDoc(orderRef);
  if (!orderDoc.exists()) throw new Error('Pedido no encontrado');

  const orderData = orderDoc.data() as DeliveryOrder;
  if (orderData.status !== 'cerrado') {
    throw new Error('El pedido debe estar cerrado (enviado a cocina) antes de cobrarse');
  }

  const activeItems = (orderData.items || []).filter((i) => !i.isDeleted);
  const subtotal = activeItems.reduce((s, i) => s + i.productPrice * i.quantity, 0);

  if (paymentMethod === 'tarjeta') {
    const op = (paymentDetails.cardOperationNumber || '').trim();
    if (!op) throw new Error('Debes ingresar el número de operación (Verifone) de la tarjeta');
    const isUnique = await checkOperationNumberUnique(op);
    if (!isUnique) throw new Error(`El número de operación "${op}" ya fue utilizado en otra cuenta`);
  }

  const cardCommission = paymentMethod === 'tarjeta' ? subtotal * CARD_COMMISSION_RATE : 0;
  const total = subtotal + cardCommission;

  const payment: any = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    method: paymentMethod,
    amount: total,
    receivedAmount: paymentDetails.receivedAmount ?? null,
    change: paymentDetails.change ?? null,
    cardOperationNumber: paymentDetails.cardOperationNumber?.trim() || null,
    cardType: paymentDetails.cardType ?? null,
    cardDetail: paymentDetails.cardDetail?.trim() || null,
    tipAmount: 0,
    tipPercent: 0,
    cashierId: paymentDetails.cashierId ?? null,
    cashierName: paymentDetails.cashierName ?? null,
    closedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  };

  const batch = writeBatch(db);

  batch.update(orderRef, {
    status: 'entregado',
    subtotal,
    total,
    cardCommission: cardCommission > 0 ? cardCommission : null,
    paymentMethod,
    payments: [payment],
    deliveredAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // Registro espejo en `orders` para que el pedido entre al corte de caja,
  // Tickets y reportes tal como lo haría una mesa cerrada.
  const mirrorOrderRef = doc(collection(db, 'orders'));
  const mirrorOrder: any = {
    tableId: 'domicilio',
    tableNumber: -1,
    tableName: `🛵 ${orderData.customerName}`,
    waiterId: orderData.waiterId,
    waiterName: orderData.waiterName,
    items: activeItems,
    status: 'pagado',
    paymentMethod,
    subtotal,
    total,
    cardCommission: cardCommission > 0 ? cardCommission : null,
    payments: [payment],
    folio: orderData.folio ?? null,
    folioSeq: orderData.folioSeq ?? null,
    createdAt: orderData.createdAt ?? Timestamp.now(),
    updatedAt: Timestamp.now(),
    completedAt: Timestamp.now(),
  };
  if (payment.cardOperationNumber) {
    mirrorOrder.cardOperationNumbers = [payment.cardOperationNumber];
  }
  batch.set(mirrorOrderRef, mirrorOrder);

  await batch.commit();
};
