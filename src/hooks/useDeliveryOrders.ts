// src/hooks/useDeliveryOrders.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { DeliveryOrder, DeliveryOrderStatus } from '../utils/types';
import { showErrorToast } from '../utils/errorHandler';

const mapDeliveryOrder = (id: string, data: any): DeliveryOrder => {
  const processedItems = (data.items || []).map((item: any) => ({
    ...item,
    createdAt: item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt || Date.now()),
    updatedAt: item.updatedAt?.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt || Date.now()),
    deletedAt: item.deletedAt?.toDate ? item.deletedAt.toDate() : undefined,
  }));

  const processedPayments = (data.payments || []).map((payment: any) => ({
    ...payment,
    createdAt: payment.createdAt?.toDate ? payment.createdAt.toDate() : new Date(payment.createdAt || Date.now()),
  }));

  return {
    id,
    customerName: data.customerName,
    deliveryTime: data.deliveryTime,
    address: data.address,
    contactPhone: data.contactPhone,
    waiterId: data.waiterId,
    waiterName: data.waiterName,
    items: processedItems,
    status: data.status,
    subtotal: data.subtotal,
    total: data.total,
    cardCommission: data.cardCommission,
    paymentMethod: data.paymentMethod,
    payments: processedPayments,
    folio: data.folio,
    folioSeq: data.folioSeq,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now()),
    closedAt: data.closedAt?.toDate ? data.closedAt.toDate() : undefined,
    deliveredAt: data.deliveredAt?.toDate ? data.deliveredAt.toDate() : undefined,
  };
};

/** Listado en tiempo real de pedidos a domicilio, opcionalmente filtrado por status. */
export const useDeliveryOrders = (statusFilter?: DeliveryOrderStatus) => {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const q = statusFilter
        ? query(collection(db, 'deliveryOrders'), where('status', '==', statusFilter), orderBy('createdAt', 'desc'))
        : query(collection(db, 'deliveryOrders'), orderBy('createdAt', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setOrders(snapshot.docs.map((d) => mapDeliveryOrder(d.id, d.data())));
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('❌ Error loading delivery orders:', err);
          setError('Error al cargar los pedidos a domicilio');
          setLoading(false);
          showErrorToast('Error al cargar los pedidos a domicilio');
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('❌ Error setting up delivery orders listener:', err);
      setError('Error al configurar la escucha de pedidos a domicilio');
      setLoading(false);
    }
  }, [statusFilter]);

  return { orders, loading, error };
};

/** Documento individual en tiempo real (para la pantalla de agregar productos / cobrar). */
export const useDeliveryOrderById = (orderId?: string) => {
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onSnapshot(
        doc(db, 'deliveryOrders', orderId),
        (docSnap) => {
          if (!docSnap.exists()) {
            setOrder(null);
            setLoading(false);
            setError('Pedido no encontrado');
            return;
          }
          setOrder(mapDeliveryOrder(docSnap.id, docSnap.data()));
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('❌ Error loading delivery order:', err);
          setError('Error al cargar el pedido');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('❌ Error setting up delivery order listener:', err);
      setError('Error al configurar la escucha del pedido');
      setLoading(false);
    }
  }, [orderId]);

  return { order, loading, error };
};
