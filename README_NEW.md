# Bar POS — Sistema de Punto de Venta para Bares y Restaurantes

Sistema de punto de venta moderno, en tiempo real, diseñado específicamente para bares y restaurantes. Construido con React 19, TypeScript, Firebase y Tailwind CSS.

## Tecnologías

| Capa | Stack |
|------|-------|
| Frontend | React 19, TypeScript, Vite 7 |
| Estilos | Tailwind CSS v3, PostCSS |
| Backend | Firebase Auth + Firestore (tiempo real) |
| Routing | React Router DOM v7 |
| UI / Iconos | Headless UI, Lucide React |
| Notificaciones | React Hot Toast |

---

## Roles y Acceso

La aplicación usa un único punto de entrada `/login` con control de acceso basado en roles:

| Rol | Ruta base | Descripción |
|-----|-----------|-------------|
| `admin` | `/admin/*` | Acceso completo al sistema |
| `waiter` | `/waiter/*` | Gestión de mesas y órdenes asignadas |
| `kitchen` | `/kitchen/cocina` | Estación de cocina (Kanban) |
| `barra` | `/kitchen/barra` | Estación de barra/bar (Kanban) |

Cada ruta está protegida con `ProtectedRoute` que valida el rol y redirige si no hay acceso.

---

## Funcionalidades Implementadas

### Panel Admin

#### Dashboard de mesas (`/admin/home`)
- Grid de mesas en tiempo real con estado visual: `libre`, `ocupada`, `reservada`, `limpieza`
- Apertura de mesa y asignación directa a mesero
- Contador de órdenes activas
- Visualización del mesero asignado y orden actual por mesa

#### Detalle de orden (`/admin/order/:tableId`)
- Agregar productos al pedido desde el catálogo
- Ajustar cantidades e ítems existentes
- Eliminar ítems con verificación por PIN (solo admin)
- Log de eliminaciones: quién eliminó, cuándo y qué ítem
- Editar nombre personalizado de mesa (ej. "Mesa de Andrea")
- Editar número de personas en la mesa (para dividir cuenta)
- Agregar comentarios internos (no aparecen en el ticket del cliente)
- Seguimiento de estado por ítem: `pendiente → en_preparacion → listo → entregado`

#### Checkout (`/admin/checkout/:orderId`)
- Cálculo automático de subtotal
- Propina con porcentajes predefinidos: 0%, 10%, 15%, 18%, 20%
- Campo de porcentaje de propina personalizado
- Métodos de pago: Efectivo, Tarjeta, Transferencia
- Cálculo de cambio para pagos en efectivo
- Desglose por persona (división de cuenta)
- Impresión de ticket térmico 80mm
- Cierre de mesa con verificación PIN

#### Kanban (`/admin/kanban`, `/admin/kanban/cocina`, `/admin/kanban/barra`)
- Tableros Kanban separados para Cocina y Barra
- Columnas: Pendiente → En Preparación → Listo → En proceso de entrega
- Notificaciones de audio para nuevos pedidos (configurable por usuario)
- Actualización de estado con un clic
- Muestra: número de mesa, mesero, hora de creación
- Retención configurable de ítems en columna "Entregado"

#### Panel de control de cocina (`/admin/panel`)
- Vista en lista como alternativa al Kanban
- Filtros por estación (cocina / barra / todas)
- Filtros por estado (todos, pendiente, listo, entregado)
- Agrupación visual por estado

#### Gestión de productos (`/admin/manage-products`)
- CRUD completo de productos
- Campos: nombre, descripción, precio, categoría, disponibilidad
- Búsqueda por nombre y descripción
- Filtrado por categoría
- 7 categorías disponibles con estación asignada:

| Categoría | Estación |
|-----------|----------|
| Bebida | Barra |
| Botella | Barra |
| Shot | Barra |
| Servicio | Barra |
| Entrada | Cocina |
| Comida | Cocina |
| Postre | Cocina |

#### Cierre de caja (`/admin/cierre`)
- Resumen de ventas del turno o día
- Total de ventas, órdenes e ítems
- Desglose por método de pago (efectivo, tarjeta, transferencia)
- Gestión de propinas:
  - Total recaudado en propinas
  - Seguimiento por mesero
  - Distribución automática: **66% mesero / 20% barra / 14% cajero**
- Estadísticas por mesero: ventas totales, promedio por orden
- Porcentaje de propina promedio
- Selección de fecha para revisión de turnos anteriores
- Turno configurado para horario bar: 5 PM – 3 AM

#### Analytics (`/admin/analytics`)
- Filtros de fecha: Día, Semana, Mes, Rango personalizado
- Desglose de ventas por categoría con indicadores visuales
- Tabla de registros: producto, cantidad, precio, mesero
- Resumen por categoría: cantidad total y revenue
- Paginación y filtrado por categoría
- Totales acumulados del periodo seleccionado

#### Historial de tickets (`/admin/tickets`)
- Listado de todas las órdenes pagadas
- Búsqueda por: ID de orden, número de mesa, mesero, nombre de mesa, comentarios
- Agrupación por fecha
- Reimpresión de cualquier ticket histórico
- Modal de detalle completo del ticket

