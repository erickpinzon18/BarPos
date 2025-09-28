// src/hooks/useKitchenOrders.ts
import { useEffect, useState } from 'react';
import type { Order } from '../utils/types';
import { getKitchenOrdersRealtime } from '../services/firestoreService';

export const useKitchenOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = getKitchenOrdersRealtime((data) => {
      setOrders(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return { orders, loading };
};
