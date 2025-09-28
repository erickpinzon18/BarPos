# Bar POS Application

Una aplicación completa de Punto de Venta (POS) para bares y restaurantes, construida con React, TypeScript, Firebase y Tailwind CSS.

## 🚀 Características

- **Autenticación por roles**: Admin, Mesero, Cocina
- **Gestión de mesas en tiempo real**
- **Sistema de pedidos con Kanban para cocina**
- **Interfaz responsive y moderna**
- **Base de datos en tiempo real con Firestore**
- **Notificaciones toast para feedback del usuario**

## 🛠️ Tecnologías

- **Frontend**: React 19, TypeScript, Vite
- **Estilos**: Tailwind CSS
- **Backend**: Firebase Auth, Firestore
- **Enrutamiento**: React Router DOM
- **Notificaciones**: React Hot Toast
- **Iconos**: Lucide React

## 📦 Instalación

1. **Clona el repositorio**
```bash
git clone <repository-url>
cd bar-pos-app
```

2. **Instala las dependencias**
```bash
npm install
```

3. **Configura Firebase**
   - El archivo `src/services/firebase.ts` ya está configurado
   - Asegúrate de que tu proyecto Firebase tenga habilitado:
     - Authentication (Email/Password)
     - Firestore Database

4. **Ejecuta la aplicación**
```bash
npm run dev
```

## 🔧 Configuración de Base de Datos

### Estructura de Firestore

La aplicación requiere las siguientes colecciones en Firestore:

#### 1. Colección `users`
```javascript
// Documento con ID = uid del usuario
{
  uid: "firebase-auth-uid",
  email: "admin@bar.com",
  displayName: "Administrador",
  role: "admin", // "admin" | "waiter" | "kitchen"
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 2. Colección `tables`
```javascript
{
  number: 1,
  capacity: 4,
  status: "libre", // "libre" | "ocupada" | "reservada"
  waiterId: null,
  waiterName: null,
  currentOrderId: null,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 3. Colección `products`
```javascript
{
  name: "Cerveza Corona",
  description: "Cerveza clara mexicana",
  price: 45.00,
  category: "Bebida", // "Bebida" | "Comida" | "Postre" | "Entrada"
  available: true,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 4. Colección `orders`
```javascript
{
  tableId: "table-doc-id",
  tableNumber: 1,
  waiterId: "waiter-uid",
  waiterName: "Juan Pérez",
  items: [
    {
      id: "unique-item-id",
      productId: "product-doc-id",
      productName: "Cerveza Corona",
      productPrice: 45.00,
      quantity: 2,
      status: "pendiente", // "pendiente" | "en_preparacion" | "listo" | "entregado"
      notes: "Sin hielo",
      category: "Bebida",
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ],
  status: "activo", // "activo" | "pagado" | "cancelado"
  subtotal: 90.00,
  tax: 14.40,
  total: 104.40,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### Datos de Ejemplo

Para probar la aplicación, crea los siguientes datos en Firestore:

#### Usuarios de Prueba
```javascript
// Crear en Authentication y luego en colección users
// Admin
{
  uid: "admin-uid",
  email: "admin@bar.com",
  displayName: "Administrador",
  role: "admin"
}

// Mesero
{
  uid: "waiter-uid", 
  email: "mesero@bar.com",
  displayName: "Juan Pérez",
  role: "waiter"
}

// Cocina
{
  uid: "kitchen-uid",
  email: "cocina@bar.com", 
  displayName: "Chef Mario",
  role: "kitchen"
}
```

#### Mesas de Ejemplo
```javascript
// Mesa 1
{ number: 1, capacity: 2, status: "libre" }
// Mesa 2  
{ number: 2, capacity: 4, status: "libre" }
// Mesa 3
{ number: 3, capacity: 6, status: "libre" }
// Mesa 4
{ number: 4, capacity: 4, status: "libre" }
```

#### Productos de Ejemplo
```javascript
// Bebidas
{ name: "Cerveza Corona", description: "Cerveza clara mexicana", price: 45, category: "Bebida", available: true }
{ name: "Coca Cola", description: "Refresco de cola", price: 25, category: "Bebida", available: true }
{ name: "Agua Natural", description: "Agua purificada", price: 15, category: "Bebida", available: true }

// Comidas
{ name: "Hamburguesa Clásica", description: "Carne, lechuga, tomate, cebolla", price: 120, category: "Comida", available: true }
{ name: "Tacos al Pastor", description: "3 tacos con piña y cebolla", price: 85, category: "Comida", available: true }
{ name: "Quesadillas", description: "Tortilla con queso derretido", price: 65, category: "Comida", available: true }

// Postres
{ name: "Flan Napolitano", description: "Postre tradicional mexicano", price: 45, category: "Postre", available: true }
{ name: "Helado de Vainilla", description: "2 bolas de helado", price: 35, category: "Postre", available: true }
```

## 🔐 Credenciales de Prueba

Una vez que hayas creado los usuarios en Firebase Authentication, puedes usar:

- **Admin**: admin@bar.com / password123
- **Mesero**: mesero@bar.com / password123  
- **Cocina**: cocina@bar.com / password123

## 🚀 Uso de la Aplicación

### Flujo de Trabajo

1. **Login**: Cada usuario accede con su rol específico
2. **Admin**: Puede ver todas las mesas, gestionar productos, ver kanban de cocina
3. **Mesero**: Puede abrir mesas, tomar pedidos, ver estado de órdenes
4. **Cocina**: Ve el kanban con pedidos pendientes, puede actualizar estados

### Rutas Principales

- `/admin/login` - Login de administrador
- `/admin/home` - Dashboard de mesas (admin)
- `/admin/kanban` - Kanban de cocina (admin)
- `/waiter/login` - Login de mesero
- `/waiter/home` - Dashboard de mesas (mesero)
- `/kitchen/login` - Login de cocina
- `/kitchen/kanban` - Kanban de cocina

## 🏗️ Arquitectura

```
src/
├── components/
│   ├── ui/           # Componentes reutilizables (Button, Input, Modal)
│   └── common/       # Componentes específicos (TableCard, ProductCard)
├── contexts/         # Context de autenticación
├── hooks/           # Hooks personalizados
├── layouts/         # Layouts por rol
├── pages/           # Páginas organizadas por rol
├── routes/          # Rutas protegidas
├── services/        # Firebase y Firestore
└── utils/           # Tipos y utilidades
```

## 🔧 Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run preview  # Preview del build
npm run lint     # Linter ESLint
```

## 📝 Próximas Características

- [ ] Gestión completa de productos (CRUD)
- [ ] Sistema de reportes y estadísticas
- [ ] Gestión de inventario
- [ ] Sistema de reservaciones
- [ ] Integración con sistemas de pago
- [ ] Impresión de tickets
- [ ] Dashboard de analytics

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.
