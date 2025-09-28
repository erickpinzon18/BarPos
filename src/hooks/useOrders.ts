// src/hooks/useOrders.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, doc, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Order } from '../utils/types';
import { showErrorToast } from '../utils/errorHandler';

export const useOrders = (status?: 'activo' | 'pagado' | 'cancelado') => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      let q = query(
        collection(db, 'orders'),
        orderBy('createdAt', 'desc')
      );

      // Filtrar por status si se proporciona
      if (status) {
        q = query(
          collection(db, 'orders'),
          where('status', '==', status),
          orderBy('createdAt', 'desc')
        );
      }

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersData: Order[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          
          // Procesar items con timestamps correctos
          const processedItems = (data.items || []).map((item: any) => ({
            ...item,
            createdAt: item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt || Date.now()),
            updatedAt: item.updatedAt?.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt || Date.now()),
            deletedAt: item.deletedAt?.toDate ? item.deletedAt.toDate() : undefined
          }));
          
          ordersData.push({
            id: doc.id,
            tableId: data.tableId,
            tableNumber: data.tableNumber,
            waiterId: data.waiterId,
            waiterName: data.waiterName,
            items: processedItems,
            status: data.status,
            paymentMethod: data.paymentMethod,
            peopleCount: data.peopleCount,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now()),
            completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : undefined
          });
        });

        // console.log('📋 Orders loaded:', ordersData);
        setOrders(ordersData);
        setLoading(false);
        setError(null);
      }, (err) => {
        console.error('❌ Error loading orders:', err);
        setError('Error al cargar las órdenes');
        setLoading(false);
        showErrorToast('Error al cargar las órdenes');
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('❌ Error setting up orders listener:', err);
      setError('Error al configurar la escucha de órdenes');
      setLoading(false);
      showErrorToast('Error al configurar la escucha de órdenes');
    }
  }, [status]);

  return { orders, loading, error };
};

// Hook específico para órdenes activas
export const useActiveOrders = () => {
  return useOrders('activo');
};

// Hook para obtener una orden específica por mesa
export const useOrderByTable = (tableId: string) => {
  const { orders, loading, error } = useActiveOrders();
  
  const order = orders.find(order => order.tableId === tableId);
  
  return { order, loading, error };
};

// Optimized hook: subscribe only to the active order for a specific table (single listener)
export const useOrderByTableId = (tableId?: string) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tableId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    try {
      // Query for the active order for the given tableId, most recent first, limit 1
      const q = query(
        collection(db, 'orders'),
        where('tableId', '==', tableId),
        where('status', '==', 'activo'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          setOrder(null);
          setLoading(false);
          setError(null);
          return;
        }

        const docSnap = snapshot.docs[0];
        const data = docSnap.data();

        const processedItems = (data.items || []).map((item: any) => ({
          ...item,
          createdAt: item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt || Date.now()),
          updatedAt: item.updatedAt?.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt || Date.now()),
          deletedAt: item.deletedAt?.toDate ? item.deletedAt.toDate() : undefined
        }));

        const orderObj: Order = {
          id: docSnap.id,
          tableId: data.tableId,
          tableNumber: data.tableNumber,
          waiterId: data.waiterId,
          waiterName: data.waiterName,
          items: processedItems,
          status: data.status,
          paymentMethod: data.paymentMethod,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now()),
          completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : undefined,
          // include optional numeric fields if present
          peopleCount: data.peopleCount
        } as Order;

        setOrder(orderObj);
        setLoading(false);
        setError(null);
      }, (err: any) => {
        console.error('❌ Error loading order by table:', err);
        setError('Error al cargar la orden');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('❌ Error setting up order listener by table:', err);
      setError('Error al configurar la escucha de la orden');
      setLoading(false);
    }
  }, [tableId]);

  return { order, loading, error };
};

// Hook para obtener una orden específica por su ID (documento) en tiempo real
export const useOrderById = (orderId?: string | null) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setLoading(false);
      return;
    }

    try {
      // usamos onSnapshot a nivel de documento
      const unsubscribe = onSnapshot(doc(db, 'orders', orderId), (docSnap: any) => {
        if (!docSnap.exists()) {
          setOrder(null);
          setLoading(false);
          setError('Orden no encontrada');
          return;
        }

        const data = docSnap.data();

        const processedItems = (data.items || []).map((item: any) => ({
          ...item,
          createdAt: item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt || Date.now()),
          updatedAt: item.updatedAt?.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt || Date.now()),
          deletedAt: item.deletedAt?.toDate ? item.deletedAt.toDate() : undefined
        }));

        const orderObj: Order = {
          id: docSnap.id,
          tableId: data.tableId,
          tableNumber: data.tableNumber,
          waiterId: data.waiterId,
          waiterName: data.waiterName,
          items: processedItems,
          status: data.status,
          paymentMethod: data.paymentMethod,
          peopleCount: data.peopleCount,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now()),
          completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : undefined
        };

        setOrder(orderObj);
        setLoading(false);
        setError(null);
      }, (err: any) => {
        console.error('❌ Error loading order by id:', err);
        setError('Error al cargar la orden');
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('❌ Error setting up order listener by id:', err);
      setError('Error al configurar la escucha de la orden');
      setLoading(false);
    }
  }, [orderId]);

  return { order, loading, error };
};
