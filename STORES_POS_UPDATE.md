# 🔧 Actualización: APIs de Stores y POS según Documentación Oficial

## 📋 Cambios Realizados

Se adaptaron las funciones del servicio `mercadoPagoStoresService.ts` para que coincidan exactamente con los ejemplos de curl de la documentación oficial de Mercado Pago.

---

## 🔄 Cambios en las Funciones

### 1. **searchStores()** - Búsqueda de Sucursales

**Antes:**
```typescript
searchStores(offset: number = 0, limit: number = 50)
```

**Ahora:**
```typescript
searchStores(params?: {
  offset?: number;
  limit?: number;
  external_id?: string;  // NUEVO: buscar por ID externo
})
```

**Curl de referencia:**
```bash
curl -X GET 'https://api.mercadopago.com/users/123456786/stores/search?external_id=SUC001'
```

**Beneficios:**
- ✅ Soporte para búsqueda por `external_id`
- ✅ Query params opcionales más flexibles
- ✅ Coincide exactamente con la API oficial

---

### 2. **searchPOS()** - Búsqueda de Cajas

**Antes:**
```typescript
searchPOS(storeId?: string, offset: number = 0, limit: number = 50)
```

**Ahora:**
```typescript
searchPOS(params?: {
  store_id?: string;
  external_id?: string;  // NUEVO: buscar por ID externo
  offset?: number;
  limit?: number;
})
```

**Curl de referencia:**
```bash
curl -X GET 'https://api.mercadopago.com/pos?external_id=SUC001POS001'
```

**Beneficios:**
- ✅ Soporte para búsqueda por `external_id`
- ✅ Parámetros más descriptivos (`store_id` en lugar de `storeId`)
- ✅ Coincide con la API oficial

---

### 3. **Tipos de POS** - Nuevos Campos

**Agregado campo `external_store_id`:**

```typescript
export interface POS {
  id: string;
  name: string;
  fixed_amount?: boolean;
  category: number;
  store_id: string;
  external_id?: string;
  external_store_id?: string;  // ✨ NUEVO
  date_created?: string;
}

export interface CreatePOSPayload {
  name: string;
  fixed_amount?: boolean;
  category: number;
  store_id: string;
  external_id?: string;
  external_store_id?: string;  // ✨ NUEVO
}
```

**Curl de referencia:**
```bash
curl -X POST 'https://api.mercadopago.com/pos' -d '{
  "name": "First POS",
  "fixed_amount": false,
  "store_id": 1234567,
  "external_store_id": "SUC001",  // ← Campo adicional
  "external_id": "SUC001POS001",
  "category": 621102
}'
```

**Beneficios:**
- ✅ Permite referencia cruzada con el ID externo de la sucursal
- ✅ Facilita la sincronización con sistemas externos

---

### 4. **Validación de Access Token**

**Actualizada validación para aceptar tokens TEST:**

```typescript
// Antes:
if (!CONFIG.accessToken || !CONFIG.accessToken.includes('APP_'))

// Ahora:
if (!CONFIG.accessToken || (!CONFIG.accessToken.includes('APP_') && !CONFIG.accessToken.includes('TEST-')))
```

**Beneficio:**
- ✅ Funciona correctamente en ambiente sandbox con tokens TEST-

---

## 📝 Logs Detallados Agregados

