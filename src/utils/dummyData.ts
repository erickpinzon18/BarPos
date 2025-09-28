// src/utils/dummyData.ts
// Datos dummy para usar en desarrollo

export const dummyUsers = [
  {
    email: 'admin@bar.com',
    displayName: 'Administrador Principal',
    role: 'admin' as const,
  },
  {
    email: 'mesero@bar.com',
    displayName: 'Juan Pérez',
    role: 'waiter' as const,
  },
  {
    email: 'mesero2@bar.com',
    displayName: 'María González',
    role: 'waiter' as const,
  },
  {
    email: 'cocina@bar.com',
    displayName: 'Chef Mario',
    role: 'kitchen' as const,
  },
];

export const dummyTables = [
  { number: 1, capacity: 2, status: 'libre' as const },
  { number: 2, capacity: 4, status: 'libre' as const },
  { number: 3, capacity: 6, status: 'libre' as const },
  { number: 4, capacity: 4, status: 'libre' as const },
  { number: 5, capacity: 2, status: 'libre' as const },
  { number: 6, capacity: 8, status: 'libre' as const },
  { number: 7, capacity: 4, status: 'libre' as const },
  { number: 8, capacity: 6, status: 'libre' as const },
  { number: 9, capacity: 2, status: 'libre' as const },
  { number: 10, capacity: 4, status: 'libre' as const },
];

export const dummyProducts = [
  // Bebidas
  {
    name: 'Cerveza Corona',
    description: 'Cerveza clara mexicana 355ml',
    price: 45,
    category: 'Bebida' as const,
    available: true,
  },
  {
    name: 'Cerveza Modelo',
    description: 'Cerveza tipo pilsner 355ml',
    price: 42,
    category: 'Bebida' as const,
    available: true,
  },
  {
    name: 'Coca Cola',
    description: 'Refresco de cola 355ml',
    price: 25,
    category: 'Bebida' as const,
    available: true,
  },
  {
    name: 'Agua Natural',
    description: 'Agua purificada 500ml',
    price: 15,
    category: 'Bebida' as const,
    available: true,
  },
  {
    name: 'Café Americano',
    description: 'Café negro recién preparado',
    price: 30,
    category: 'Bebida' as const,
    available: true,
  },
  
  // Comidas
  {
    name: 'Hamburguesa Clásica',
    description: 'Carne de res, lechuga, tomate, cebolla, queso',
    price: 120,
    category: 'Comida' as const,
    available: true,
  },
  {
    name: 'Tacos al Pastor',
    description: '3 tacos con carne al pastor, piña y cebolla',
    price: 85,
    category: 'Comida' as const,
    available: true,
  },
  {
    name: 'Quesadillas',
    description: 'Tortilla de harina con queso oaxaca derretido',
    price: 65,
    category: 'Comida' as const,
    available: true,
  },
  {
    name: 'Pizza Margherita',
    description: 'Pizza con salsa de tomate, mozzarella y albahaca',
    price: 180,
    category: 'Comida' as const,
    available: true,
  },
  {
    name: 'Ensalada César',
    description: 'Lechuga romana, crutones, parmesano, aderezo césar',
    price: 95,
    category: 'Comida' as const,
    available: true,
  },
  
  // Entradas
  {
    name: 'Nachos con Queso',
    description: 'Totopos con queso derretido y jalapeños',
    price: 75,
    category: 'Entrada' as const,
    available: true,
  },
  {
    name: 'Alitas BBQ',
    description: '6 alitas de pollo con salsa barbacoa',
    price: 110,
    category: 'Entrada' as const,
    available: true,
  },
  {
    name: 'Guacamole con Totopos',
    description: 'Guacamole fresco con totopos de maíz',
    price: 65,
    category: 'Entrada' as const,
    available: true,
  },
  
  // Postres
  {
    name: 'Flan Napolitano',
    description: 'Postre tradicional mexicano con caramelo',
    price: 45,
    category: 'Postre' as const,
    available: true,
  },
  {
    name: 'Helado de Vainilla',
    description: '2 bolas de helado artesanal de vainilla',
    price: 35,
    category: 'Postre' as const,
    available: true,
  },
  {
    name: 'Cheesecake',
    description: 'Rebanada de cheesecake de fresa',
    price: 60,
    category: 'Postre' as const,
    available: true,
  },
];

// Credenciales para desarrollo
export const devCredentials = {
  admin: { email: 'admin@bar.com', password: 'password123' },
  waiter: { email: 'mesero@bar.com', password: 'password123' },
  waiter2: { email: 'mesero2@bar.com', password: 'password123' },
  kitchen: { email: 'cocina@bar.com', password: 'password123' },
};
