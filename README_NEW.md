# 🍺 Bar POS App

Sistema de punto de venta moderno para bares y restaurantes construido con React, TypeScript, Firebase y Tailwind CSS.

## ✨ Características

- 🔐 **Autenticación por roles**: Admin, Mesero, Cocina
- 🪑 **Gestión de mesas**: Control de estado en tiempo real
- 🍔 **Gestión de productos**: CRUD completo con categorías
- 📋 **Sistema de órdenes**: Flujo completo desde pedido hasta entrega
- 👨‍🍳 **Vista de cocina**: Sistema Kanban para preparación
- 💰 **Checkout**: Procesamiento de pagos múltiples
- 📱 **Responsive**: Diseño adaptable para móviles y tablets
- 🔥 **Tiempo real**: Actualizaciones instantáneas con Firestore

## 🚀 Tecnologías

- **Frontend**: React 19, TypeScript, Vite
- **Estilos**: Tailwind CSS v3
- **Backend**: Firebase (Auth + Firestore)
- **Routing**: React Router v6
- **Estado**: Context API + Custom Hooks
- **Notificaciones**: React Hot Toast
- **Iconos**: Lucide React

## 📁 Estructura del Proyecto

```
src/
├── components/
│   ├── ui/              # Componentes base (Button, Input, Modal, etc.)
│   ├── common/          # Componentes específicos (TableCard, ProductCard, etc.)
│   └── layouts/         # Layouts por rol (AdminLayout, WaiterLayout, etc.)
├── contexts/            # Context providers (AuthContext)
├── hooks/              # Custom hooks (useTables, useKitchenOrders)
├── pages/              # Páginas organizadas por rol
│   ├── admin/          # Dashboard, productos, mesas
│   ├── waiter/         # Mesas, órdenes, checkout
│   └── kitchen/        # Kanban de órdenes
├── services/           # Servicios de Firebase
├── utils/              # Tipos, utilidades, datos dummy
└── routes/             # Rutas protegidas
```

## 🛠️ Instalación

1. **Clona el repositorio**
   ```bash
   git clone <repo-url>
   cd bar-pos-app
   ```

2. **Instala las dependencias**
   ```bash
   npm install
   ```

3. **Configura Firebase** (ver sección siguiente)

4. **Ejecuta el proyecto**
   ```bash
   npm run dev
   ```

## 🔥 Configuración de Firebase

### 1. Crear proyecto Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto
3. Habilita Authentication → Sign-in method → Email/Password
4. Crea una base de datos Firestore en modo test

### 2. Configurar el proyecto
Crea `src/services/firebase.ts` con tu configuración:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  // Tu configuración aquí
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

### 3. Crear datos de prueba

#### Usuarios (Firebase Auth + Firestore)
1. Crea usuarios en Firebase Auth con estos emails
2. En Firestore, crea documentos en la colección `users` usando el UID como ID:

**Admin** (ID del documento = UID de Firebase Auth)
```json
{
  "email": "admin@bar.com",
  "displayName": "Administrador Principal",
  "role": "admin",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Mesero** (ID del documento = UID de Firebase Auth)
```json
{
  "email": "mesero@bar.com",
  "displayName": "Juan Pérez",
  "role": "waiter",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

**Cocina** (ID del documento = UID de Firebase Auth)
```json
{
  "email": "cocina@bar.com",
  "displayName": "Chef Mario",
  "role": "kitchen",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### Mesas (Colección `tables`)
```json
{
  "number": 1,
  "capacity": 4,
  "status": "libre",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### Productos (Colección `products`)
```json
{
  "name": "Cerveza Corona",
  "description": "Cerveza clara mexicana 355ml",
  "price": 45,
  "category": "Bebida",
  "available": true,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

## 👥 Roles y Funcionalidades

### 🔧 Admin
- ✅ Gestión completa de productos (CRUD)
- ✅ Gestión de mesas
- ✅ Vista general del sistema
- ✅ Dashboard con métricas

### 👨‍💼 Mesero
- ✅ Gestionar mesas asignadas
- ✅ Tomar órdenes
- ✅ Procesar checkout y pagos
- ✅ Vista de mesas en tiempo real

### 👨‍🍳 Cocina
- ✅ Ver órdenes pendientes
- ✅ Sistema Kanban (Pendiente → En Preparación → Listo)
- ✅ Actualizar estado de items
- ✅ Notificaciones en tiempo real

## 🔐 Credenciales de Desarrollo

```
Admin:    admin@bar.com    / password123
Mesero:   mesero@bar.com   / password123
Cocina:   cocina@bar.com   / password123
```

## 📜 Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run preview  # Preview del build
npm run lint     # Linting con ESLint
```

## 🎨 Personalización

### Colores del tema
El proyecto usa Tailwind CSS con un tema oscuro personalizado. Los colores principales están en `tailwind.config.ts`.

### Componentes UI
Todos los componentes base están en `src/components/ui/` y son completamente reutilizables.

## 🐛 Solución de Problemas

### Tailwind CSS no funciona
1. Verifica que `postcss.config.js` tenga la configuración correcta
2. Asegúrate de que `src/index.css` importe Tailwind
3. Reinicia el servidor de desarrollo

### Errores de Firebase
1. Verifica la configuración en `firebase.ts`
2. Asegúrate de que las reglas de Firestore permitan lectura/escritura
3. Verifica que Authentication esté habilitado

### Errores de TypeScript
1. Ejecuta `npm run build` para ver todos los errores
2. Verifica que todos los tipos estén correctamente importados
3. Asegúrate de usar `type` imports para tipos

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Agregar nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.