### Al inicializar el módulo:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚙️ Mercado Pago Stores Service - Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 User ID: 5769151890028796
🔑 Access Token: TEST-5769151890028... (82 chars)
🌐 API Base: /api/mercadopago
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### En cada request:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔵 Mercado Pago API Request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Full URL: /api/mercadopago/users/5769151890028796/stores/search
📍 Endpoint: /users/5769151890028796/stores/search
🔧 Method: GET
🔑 Authorization: Bearer TEST-576915189002...
👤 User ID: 5769151890028796
📋 Headers: {
  "Authorization": "Bearer TEST-...",
  "Content-Type": "application/json"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### En la respuesta:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Response Status: 200 OK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 Response Data: { ... }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### En errores:
```
❌ Request Failed
Status: 403
Error: forbidden
Message: You don't have permission to perform this operation...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎨 Cambios en la UI

### POSModal.tsx - Nuevo Campo

Agregado campo para `external_store_id`:

```tsx
<div>
  <label>ID Externo de Sucursal (opcional)</label>
  <input
    value={externalStoreId}
    onChange={(e) => setExternalStoreId(e.target.value)}
    placeholder="Ej: SUC001"
  />
  <p>ID externo de la sucursal para referencia cruzada</p>
</div>
```

---

## 🔍 Diagnóstico del Error 403

Con los logs detallados ahora puedes ver:

1. **✅ URL exacta** que se está llamando
2. **✅ Headers completos** enviados
3. **✅ User ID y Access Token** usados
4. **✅ Response completa** del servidor

### Posibles causas del error 403:

1. **Permisos del Access Token**
   - El token debe tener scopes para gestionar stores/pos
   - Verifica en el panel de Mercado Pago

2. **User ID incorrecto**
   - Debe coincidir con el owner del token

3. **Ambiente (Sandbox vs Producción)**
   - Algunos endpoints pueden no estar disponibles en sandbox
   - Verifica si necesitas usar producción

4. **Aplicación no verificada**
   - Mercado Pago puede requerir verificación de la app

---

## ✅ Endpoints Actualizados

### Sucursales (Stores)
- ✅ `GET /stores/{id}` - Obtener sucursal
- ✅ `GET /users/{user_id}/stores/search?external_id=X` - Buscar sucursales
- ✅ `POST /users/{user_id}/stores` - Crear sucursal
- ✅ `PUT /users/{user_id}/stores/{id}` - Actualizar sucursal
- ✅ `DELETE /users/{user_id}/stores/{id}` - Eliminar sucursal

### Cajas (POS)
- ✅ `GET /pos/{id}` - Obtener caja
- ✅ `GET /pos?external_id=X` - Buscar cajas
- ✅ `POST /pos` - Crear caja (con `external_store_id`)
- ✅ `PUT /pos/{id}` - Actualizar caja
- ✅ `DELETE /pos/{id}` - Eliminar caja

---

## 🚀 Cómo Probar

1. **Recarga la aplicación**
2. **Ve a Settings → Sucursales y Cajas**
3. **Abre la consola del navegador**
4. **Observa los logs detallados:**
   - Configuración al cargar
   - Request completo con headers
   - Response del servidor

5. **Copia todos los logs** y compártelos para diagnosticar el error 403

---

## 📚 Referencias de Curl

Todas las funciones ahora coinciden exactamente con estos curls oficiales:

```bash
# Obtener sucursal
GET https://api.mercadopago.com/stores/31410148

# Crear sucursal
POST https://api.mercadopago.com/users/{user_id}/stores

# Buscar sucursales
GET https://api.mercadopago.com/users/{user_id}/stores/search?external_id=SUC001

# Actualizar sucursal
PUT https://api.mercadopago.com/users/{user_id}/stores/{store_id}

# Eliminar sucursal
DELETE https://api.mercadopago.com/users/{user_id}/stores/{store_id}

# Crear caja
POST https://api.mercadopago.com/pos

# Buscar cajas
GET https://api.mercadopago.com/pos?external_id=SUC001POS001

# Obtener caja
GET https://api.mercadopago.com/pos/{pos_id}

# Actualizar caja
PUT https://api.mercadopago.com/pos/{pos_id}

# Eliminar caja
DELETE https://api.mercadopago.com/pos/{pos_id}
```

---

## 🎯 Estado Actual

**✅ Funciones actualizadas según documentación oficial**
**✅ Logs detallados para debugging**
**✅ Validación de tokens TEST y APP**
**✅ Soporte para external_id y external_store_id**
**✅ UI actualizada con nuevos campos**

**Listo para diagnosticar el error 403 con información completa!** 🔍
