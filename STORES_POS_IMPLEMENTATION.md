# ✅ Nueva Funcionalidad: Gestión de Sucursales y Cajas (Stores & POS)

## 📋 Resumen de Implementación

Se ha implementado exitosamente un sistema completo de gestión de **Sucursales (Stores)** y **Cajas (POS)** para cumplir con los requerimientos de certificación de Mercado Pago Point.

---

## 🎯 Objetivo

Cumplir con las acciones recomendadas por Mercado Pago:
- ✅ **Administración de sucursales**: Gestionar sucursales mediante API
- ✅ **Administración de cajas**: Interfaz para crear, editar y eliminar cajas vía API

---

## 📁 Archivos Creados/Modificados

### 📄 Archivos Nuevos

1. **`MERCADOPAGO_STORES_POS.md`**
   - Documentación completa de las APIs
   - Ejemplos de requests/responses
   - Jerarquía: Usuario → Sucursal → Caja → Terminal
   - Reglas y validaciones importantes

2. **`src/services/mercadoPagoStoresService.ts`**
   - Servicio completo para gestionar Stores y POS
   - Funciones CRUD para ambas entidades
   - Tipos TypeScript completos
   - Validaciones (horarios, eliminación, etc.)
   - Utilidades: `getStoresWithPOS()`, `canDeleteStore()`, `getMCCCategoryName()`

3. **`src/components/common/StoreModal.tsx`**
   - Modal para crear/editar sucursales
   - Formulario completo con:
     - Información básica (nombre, ID externo)
     - Ubicación (calle, ciudad, estado, coordenadas GPS)
     - Horarios de operación por día de la semana
   - Validación de horarios (formato HH:MM)

4. **`src/components/common/POSModal.tsx`**
   - Modal para crear/editar cajas
   - Campos:
     - Nombre de la caja
     - Sucursal asociada (no editable después de crear)
     - Categoría MCC (621102: Restaurante/Bar, 5812: Restaurante, etc.)
     - Monto fijo (checkbox)
     - ID externo

### 📝 Archivos Modificados

1. **`src/pages/admin/Settings.tsx`**
   - Nueva pestaña: **"Sucursales y Cajas"**
   - UI completa con:
     - Lista de sucursales con sus cajas
     - Botones para crear/editar/eliminar
     - Estado actual (total sucursales, total cajas)
     - Información de horarios y ubicación
     - Tarjetas de cajas con detalles (categoría MCC, monto fijo, etc.)
   - Funciones:
     - `refreshStores()`: Recargar desde API
     - `handleDeleteStore()`: Eliminar sucursal (valida que no tenga cajas)
     - `handleDeletePOS()`: Eliminar caja
   - useEffect para cargar datos al cambiar de pestaña

2. **`README.md`**
   - Agregada característica en la lista principal
   - Nueva sección en "Configuración Avanzada"
   - Enlace a documentación completa

---

## 🔗 APIs Implementadas

### Sucursales (Stores)
- ✅ `GET /stores/{id}` - Obtener una sucursal
- ✅ `GET /users/{user_id}/stores/search` - Buscar todas las sucursales
- ✅ `POST /users/{user_id}/stores` - Crear sucursal
- ✅ `PUT /users/{user_id}/stores/{id}` - Actualizar sucursal
- ✅ `DELETE /users/{user_id}/stores/{id}` - Eliminar sucursal

### Cajas (POS)
- ✅ `GET /pos/{id}` - Obtener una caja
- ✅ `GET /pos` - Buscar todas las cajas
- ✅ `POST /pos` - Crear caja
- ✅ `PUT /pos/{id}` - Actualizar caja
- ✅ `DELETE /pos/{id}` - Eliminar caja

---

## 🎨 UI/UX

### Pestaña "Sucursales y Cajas"

#### Header
- **Título**: "🏪 Gestión de Sucursales y Cajas"
- **Botones**:
  - 🔄 Actualizar (recarga desde API)
  - ➕ Nueva Sucursal
- **Estado**: Muestra total de sucursales, total de cajas, User ID

#### Lista de Sucursales
Cada sucursal muestra:
- 🏪 Nombre y emoji
- 📍 Dirección completa
- 📝 Referencia (si existe)
- 🆔 Store ID y External ID
- 🕐 Horarios de operación (resumido por día)
- Botones: ✏️ Editar | 🗑️ Eliminar

