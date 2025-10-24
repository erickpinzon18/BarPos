// src/utils/createSampleProducts.ts
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { CreateData, Product } from './types';

/**
 * Crea productos de ejemplo para testing
 */
export const createSampleProducts = async () => {
  try {
    // console.log('🔄 Creando productos de ejemplo...');

    const sampleProducts: CreateData<Product>[] = [
      // Bebidas
      {
        name: 'Cerveza Corona',
        description: 'Cerveza mexicana refrescante',
        price: 45,
        category: 'Bebida',
        available: true
      },
      {
        name: 'Margarita Clásica',
        description: 'Tequila, triple sec, limón',
        price: 120,
        category: 'Bebida',
        available: true
      },
      {
        name: 'Mojito',
        description: 'Ron, menta, limón, soda',
        price: 110,
        category: 'Bebida',
        available: true
      },
      {
        name: 'Agua Mineral',
        description: 'Agua mineral natural',
        price: 25,
        category: 'Bebida',
        available: true
      },
      {
        name: 'Refresco de Cola',
        description: 'Coca-Cola 355ml',
        price: 30,
        category: 'Bebida',
        available: true
      },

      // Comida
      {
        name: 'Hamburguesa Clásica',
        description: 'Carne, lechuga, tomate, queso',
        price: 120,
        category: 'Comida',
        available: true
      },
      {
        name: 'Tacos de Arrachera',
        description: 'Orden de 3 tacos con guacamole',
        price: 150,
        category: 'Comida',
        available: true
      },
      {
        name: 'Quesadillas',
        description: 'Tortilla con queso y pollo',
        price: 85,
        category: 'Comida',
        available: true
      },
      {
        name: 'Alitas BBQ',
        description: '8 piezas con salsa BBQ',
        price: 95,
        category: 'Comida',
        available: true
      },

      // Entradas
      {
        name: 'Nachos con Queso',
        description: 'Totopos con queso derretido',
        price: 75,
        category: 'Entrada',
        available: true
      },
      {
        name: 'Guacamole Especial',
        description: 'Con totopos y pico de gallo',
        price: 65,
        category: 'Entrada',
        available: true
      },
      {
        name: 'Dedos de Queso',
        description: '6 piezas con salsa ranch',
        price: 70,
        category: 'Entrada',
        available: true
      },

      // Postres
      {
        name: 'Flan Napolitano',
        description: 'Flan casero con caramelo',
        price: 45,
        category: 'Postre',
        available: true
      },
      {
        name: 'Helado de Vainilla',
        description: '2 bolas con topping',
        price: 40,
        category: 'Postre',
        available: true
      },
      {
        name: 'Brownie con Helado',
        description: 'Brownie caliente con helado',
        price: 55,
        category: 'Postre',
        available: true
      }
    ];

    const createdProducts = [];

    for (const product of sampleProducts) {
      const productRef = await addDoc(collection(db, 'products'), {
        ...product,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      createdProducts.push({
        id: productRef.id,
        ...product
      });

      // console.log(`✅ Producto creado: ${product.name}`);
    }

    // console.log(`✅ ${createdProducts.length} productos creados exitosamente`);
    return createdProducts;

  } catch (error) {
    console.error('❌ Error creando productos de ejemplo:', error);
    throw error;
  }
};

// Exponer función globalmente para desarrollo
if (typeof window !== 'undefined') {
  (window as any).createSampleProducts = createSampleProducts;
}
