# Mercado Pago - Gestión de Sucursales y Cajas (Stores & POS)

## 📋 Descripción General

Este documento describe las APIs de Mercado Pago para administrar **Sucursales (Stores)** y **Cajas (POS - Point of Sale)**. Esta gestión es un **requerimiento obligatorio** para la certificación de Mercado Pago Point.

### ¿Por qué es importante?

- **Acción recomendada - Administración de sucursales**: Asegúrate de crear tus sucursales por API
- **Acción recomendada - Administración de cajas**: Contar con una interfaz que permite crear, editar y eliminar cajas vía API ayuda a mejorar la experiencia de uso de Mercado Pago

---

## 🏪 API de Sucursales (Stores)

### 1. Obtener una Sucursal

**Endpoint:** `GET /stores/{id}`

**Descripción:** Obtiene los detalles de una sucursal específica.

**URL:** `https://api.mercadopago.com/stores/{id}`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Parámetros de Path:**
- `id` (string, requerido): ID de la sucursal

**Respuesta exitosa (200):**
```json
{
  "id": "123456",
  "name": "Sucursal Centro",
  "date_creation": "2024-01-15T10:30:00.000-04:00",
  "business_hours": {
    "monday": [
      {
        "open": "09:00",
        "close": "18:00"
      }
    ],
    "tuesday": [
      {
        "open": "09:00",
        "close": "18:00"
      }
    ]
  },
  "location": {
    "street_number": "123",
    "street_name": "Av. Principal",
    "city_name": "Ciudad de México",
    "state_name": "CDMX",
    "latitude": 19.4326,
    "longitude": -99.1332,
    "reference": "Entre calles A y B"
  },
  "external_id": "SUC001"
}
```

---

### 2. Crear una Sucursal

**Endpoint:** `POST /users/{user_id}/stores`

**Descripción:** Crea una nueva sucursal para el usuario.

**URL:** `https://api.mercadopago.com/users/{user_id}/stores`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Parámetros de Path:**
- `user_id` (string, requerido): ID del usuario de Mercado Pago

**Body (application/json):**
```json
{
  "name": "Sucursal Centro",
  "business_hours": {
    "monday": [
      {
        "open": "09:00",
        "close": "18:00"
      }
    ],
    "tuesday": [
      {
        "open": "09:00",
        "close": "18:00"
      }
    ],
    "wednesday": [
      {
        "open": "09:00",
        "close": "18:00"
      }
    ],
    "thursday": [
      {
        "open": "09:00",
        "close": "18:00"
      }
    ],
    "friday": [
      {
        "open": "09:00",
        "close": "18:00"
      }
    ],
    "saturday": [
      {
        "open": "10:00",
        "close": "14:00"
      }
    ],
    "sunday": []
  },
  "location": {
    "street_number": "123",
    "street_name": "Av. Principal",
    "city_name": "Ciudad de México",
    "state_name": "CDMX",
    "latitude": -23.5505199,
    "longitude": -46.6333094,
    "reference": "Entre calles A y B"
  },
  "external_id": "SUC001"
}
```

**Campos:**
- `name` (string, requerido): Nombre de la sucursal
- `business_hours` (object): Horarios de operación por día de la semana
- `location` (object, requerido): Ubicación de la sucursal
- `external_id` (string, opcional): ID externo para tu referencia

**Respuesta exitosa (201):**
```json
{
  "id": "123456",
  "name": "Sucursal Centro",
  "date_creation": "2024-01-15T10:30:00.000-04:00",
  "business_hours": { ... },
  "location": { ... },
  "external_id": "SUC001"
}
```

---

### 3. Buscar Sucursales

**Endpoint:** `GET /users/{user_id}/stores/search`

**Descripción:** Busca todas las sucursales de un usuario.

**URL:** `https://api.mercadopago.com/users/{user_id}/stores/search`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Parámetros de Path:**
- `user_id` (string, requerido): ID del usuario de Mercado Pago

**Parámetros de Query (opcionales):**
- `offset` (integer): Número de elementos a saltar (paginación)
- `limit` (integer): Número máximo de resultados (default: 50, max: 50)

**Respuesta exitosa (200):**
```json
{
  "results": [
    {
      "id": "123456",
      "name": "Sucursal Centro",
      "date_creation": "2024-01-15T10:30:00.000-04:00",
      "business_hours": { ... },
      "location": { ... },
      "external_id": "SUC001"
    },
    {
      "id": "123457",
      "name": "Sucursal Norte",
      "date_creation": "2024-01-20T14:00:00.000-04:00",
      "business_hours": { ... },
      "location": { ... },
      "external_id": "SUC002"
    }
  ],
  "paging": {
    "total": 2,
    "offset": 0,
    "limit": 50
  }
}
```

