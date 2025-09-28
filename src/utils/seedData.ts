// src/utils/seedData.ts
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { CreateData, Product, Table } from './types';

export const sampleTables: CreateData<Table>[] = [
  { number: 1, capacity: 2, status: 'libre' },
  { number: 2, capacity: 4, status: 'libre' },
  { number: 3, capacity: 6, status: 'libre' },
  { number: 4, capacity: 4, status: 'libre' },
  { number: 5, capacity: 2, status: 'libre' },
  { number: 6, capacity: 8, status: 'libre' },
  { number: 7, capacity: 4, status: 'libre' },
  { number: 8, capacity: 6, status: 'libre' },
];

export const sampleProducts: CreateData<Product>[] = [
  // Bebidas
  {
    name: 'Cerveza Corona',
    description: 'Cerveza clara mexicana 355ml',
    price: 45,
    category: 'Bebida',
    available: true,
  },
  {
    name: 'Cerveza Modelo',
    description: 'Cerveza tipo pilsner 355ml',
    price: 42,
    category: 'Bebida',
    available: true,
  },
  {
    name: 'Coca Cola',
    description: 'Refresco de cola 355ml',
    price: 25,
    category: 'Bebida',
    available: true,
  },
  {
    name: 'Agua Natural',
    description: 'Agua purificada 500ml',
    price: 15,
    category: 'Bebida',
    available: true,
  },
  {
    name: 'Jugo de Naranja',
    description: 'Jugo natural de naranja 250ml',
    price: 35,
    category: 'Bebida',
    available: true,
  },
  
  // Comidas
  {
    name: 'Hamburguesa Clásica',
    description: 'Carne de res, lechuga, tomate, cebolla, queso',
    price: 120,
    category: 'Comida',
    available: true,
  },
  {
    name: 'Tacos al Pastor',
    description: '3 tacos con carne al pastor, piña y cebolla',
    price: 85,
    category: 'Comida',
    available: true,
  },
  {
    name: 'Quesadillas',
    description: 'Tortilla de harina con queso oaxaca derretido',
    price: 65,
    category: 'Comida',
    available: true,
  },
  {
    name: 'Pizza Margherita',
    description: 'Pizza con salsa de tomate, mozzarella y albahaca',
    price: 180,
    category: 'Comida',
    available: true,
  },
  {
    name: 'Ensalada César',
    description: 'Lechuga romana, crutones, parmesano, aderezo césar',
    price: 95,
    category: 'Comida',
    available: true,
  },
  
  // Entradas
  {
    name: 'Nachos con Queso',
    description: 'Totopos con queso derretido y jalapeños',
    price: 75,
    category: 'Entrada',
    available: true,
  },
  {
    name: 'Alitas BBQ',
    description: '6 alitas de pollo con salsa barbacoa',
    price: 110,
    category: 'Entrada',
    available: true,
  },
  
  // Postres
  {
    name: 'Flan Napolitano',
    description: 'Postre tradicional mexicano con caramelo',
    price: 45,
    category: 'Postre',
    available: true,
  },
  {
    name: 'Helado de Vainilla',
    description: '2 bolas de helado artesanal de vainilla',
    price: 35,
    category: 'Postre',
    available: true,
  },
  {
    name: 'Pastel de Chocolate',
    description: 'Rebanada de pastel de chocolate con betún',
    price: 55,
    category: 'Postre',
    available: true,
  },
];

/**
 * Función para poblar la base de datos con datos de ejemplo
 * NOTA: Esta función debe ejecutarse manualmente desde la consola del navegador
 * o desde un script separado, NO desde la aplicación en producción
 */
export const seedDatabase = async (): Promise<void> => {
  try {
    console.log('Iniciando población de base de datos...');
    
    // Agregar mesas
    console.log('Agregando mesas...');
    for (const table of sampleTables) {
      const tableWithTimestamps = {
        ...table,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      await addDoc(collection(db, 'tables'), tableWithTimestamps);
    }
    
    // Agregar productos
    console.log('Agregando productos...');
    for (const product of sampleProducts) {
      const productWithTimestamps = {
        ...product,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      await addDoc(collection(db, 'products'), productWithTimestamps);
    }
    
    console.log('✅ Base de datos poblada exitosamente');
    console.log(`✅ ${sampleTables.length} mesas agregadas`);
    console.log(`✅ ${sampleProducts.length} productos agregados`);
  } catch (error) {
    console.error('❌ Error poblando la base de datos:', error);
    throw error;
  }
};

// Para usar esta función, ejecuta en la consola del navegador:
// import { seedDatabase } from './src/utils/seedData';
// seedDatabase();