#### Configuración (`/admin/settings`)
- **Configuración del negocio**: nombre, teléfono, dirección, URL del logo
- **Gestión de usuarios**:
  - Crear usuarios con email, contraseña, rol y PIN
  - Activar / desactivar usuarios
  - Enviar correo de restablecimiento de contraseña
  - Ver todos los usuarios por rol

---

### Panel Mesero

#### Dashboard (`/waiter/home`)
- Sección "Mis mesas" con las mesas asignadas al mesero
- Mesas libres disponibles para abrir
- Vista de mesas de otros meseros (solo lectura)
- Apertura de nueva mesa

#### Orden (`/waiter/order/:tableId`)
- Tomar pedidos para mesas asignadas
- Catálogo de productos agrupado por categoría
- Input de cantidad por ítem
- Notas especiales por ítem
- Total y desglose en tiempo real
- Seguimiento del estado de la orden

#### Checkout (`/waiter/checkout/:orderId`)
- Cálculo de cuenta con propinas
- Múltiples métodos de pago
- Impresión de ticket 80mm

---

### Estaciones de Cocina / Barra

#### Kanban (`/kitchen/cocina` o `/kitchen/barra`)
- Vista automática según el rol del usuario al iniciar sesión
- Ítems filtrados por estación correspondiente
- Flujo de estados: Pendiente → En Preparación → Listo → Entregado
- Notificaciones de audio para nuevos pedidos
- Actualización de estado con un clic
- Muestra: número de mesa, mesero asignado, hora del pedido

---

## Sistema de Impresión

Impresión de tickets en formato **80mm** con:
- Encabezado con datos del negocio (nombre, teléfono, dirección)
- ID del ticket y fecha/hora
- Listado de ítems con cantidad y precio unitario
- Subtotal, propina y total
- Método de pago y cambio (si aplica)
- Monto por persona (si hay división de cuenta)

---

## Estructura Firestore

| Colección | Descripción |
|-----------|-------------|
| `users` | Perfil, rol, PIN y estado activo |
| `tables` | Número, estado, mesero asignado, orden activa |
| `products` | Nombre, precio, categoría, disponibilidad |
| `orders` | Ítems, estado, pago, propina, personas, comentarios |
| `config` | Configuración del negocio |

### Esquema de orden (colección `orders`)

```typescript
{
  tableId: string,
  tableNumber: number,
  tableName?: string,           // nombre personalizado de la mesa
  waiterId: string,
  waiterName: string,
  peopleCount?: number,         // para división de cuenta
  adminComment?: string,        // notas internas
  items: [
    {
      id: string,
      productId: string,
      productName: string,
      productPrice: number,
      quantity: number,
      status: "pendiente" | "en_preparacion" | "listo" | "entregado",
      notes?: string,
      category: string,
      workstation: "cocina" | "barra",
      deletedAt?: timestamp,    // si fue eliminado
      deletedBy?: string,       // uid del que eliminó
      createdAt: timestamp
    }
  ],
  status: "activo" | "pagado" | "cancelado",
  subtotal: number,
  tipPercentage?: number,
  tipAmount?: number,
  total: number,
  paymentMethod?: "efectivo" | "tarjeta" | "transferencia",
  cashAmount?: number,
  change?: number,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

---

## Instalación

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd bar-pos-app
npm install
```

### 2. Configurar Firebase

Crea `src/services/firebase.ts` con tu configuración de Firebase:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

Habilita en Firebase Console:
- **Authentication** → Email/Password
- **Firestore Database** en modo producción

### 3. Crear datos iniciales

En Firestore, crea un documento en `users` con el UID del primer admin:

```json
{
  "email": "admin@bar.com",
  "displayName": "Administrador",
  "role": "admin",
  "pin": "1234",
  "active": true
}
```

A partir de ahí, los demás usuarios se crean desde la sección **Configuración → Usuarios** dentro de la app.

### 4. Ejecutar

```bash
npm run dev
```

---

## Scripts

```bash
npm run dev       # Servidor de desarrollo
npm run build     # Build de producción
npm run preview   # Preview del build
npm run lint      # ESLint
```

---

## Despliegue

El proyecto incluye `firebase.json` y `.firebaserc` para despliegue en Firebase Hosting:

```bash
npm run build
firebase deploy
```

---

## Solución de Problemas

**Tailwind no aplica estilos**
- Verifica `postcss.config.js` y que `src/index.css` importe Tailwind
- Reinicia el servidor de desarrollo

**Errores de Firebase**
- Confirma que la configuración en `firebase.ts` es correcta
- Verifica las reglas de Firestore (lectura/escritura habilitada para usuarios autenticados)

**Usuario no puede iniciar sesión**
- El campo `active: true` debe estar en el documento Firestore del usuario
- El rol debe ser exactamente: `admin`, `waiter`, `kitchen` o `barra`

---

## Licencia

MIT