---

### 4. Actualizar una Sucursal

**Endpoint:** `PUT /users/{user_id}/stores/{id}`

**Descripción:** Actualiza los datos de una sucursal existente.

**URL:** `https://api.mercadopago.com/users/{user_id}/stores/{id}`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Parámetros de Path:**
- `user_id` (string, requerido): ID del usuario de Mercado Pago
- `id` (string, requerido): ID de la sucursal

**Body (application/json):**
```json
{
  "name": "Sucursal Centro Actualizada",
  "business_hours": {
    "monday": [
      {
        "open": "08:00",
        "close": "20:00"
      }
    ]
  },
  "location": {
    "street_number": "456",
    "street_name": "Av. Secundaria",
    "city_name": "Ciudad de México",
    "state_name": "CDMX",
    "latitude": -23.5505199,
    "longitude": -46.6333094,
    "reference": "Nueva referencia"
  },
  "external_id": "SUC001_UPDATED"
}
```

**Respuesta exitosa (200):**
```json
{
  "id": "123456",
  "name": "Sucursal Centro Actualizada",
  "date_creation": "2024-01-15T10:30:00.000-04:00",
  "business_hours": { ... },
  "location": { ... },
  "external_id": "SUC001_UPDATED"
}
```

---

### 5. Eliminar una Sucursal

**Endpoint:** `DELETE /users/{user_id}/stores/{id}`

**Descripción:** Elimina una sucursal. **Nota:** No se puede eliminar una sucursal que tenga cajas (POS) asociadas.

**URL:** `https://api.mercadopago.com/users/{user_id}/stores/{id}`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Parámetros de Path:**
- `user_id` (string, requerido): ID del usuario de Mercado Pago
- `id` (string, requerido): ID de la sucursal

**Respuesta exitosa (200):**
```json
{
  "id": "123456",
  "status": "deleted"
}
```

**Error común (400):**
```json
{
  "message": "Cannot delete store with associated POS",
  "error": "bad_request",
  "status": 400
}
```

---

## 💰 API de Cajas/POS (Point of Sale)

### 1. Crear una Caja

**Endpoint:** `POST /pos`

**Descripción:** Crea una nueva caja asociada a una sucursal.

**URL:** `https://api.mercadopago.com/pos`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Body (application/json):**
```json
{
  "name": "Caja Principal",
  "fixed_amount": true,
  "category": 621102,
  "store_id": "123456",
  "external_id": "CAJA001"
}
```

**Campos:**
- `name` (string, requerido): Nombre de la caja
- `fixed_amount` (boolean, opcional): Si acepta solo montos fijos
- `category` (integer, requerido): Categoría MCC (código de categoría de comercio)
- `store_id` (string, requerido): ID de la sucursal a la que pertenece
- `external_id` (string, opcional): ID externo para tu referencia

**Categorías MCC comunes:**
- `621102` - Restaurantes y bares
- `5812` - Restaurantes de comida
- `5813` - Bares y cantinas
- `5814` - Restaurantes de comida rápida

**Respuesta exitosa (201):**
```json
{
  "id": "789012",
  "name": "Caja Principal",
  "fixed_amount": true,
  "category": 621102,
  "store_id": "123456",
  "external_id": "CAJA001",
  "date_created": "2024-01-15T10:30:00.000-04:00"
}
```

---

### 2. Obtener todas las Cajas

**Endpoint:** `GET /pos`

**Descripción:** Obtiene la lista de todas las cajas del usuario.

**URL:** `https://api.mercadopago.com/pos`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Parámetros de Query (opcionales):**
- `store_id` (string): Filtrar por ID de sucursal
- `offset` (integer): Número de elementos a saltar (paginación)
- `limit` (integer): Número máximo de resultados

**Respuesta exitosa (200):**
```json
{
  "results": [
    {
      "id": "789012",
      "name": "Caja Principal",
      "fixed_amount": true,
      "category": 621102,
      "store_id": "123456",
      "external_id": "CAJA001",
      "date_created": "2024-01-15T10:30:00.000-04:00"
    },
    {
      "id": "789013",
      "name": "Caja Secundaria",
      "fixed_amount": false,
      "category": 621102,
      "store_id": "123456",
      "external_id": "CAJA002",
      "date_created": "2024-01-16T11:00:00.000-04:00"
    }
  ],
  "paging": {
    "total": 2,
    "offset": 0,
    "limit": 50
  }
}
```

