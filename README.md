# 🍹 ChepeChupes - Bar POS System

Sistema de Punto de Venta (POS) moderno y completo para bares y restaurantes, construido con React, TypeScript, Firebase y TailwindCSS.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178C6?logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-11.1.0-FFCA28?logo=firebase)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4.17-06B6D4?logo=tailwindcss)

## � Tabla de Contenidos

- [Características](#-características)
- [Tecnologías](#-tecnologías)
- [Arquitectura](#-arquitectura)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Roles de Usuario](#-roles-de-usuario)
- [Módulos Principales](#-módulos-principales)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Scripts Disponibles](#-scripts-disponibles)
- [Deployment](#-deployment)

## ✨ Características

### 🎯 Funcionalidades Core

- **Gestión de Mesas**: Control completo del estado de mesas (libre, ocupada, reservada, limpieza)
- **Sistema de Órdenes**: Creación, modificación y seguimiento de pedidos en tiempo real
- **Múltiples Roles**: Admin, Mesero, Cocina y Barra con permisos específicos
- **Sistema de Pagos**: Soporte para efectivo, tarjeta y transferencia
- **Integración Mercado Pago**: Pagos con terminal Point (múltiples terminales)
- **Kanban de Cocina**: Tablero visual para seguimiento de pedidos (Pendiente → Listo → Entregado)
- **Gestión de Propinas**: Cálculo automático por porcentaje o monto fijo
- **División de Cuenta**: Cálculo por persona para cuentas compartidas
- **Impresión de Tickets**: Soporte para impresoras térmicas 58mm y 80mm
- **Notificaciones Sonoras**: Alertas cuando llegan nuevos pedidos a cocina/barra
- **Sistema de PIN**: Verificación de identidad para acciones críticas (eliminación, cierre de caja)

### � Seguridad

- Autenticación con Firebase Authentication
- Sistema de PIN para acciones sensibles
- Validación de roles en rutas protegidas
- Permisos granulares por tipo de usuario

### 📊 Reportes y Analytics

- Resumen diario de ventas por turno (5 PM - 3 AM)
- Histórico de tickets
- Desglose por método de pago
- Estadísticas de propinas
- Control de inventario de productos

### 🎨 UX/UI

- Diseño responsive (mobile-first)
- Modo oscuro optimizado para uso nocturno
- Animaciones suaves y feedback visual
- Interfaz intuitiva y rápida

## 🛠 Tecnologías

### Frontend

- **React 18.3.1**: Biblioteca principal para UI
- **TypeScript 5.5.3**: Tipado estático
- **Vite 6.0.5**: Build tool y dev server ultra-rápido
- **TailwindCSS 3.4.17**: Framework de utilidades CSS
- **React Router DOM 7.1.1**: Navegación y enrutamiento
- **React Hot Toast**: Notificaciones toast elegantes

### Backend & Database

- **Firebase 11.1.0**: 
  - Authentication: Gestión de usuarios
  - Firestore: Base de datos NoSQL en tiempo real
  - Hosting: Deploy de aplicación

### Integraciones

- **Mercado Pago Point API**: Integración con terminales de pago físicas
- **Sistema de impresión**: Compatible con impresoras térmicas estándar

### Desarrollo

- **ESLint**: Linting de código
- **PostCSS**: Procesamiento de CSS
- **clsx**: Gestión de clases CSS condicionales

## 🏗 Arquitectura

### Estructura de Datos (Firestore)

```typescript
// Usuarios
users/{userId}
  - id: string
  - email: string
  - displayName: string
  - role: 'admin' | 'waiter' | 'kitchen' | 'barra'
  - pin: string (4 dígitos)

// Mesas
tables/{tableId}
  - id: string
  - number: number
  - status: 'libre' | 'ocupada' | 'reservada' | 'limpieza'
  - currentOrderId?: string
  - waiterId?: string
  - waiterName?: string

// Productos
products/{productId}
  - id: string
  - name: string
  - description: string
  - price: number
  - category: 'Bebida' | 'Botella' | 'Shot' | 'Servicio' | 'Entrada' | 'Comida' | 'Postre'
  - available: boolean

// Órdenes
orders/{orderId}
  - id: string
  - tableId: string
  - tableNumber: number
  - waiterId: string
  - waiterName: string
  - status: 'activo' | 'pagado' | 'cancelado'
  - items: OrderItem[]
  - subtotal: number
  - total: number
  - peopleCount: number
  - payments: Payment[]
  - createdAt: Timestamp
  - updatedAt: Timestamp

// Items de Orden
OrderItem
  - id: string
  - productId: string
  - productName: string
  - category: string
  - price: number
  - quantity: number
  - status: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado'
  - notes?: string
  - isDeleted: boolean
  - createdAt: Timestamp

// Pagos
Payment
  - id: string
  - method: 'efectivo' | 'tarjeta' | 'transferencia'
  - amount: number
  - tipAmount: number
  - tipPercent?: number
  - cashierId: string
  - timestamp: Timestamp
```

### Flujo de Datos

1. **Apertura de Mesa (Mesero)**
   ```
   Usuario → Login → Home → Click Mesa → PIN → Crear Orden → Order Details
   ```

2. **Toma de Pedido (Mesero)**
   ```
   Order Details → Agregar Item → Seleccionar Producto → Cantidad → Guardar
   → Firestore (orden actualizada)
   → Kanban Cocina/Barra (tiempo real)
   ```

3. **Preparación (Cocina/Barra)**
   ```
   Kanban → Nuevo pedido (notificación sonora)
   → Marcar como "Listo"
   → Mesero recibe actualización
   ```

4. **Cobro (Admin/Mesero)**
   ```
   Checkout → Calcular propina → Seleccionar método de pago
   → Si tarjeta/transferencia: Modal Mercado Pago → Terminal Point
   → Confirmar pago → Cerrar mesa → Mesa pasa a "libre"
   ```

## 📦 Instalación

### Prerequisitos

- Node.js 18+ 
- npm o yarn
- Cuenta de Firebase
- (Opcional) Cuenta de Mercado Pago para pagos con terminal

### Pasos

1. **Clonar el repositorio**
   ```bash
   git clone https://github.com/erickpinzon18/BarPos.git
   cd bar-pos-app
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   ```bash
   cp .env.example .env
   ```

4. **Editar `.env` con tus credenciales de Firebase**
   ```env
   VITE_FIREBASE_API_KEY=tu-api-key
   VITE_FIREBASE_AUTH_DOMAIN=tu-auth-domain
   VITE_FIREBASE_PROJECT_ID=tu-project-id
   VITE_FIREBASE_STORAGE_BUCKET=tu-storage-bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=tu-sender-id
   VITE_FIREBASE_APP_ID=tu-app-id
   ```

5. **Configurar Mercado Pago (Opcional)**
   ```env
   VITE_MERCADOPAGO_ACCESS_TOKEN=tu-access-token
   VITE_MERCADOPAGO_USER_ID=tu-user-id
   VITE_MERCADOPAGO_ENV=sandbox # o production
   ```

6. **Iniciar servidor de desarrollo**
   ```bash
   npm run dev
   ```

7. **Abrir en navegador**
   ```
   http://localhost:5173
   ```

## ⚙️ Configuración

### Firebase Setup

1. Crear proyecto en [Firebase Console](https://console.firebase.google.com)
2. Habilitar **Authentication** → Email/Password
3. Crear **Firestore Database** en modo producción
4. Configurar reglas de seguridad en Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Usuarios: solo lectura autenticada
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId || 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Productos: lectura todos, escritura solo admin
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Mesas: lectura autenticada, escritura admin/mesero
    match /tables/{tableId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'waiter'];
    }
    
    // Órdenes: lectura autenticada, escritura admin/mesero
    match /orders/{orderId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'waiter', 'kitchen', 'barra'];
    }
    
    // Configuración: lectura autenticada, escritura admin
    match /config/{doc} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

5. Agregar índices compuestos necesarios (Firestore te lo pedirá automáticamente)

### Configuración de Negocio

La app permite configurar datos del negocio desde Admin → Configuración:

- **Nombre del negocio**
- **Logo** (URL de imagen)
- **Dirección**
- **Teléfono**
- **Configuración de turnos**
- **Retención de pedidos entregados** (minutos en Kanban)

### Datos Iniciales

Crear usuario admin inicial en Firebase Authentication:

```javascript
// Ejecutar en Firebase Console o script
// Email: admin@bar.com
// Password: Admin123!
// Luego crear documento en Firestore:

users/[uid-generado-por-auth]
{
  email: "admin@bar.com",
  displayName: "Administrador",
  role: "admin",
  pin: "1234"
}
```

## 📂 Estructura del Proyecto

```
bar-pos-app/
├── public/
│   └── vite.svg
├── src/
│   ├── assets/               # Imágenes, sonidos
│   │   ├── ding.mp3         # Sonido de notificación
│   │   ├── logo.jpeg
│   │   └── react.svg
│   │
│   ├── components/
│   │   ├── common/          # Componentes reutilizables
│   │   │   ├── AddItemModal.tsx
│   │   │   ├── AdminSidebar.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── KitchenStatusControl.tsx
│   │   │   ├── MercadoPagoTerminalModal.tsx
│   │   │   ├── OrderTicket.tsx
│   │   │   ├── PinModal.tsx
│   │   │   ├── ProductCard.tsx
│   │   │   ├── QuantityModal.tsx
│   │   │   └── TableCard.tsx
│   │   │
│   │   └── ui/              # Componentes base
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Input.tsx
│   │       └── Modal.tsx
│   │
│   ├── contexts/            # React Context
│   │   └── AuthContext.tsx
│   │
│   ├── hooks/               # Custom Hooks
│   │   ├── useKitchenOrders.ts
│   │   ├── useOrders.ts
│   │   ├── useProducts.ts
│   │   └── useTables.ts
│   │
│   ├── layouts/             # Layouts por rol
│   │   ├── AdminLayout.tsx
│   │   ├── KitchenLayout.tsx
│   │   └── WaiterLayout.tsx
│   │
│   ├── pages/               # Páginas organizadas por rol
│   │   ├── admin/
│   │   │   ├── Checkout.tsx
│   │   │   ├── DailySummary.tsx
│   │   │   ├── Home.tsx
│   │   │   ├── Kanban.tsx
│   │   │   ├── KitchenControl.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── ManageProducts.tsx
│   │   │   ├── OrderDetails.tsx
│   │   │   └── Tickets.tsx
│   │   │
│   │   ├── kitchen/
│   │   │   ├── Kanban.tsx
│   │   │   └── Login.tsx
│   │   │
│   │   ├── waiter/
│   │   │   ├── Checkout.tsx
│   │   │   ├── Home.tsx
│   │   │   ├── Login.tsx
│   │   │   └── OrderDetails.tsx
│   │   │
│   │   └── Login.tsx        # Login unificado
│   │
│   ├── routes/              # Configuración de rutas
│   │   └── ProtectedRoute.tsx
│   │
│   ├── services/            # Servicios externos
│   │   ├── firebase.ts
│   │   ├── firestoreService.ts
│   │   ├── mercadoPagoService.ts
│   │   └── orderService.ts
│   │
│   ├── utils/               # Utilidades y tipos
│   │   ├── categories.ts
│   │   ├── cn.ts
│   │   ├── constants.ts
│   │   ├── errorHandler.ts
│   │   ├── formatters.ts
│   │   ├── notificationSound.ts
│   │   ├── printTicket.ts
│   │   └── types.ts
│   │
│   ├── App.tsx              # Componente principal con rutas
│   ├── main.tsx            # Entry point
│   ├── index.css           # Estilos globales
│   └── App.css
│
├── .env                     # Variables de entorno (no subir a git)
├── .env.example            # Plantilla de variables
├── .gitignore
├── eslint.config.js
├── firebase.json           # Configuración de Firebase Hosting
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── README.md
```

## 🚀 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor de desarrollo (puerto 5173)

# Build
npm run build        # Compila TypeScript + build de producción
npm run preview      # Preview del build de producción

# Linting
npm run lint         # Ejecuta ESLint

# Firebase
firebase login       # Login a Firebase CLI
firebase deploy      # Deploy a Firebase Hosting
firebase serve       # Simular hosting localmente
```

## 🌐 Deployment

### Firebase Hosting

1. **Instalar Firebase CLI** (si no lo tienes)
   ```bash
   npm install -g firebase-tools
   ```

2. **Login a Firebase**
   ```bash
   firebase login
   ```

3. **Inicializar proyecto** (si no está inicializado)
   ```bash
   firebase init hosting
   # Selecciona tu proyecto
   # Public directory: dist
   # Single-page app: Yes
   ```

4. **Build de producción**
   ```bash
   npm run build
   ```

5. **Deploy**
   ```bash
   firebase deploy
   ```

6. **URL de tu app**
   ```
   https://[tu-proyecto].web.app
   ```

### Variables de Entorno en Producción

```env
# Cambiar a credenciales de producción
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...

# Mercado Pago en producción
VITE_MERCADOPAGO_ENV=production
VITE_MERCADOPAGO_ACCESS_TOKEN=APP-[tu-token-produccion]
```

## 🔧 Configuración Avanzada

### Mercado Pago Terminal

1. **Obtener credenciales** en https://www.mercadopago.com.mx/developers/panel/app
2. **Configurar terminales** en `src/services/mercadoPagoService.ts`
3. **Variables de entorno**
   ```env
   VITE_MERCADOPAGO_ACCESS_TOKEN=TEST-xxx-xxx
   VITE_MERCADOPAGO_USER_ID=123456789
   VITE_MERCADOPAGO_ENV=sandbox
   ```

## 📝 Roadmap

- [ ] Dashboard de analytics avanzado
- [ ] Sistema de inventario automático
- [ ] App móvil nativa
- [ ] QR codes para menú digital
- [ ] Tests unitarios y E2E
- [ ] PWA (Progressive Web App)

## 👨‍💻 Autor

**Erick Pinzón**
- GitHub: [@erickpinzon18](https://github.com/erickpinzon18)

---

**Desarrollado con ❤️ para ChepeChupes Bar** 🍹

## 📞 Credenciales de Prueba

```
Admin:
Email: admin@bar.com
Password: Admin123!
PIN: 1234

Mesero:
Email: mesero@bar.com
Password: Mesero123!
PIN: 5678

Cocina:
Email: cocina@bar.com
Password: Cocina123!
PIN: 9012

Barra:
Email: barra@bar.com
Password: Barra123!
PIN: 3456
```

## ❓ FAQ

**P: ¿Cómo reinicio la base de datos?**  
R: Desde Firebase Console → Firestore → Eliminar colecciones. Luego volver a crear usuario admin.

**P: ¿Puedo usar sin internet?**  
R: Actualmente requiere conexión. Modo offline está en el roadmap.

**P: ¿Los pedidos se pierden si se recarga la página?**  
R: No, todo está en tiempo real con Firestore. Los datos persisten.

## � Roles de Usuario

### 👨‍💼 Admin
- **Acceso**: `/admin/*`
- **Permisos**:
  - Gestión completa de mesas
  - Gestión de productos (CRUD)
  - Gestión de usuarios
  - Ver/modificar cualquier orden
  - Acceso a reportes y tickets
  - Control de cocina y barra (Kanban)
  - Cerrar caja
  - Configuración del sistema

### 🧑‍🍳 Mesero (Waiter)
- **Acceso**: `/waiter/*`
- **Permisos**:
  - Abrir/cerrar mesas asignadas
  - Crear y modificar órdenes de sus mesas
  - Agregar/eliminar items (con PIN)
  - Procesar pagos
  - Ver estado de pedidos en cocina

### 👨‍🍳 Cocina (Kitchen)
- **Acceso**: `/kitchen/cocina`
- **Permisos**:
  - Ver Kanban de cocina
  - Actualizar estado de items de cocina (Entrada, Comida, Postre)
  - Marcar items como listos o entregados
  - Recibir notificaciones de nuevos pedidos

### 🍹 Barra (Bar)
- **Acceso**: `/kitchen/barra`
- **Permisos**:
  - Ver Kanban de barra
  - Actualizar estado de items de barra (Bebida, Botella, Shot, Servicio)
  - Marcar items como listos o entregados
  - Recibir notificaciones de nuevos pedidos

## 📱 Módulos Principales

### 1. Home (Mesas)
- Vista de todas las mesas
- Filtros por estado
- Indicadores visuales de ocupación
- Apertura rápida con PIN

### 2. Order Details (Detalle de Orden)
- Lista de items con estado
- Agregar/eliminar productos
- Notas especiales
- Contador de personas
- Cálculo automático de totales

### 3. Checkout (Cobro)
- Resumen de cuenta
- Calculadora de propinas (%, $, /persona)
- Selección de método de pago
- Integración con Mercado Pago Terminal
- Impresión de ticket

### 4. Kanban (Cocina/Barra)
- Columnas: Pendientes → Listos → Entregados
- Filtros por categoría
- Notificaciones sonoras
- Auto-actualización en tiempo real
- Retención configurable de entregados

### 5. Gestión de Productos
- CRUD completo
- Categorización
- Control de disponibilidad
- Búsqueda y filtros

### 6. Tickets (Historial)
- Búsqueda por mesa/fecha
- Re-impresión
- Detalles de pago

### 7. Resumen Diario
- Ventas por turno (5 PM - 3 AM)
- Desglose por método de pago
- Estadísticas de propinas
- Promedio por orden

### 8. Control de Cocina (Admin)
- Vista global de todos los pedidos
- Filtros por estación (cocina/barra)
- Cambio manual de estados
- Monitoreo en tiempo real

### 9. Configuración
- Datos del negocio
- Gestión de usuarios
- Parámetros del sistema

## 📂 Estructura del Proyecto

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