#### Lista de Cajas (dentro de cada sucursal)
- Header con contador: "💰 Cajas (X)"
- Botón: ➕ Nueva Caja
- Tarjetas con:
  - 💳 Nombre
  - Categoría MCC (ej: "Restaurante/Bar")
  - Código MCC (ej: 621102)
  - Monto fijo: ✓ Sí / ✗ No
  - ID Externo (si existe)
  - Botones: ✏️ Editar | 🗑️ Eliminar

#### Información Adicional
Panel azul con reglas importantes:
- Jerarquía del sistema
- Restricción: No eliminar sucursal con cajas
- Restricción: No cambiar sucursal de una caja
- Info sobre asociación de terminales físicas

---

## 🔒 Validaciones Implementadas

### Sucursales
- ✅ Nombre obligatorio
- ✅ Dirección completa (calle, número, ciudad, estado)
- ✅ Horarios con formato HH:MM
- ✅ Validación: apertura < cierre
- ✅ **No se puede eliminar** si tiene cajas asociadas

### Cajas
- ✅ Nombre obligatorio
- ✅ Sucursal obligatoria
- ✅ Categoría MCC válida
- ✅ **No se puede cambiar** la sucursal después de crear
- ✅ Validación: debe existir al menos una sucursal

---

## 🚀 Categorías MCC Soportadas

```typescript
export const MCC_CATEGORIES = {
  RESTAURANT_BAR: 621102,  // Restaurante/Bar
  RESTAURANT: 5812,         // Restaurante
  BAR: 5813,                // Bar/Cantina
  FAST_FOOD: 5814,          // Comida Rápida
}
```

---

## 📖 Cómo Usar

### 1. Acceder a la funcionalidad
```
Admin Panel → Settings → Pestaña "Sucursales y Cajas"
```

### 2. Crear una Sucursal
1. Click en "➕ Nueva Sucursal"
2. Completar formulario:
   - Nombre (ej: "Sucursal Centro")
   - Dirección completa
   - Horarios de operación
   - (Opcional) Coordenadas GPS
   - (Opcional) ID externo
3. Click en "➕ Crear Sucursal"

### 3. Crear una Caja
1. Dentro de una sucursal, click en "➕ Nueva Caja"
2. Completar formulario:
   - Nombre (ej: "Caja Principal")
   - Seleccionar sucursal
   - Categoría MCC (621102 para Restaurante/Bar)
   - Monto fijo (opcional)
   - ID externo (opcional)
3. Click en "➕ Crear Caja"

### 4. Editar/Eliminar
- Usar botones ✏️ Editar o 🗑️ Eliminar en cada tarjeta
- Sistema valida automáticamente antes de eliminar

---

## ⚙️ Configuración Requerida

Asegúrate de tener en `.env`:
```env
VITE_MERCADOPAGO_ACCESS_TOKEN=APP_USR-tu-access-token
VITE_MERCADOPAGO_USER_ID=tu-user-id
```

---

## 📚 Documentación Adicional

- **Documentación completa**: [`MERCADOPAGO_STORES_POS.md`](./MERCADOPAGO_STORES_POS.md)
- **API Reference Stores**: https://www.mercadopago.com.mx/developers/es/reference/stores
- **API Reference POS**: https://www.mercadopago.com.mx/developers/es/reference/pos

---

## ✅ Checklist de Certificación

Para completar la certificación de Mercado Pago Point:

- [x] Implementar CRUD completo de Sucursales (Stores)
- [x] Implementar CRUD completo de Cajas (POS)
- [x] Mostrar lista de sucursales con sus cajas asociadas
- [x] Permitir crear/editar/eliminar desde la interfaz
- [x] Manejar errores correctamente (ej: eliminar sucursal con cajas)
- [x] Validar datos antes de enviar a la API
- [x] Interfaz amigable y profesional
- [x] Documentación completa

---

## 🎯 Flujo de Trabajo Completo

```
1. Usuario crea Sucursal mediante UI
   ↓
2. Sistema hace POST a /users/{user_id}/stores
   ↓
3. Mercado Pago crea la sucursal y devuelve ID
   ↓
4. Usuario crea Caja asociada a la Sucursal
   ↓
5. Sistema hace POST a /pos con store_id
   ↓
6. Mercado Pago crea la caja y devuelve ID
   ↓
7. Usuario asocia Terminal física a la Caja (desde panel MP o API)
   ↓
8. Terminal lista para recibir órdenes desde el sistema
```

---

## 🏆 Resultado

Sistema completamente funcional para gestionar la infraestructura de Mercado Pago Point, cumpliendo con todos los requerimientos de certificación. La UI es intuitiva, con validaciones robustas y manejo de errores apropiado.

**Estado**: ✅ **LISTO PARA PRODUCCIÓN**