---

### 3. Obtener una Caja específica

**Endpoint:** `GET /pos/{id}`

**Descripción:** Obtiene los detalles de una caja específica.

**URL:** `https://api.mercadopago.com/pos/{id}`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Parámetros de Path:**
- `id` (string, requerido): ID de la caja

**Respuesta exitosa (200):**
```json
{
  "id": "789012",
  "name": "Caja Principal",
  "fixed_amount": true,
  "category": 621102,
  "store_id": "123456",
  "external_id": "CAJA001",
  "date_created": "2024-01-15T10:30:00.000-04:00"
}
```

---

### 4. Actualizar una Caja

**Endpoint:** `PUT /pos/{id}`

**Descripción:** Actualiza los datos de una caja existente.

**URL:** `https://api.mercadopago.com/pos/{id}`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

**Parámetros de Path:**
- `id` (string, requerido): ID de la caja

**Body (application/json):**
```json
{
  "name": "Caja Principal Actualizada",
  "fixed_amount": false,
  "category": 621102,
  "external_id": "CAJA001_UPDATED"
}
```

**Nota:** No se puede cambiar el `store_id` de una caja existente.

**Respuesta exitosa (200):**
```json
{
  "id": "789012",
  "name": "Caja Principal Actualizada",
  "fixed_amount": false,
  "category": 621102,
  "store_id": "123456",
  "external_id": "CAJA001_UPDATED",
  "date_created": "2024-01-15T10:30:00.000-04:00"
}
```

---

### 5. Eliminar una Caja

**Endpoint:** `DELETE /pos/{id}`

**Descripción:** Elimina una caja del sistema.

**URL:** `https://api.mercadopago.com/pos/{id}`

**Headers:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

**Parámetros de Path:**
- `id` (string, requerido): ID de la caja

**Respuesta exitosa (200):**
```json
{
  "id": "789012",
  "status": "deleted"
}
```

---

## 🔗 Relación entre Stores y POS

### Jerarquía
```
User (Usuario de Mercado Pago)
└── Store (Sucursal)
    └── POS (Caja/Punto de Venta)
        └── Device (Terminal Física)
```

### Reglas importantes:

1. **Una Sucursal puede tener múltiples Cajas**
2. **Una Caja pertenece a una sola Sucursal**
3. **No se puede eliminar una Sucursal con Cajas asociadas** (primero eliminar las cajas)
4. **No se puede cambiar la Sucursal de una Caja** (crear nueva caja en la otra sucursal)
5. **Las Terminales físicas se asocian a una Caja específica**

---

## 📝 Implementación en el Sistema

### Flujo recomendado:

1. **Crear Sucursales** primero (con ubicación y horarios)
2. **Crear Cajas** asociadas a las sucursales
3. **Asociar Terminales** (devices) a las cajas mediante el panel de Mercado Pago o API

### Validaciones necesarias:

- ✅ Verificar que existe el `user_id` antes de crear/modificar
- ✅ Validar que la sucursal existe antes de crear una caja
- ✅ Verificar que no hay cajas asociadas antes de eliminar una sucursal
- ✅ Validar horarios de negocio (formato HH:MM)
- ✅ Validar categoría MCC válida
- ✅ Coordenadas GPS válidas para ubicación

---

## 🚀 Endpoints Base

**Producción:**
```
https://api.mercadopago.com
```

**Autenticación:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

---

## 🎯 Requerimientos para Certificación

Para completar la certificación de Mercado Pago Point, debes:

1. ✅ Implementar CRUD completo de Sucursales (Stores)
2. ✅ Implementar CRUD completo de Cajas (POS)
3. ✅ Mostrar lista de sucursales con sus cajas asociadas
4. ✅ Permitir crear/editar/eliminar desde la interfaz
5. ✅ Manejar errores correctamente (ej: eliminar sucursal con cajas)
6. ✅ Validar datos antes de enviar a la API

---

## 📚 Referencias

- [Documentación oficial de Stores API](https://www.mercadopago.com.mx/developers/es/reference/stores/_stores_id/get)
- [Documentación oficial de POS API](https://www.mercadopago.com.mx/developers/es/reference/pos/_pos/post)
- [Guía de integración Mercado Pago Point](https://www.mercadopago.com.mx/developers/es/docs/mp-point/landing)
