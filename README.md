# BarPos — Sistema de Punto de Venta para Bares y Restaurantes

Sistema POS completo y en tiempo real para bares y restaurantes. Gestión de mesas, control de cocina/barra, cobros, reportes, inventario y más.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript |
| Build | Vite |
| Estilos | Tailwind CSS + Lucide Icons |
| Backend / DB | Firebase + Firestore |
| Auth | Firebase Authentication |
| Impresión | react-to-print |
| Notificaciones | React Hot Toast |
| Deploy | Vercel + Firebase Hosting |

---

## Roles de Usuario

El sistema tiene tres roles con acceso diferenciado:

- **Admin** — Acceso completo: mesas, reportes, productos, configuración
- **Mesero / Capitán** — Gestión de sus mesas asignadas, órdenes y cobros
- **Cocina / Barra** — Vista Kanban de pedidos, impresión automática, inventario

---

## Módulos y Funcionalidades

### Autenticación
- Login unificado con redirección automática por rol
- Control de usuarios activos/inactivos
- Verificación por PIN para operaciones críticas

---

### Gestión de Mesas
- Estado en tiempo real: libre, ocupada, reservada, limpieza
- Mapa visual del local con representación interactiva por mesa
- Vista de cuadrícula alternativa (cards)
- Asignación de mesas a meseros
- Meseros solo ven sus mesas asignadas
- Indicadores de reservaciones sobre las tarjetas de mesa

---

### Gestión de Órdenes
- Crear órdenes y asignarlas a mesas
- Agregar productos desde catálogo por categoría
- Seguimiento del estado por ítem: pendiente / entregado
- Notas especiales por ítem
- Motivo de cancelación al eliminar ítems con registro de quién lo hizo
- Modal para dividir órdenes (Split Order)
- Modal para cambiar/sustituir productos (Swap Service)
- Modal de cantidad para botellas

---

### Catálogo de Productos
- Categorías: Bebida, Botella, Shot, Servicio, Entrada, Comida, Postre
- Toggle de disponibilidad por producto
- Gestión de precios, imágenes y descripciones
- CRUD completo (crear, ver, editar, eliminar)

---

### Promociones y Descuentos
- 5 tipos de descuento:
  - Porcentaje
  - Monto fijo
  - 2×1
  - N unidades por precio fijo
  - Precio fijo por unidad
- Aplicar por categoría o productos específicos
- Horario de corte configurable (por hora del día)
- Aplicación automática al abrir el checkout

---

### Kanban de Cocina y Barra
- Tablero en tiempo real separado por estación (cocina / barra)
- Flujo: Pendiente → Entregado
- Sonido de notificación para nuevos pedidos (toggle activable por usuario)
- Integración con impresión automática al recibir nuevas órdenes
- Retención de 5 minutos para ítems ya entregados
- Disponible para Admin, Mesero y Cocina

---

### Checkout y Cobro
- Métodos de pago: Efectivo, Tarjeta, Transferencia, Mixto
- Propinas configurables por porcentaje o monto personalizado
- Aplicación automática de promociones activas
- Registro del número de operación para pagos con tarjeta
- Conteo de personas para cargo de servicio
- Comentarios del admin sobre la orden
- Impresión de ticket al cerrar (58mm u 80mm)

---

### Reportes y Analítica

**Resumen Diario (Cierre)**
- Total del día desglosado por método de pago
- Desglose de propinas
- Historial de tickets cerrados

**Corte de Ventas**
- Vista de ventas del turno o periodo seleccionado

**Analytics**
- Filtro por rango de fechas: día, semana, mes o personalizado
- Desglose de ventas por categoría con íconos
- Seguimiento de ventas por mesero
- Paginación configurable

**Mis Ventas (Mesero)**
- Ventas personales del mesero autenticado en el turno actual

---

### Reservaciones
- Reservar mesas con fecha y hora
- Tamaño de grupo (pax) y nivel de prioridad
- Estados: pendiente, aceptada, llegó, cancelada
- Notas por reservación
- Vista en tabla con filtros por estado

---

### Inventario
- Control de niveles de inventario por producto
- Estadísticas de inventario por categoría
- Vista disponible también para cocina

---

### Impresión de Tickets
- Impresión manual desde el checkout
- Impresión automática al llegar pedidos a cocina/barra
- Selección de estación destino (cocina o barra)
- Tamaños de papel: 58mm (thermal) y 80mm
- Formato de ticket personalizado

---

### Configuración del Negocio
- Nombre del negocio y URL del logo
- Datos de contacto (dirección, teléfono)
- Configuración almacenada en Firestore (`general`)

---

## Estructura del Proyecto

```
src/
├── contexts/          # AuthContext (autenticación global)
├── hooks/             # useOrders, useTables, useProducts, usePromotions, etc.
├── layouts/           # AdminLayout, WaiterLayout, KitchenLayout
├── pages/
│   ├── admin/         # Panel completo del admin
│   ├── waiter/        # Vistas del mesero
│   └── kitchen/       # Vistas de cocina/barra
├── routes/            # ProtectedRoute por rol
├── services/          # Firebase, Firestore, orderService, printQueueService
└── utils/             # Tipos TypeScript, constantes, helpers
```

---

## Estructura de Firestore

| Colección | Descripción |
|---|---|
| `users` | Cuentas de usuario con rol y estado activo |
| `tables` | Mesas del local con estado y mesero asignado |
| `products` | Catálogo de productos con categoría y precio |
| `orders` | Órdenes con ítems, pagos, propinas y estado |
| `promotions` | Reglas de descuento con horario y tipo |
| `reservations` | Reservaciones con estado y prioridad |
| `general` | Configuración global del negocio |

---

## Variables de Entorno

Crear un archivo `.env` en la raíz con las credenciales de Firebase:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## Instalación y Desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Build de producción
npm run build

# Vista previa del build
npm run preview

# Linter
npm run lint
```

---

## Workstations por Categoría

| Estación | Categorías |
|---|---|
| Barra | Bebida, Botella, Shot, Servicio |
| Cocina | Entrada, Comida, Postre |

---

## Rutas Principales

| Ruta | Descripción |
|---|---|
| `/login` | Login unificado |
| `/admin/home` | Dashboard de mesas (admin) |
| `/admin/kanban/cocina` | Kanban de cocina (admin) |
| `/admin/kanban/barra` | Kanban de barra (admin) |
| `/admin/cierre` | Resumen diario / cierre |
| `/admin/ventas` | Corte de ventas |
| `/admin/analytics` | Dashboard de analítica |
| `/admin/manage-products` | Gestión de productos |
| `/admin/promotions` | Gestión de promociones |
| `/admin/inventory` | Inventario |
| `/admin/settings` | Configuración del negocio |
| `/waiter/home` | Mesas del mesero |
| `/waiter/kanban` | Kanban personal del mesero |
| `/waiter/mis-ventas` | Ventas personales |
| `/kitchen/cocina` | Kanban de cocina |
| `/kitchen/barra` | Kanban de barra |
