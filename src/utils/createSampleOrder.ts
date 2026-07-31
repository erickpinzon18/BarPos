// src/utils/createSampleOrder.ts
import { collection, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { CreateData, Order, OrderItem } from './types';

/**
 * Crea una orden de ejemplo para testing con fechas realistas
 */
export const createSampleOrder = async (tableId: string, tableNumber: number) => {
  try {
    console.log('🔄 Creando orden de ejemplo para mesa', tableNumber);

    // Fechas realistas: Orden empezó a las 9:00 PM (hace 1h 45min)
    const now = new Date(); // 10:45 PM del 27 sep 2025
    const orderStartTime = new Date(now.getTime() - (1 * 60 + 45) * 60 * 1000); // 9:00 PM
    
    console.log('⏰ Fechas calculadas:', {
      ahora: now.toLocaleString(),
      inicioOrden: orderStartTime.toLocaleString(),
      tiempoTranscurrido: '1h 45min'
    });

    // Items de ejemplo con fechas escalonadas (agregados en diferentes momentos)
    const sampleItems: CreateData<OrderItem>[] = [
      {
        productId: 'ky4drj2nNpIpRxESTj3E',
        productName: 'Cerveza Corona',
        productPrice: 45,
        quantity: 4,
        status: 'entregado',
        category: 'Bebida'
      },
      {
        productId: 'KsEX4zTUhN5o3v4TiLM4',
        productName: 'Hamburguesa Clásica',
        productPrice: 120,
        quantity: 2,
        status: 'entregado',
        category: 'Hamburguesas'
      },
      {
        productId: 'NFKZGbDuRR8FYuF0kBJ9',
        productName: 'Nachos con Queso',
        productPrice: 75,
        quantity: 1,
        status: 'entregado',
        category: 'Especiales'
      },
      {
        productId: 'prod_flan_napolitano',
        productName: 'Flan Napolitano',
        productPrice: 45,
        quantity: 2,
        status: 'entregado',
        category: 'Postres'
      }
    ];

    // Calcular totales
    const subtotal = sampleItems.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);
    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    // Crear items con timestamps escalonados (agregados en diferentes momentos)
    const itemsWithTimestamps = sampleItems.map((item, index) => {
      // Items agregados cada 5 minutos después del inicio
      const itemTime = new Date(orderStartTime.getTime() + (index * 5 * 60 * 1000));
      
      return {
        ...item,
        id: `item_00${index + 1}`,
        createdAt: Timestamp.fromDate(itemTime),
        updatedAt: Timestamp.fromDate(itemTime)
      };
    });

    console.log('📋 Items con fechas:', itemsWithTimestamps.map((item) => ({
      name: item.productName,
      createdAt: item.createdAt.toDate().toLocaleString(),
      status: item.status
    })));

    // Crear la orden
    const orderData: CreateData<Order> = {
      tableId: tableId,
      tableNumber: tableNumber,
      waiterId: 'sample-waiter-id',
      waiterName: 'Juan Pérez',
      items: itemsWithTimestamps as any, // Los timestamps se manejarán correctamente
      status: 'activo',
      subtotal: subtotal,
      tax: tax,
      total: total
    };

    // Guardar en Firestore
    const orderRef = await addDoc(collection(db, 'orders'), {
      ...orderData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    console.log('✅ Orden creada con ID:', orderRef.id);

    // Actualizar la mesa para marcarla como ocupada
    await updateDoc(doc(db, 'tables', tableId), {
      status: 'ocupada',
      currentOrderId: orderRef.id,
      waiterId: 'sample-waiter-id',
      waiterName: 'Juan Pérez',
      updatedAt: Timestamp.now()
    });

    console.log('✅ Mesa actualizada a ocupada');

    return {
      orderId: orderRef.id,
      order: orderData
    };

  } catch (error) {
    console.error('❌ Error creando orden de ejemplo:', error);
    throw error;
  }
};

/**
 * Función para crear múltiples órdenes de ejemplo
 */
export const createMultipleSampleOrders = async (tableIds: string[]) => {
  const orders = [];
  
  for (let i = 0; i < tableIds.length; i++) {
    const tableId = tableIds[i];
    const tableNumber = i + 1;
    
    try {
      const result = await createSampleOrder(tableId, tableNumber);
      orders.push(result);
      
      // Esperar un poco entre creaciones
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Error creando orden para mesa ${tableNumber}:`, error);
    }
  }
  
  return orders;
};

// Exponer funciones globalmente para desarrollo
if (typeof window !== 'undefined') {
  (window as any).createSampleOrder = createSampleOrder;
  (window as any).createMultipleSampleOrders = createMultipleSampleOrders;
}
