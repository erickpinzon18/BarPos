// src/hooks/useOrders.ts
import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
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
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now()),
            completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : undefined
          });
        });

        console.log('📋 Orders loaded:', ordersData);
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
