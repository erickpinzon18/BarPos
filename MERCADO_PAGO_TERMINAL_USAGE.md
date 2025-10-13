# 📱 Guía de API Mercado Pago Point - Terminales de Punto de Venta

Documentación completa para integración con terminales físicas de Mercado Pago Point usando la API de órdenes (v1/orders).

---

## 📋 Tabla de Contenido

1. [Obtener Lista de Terminales](#1-obtener-lista-de-terminales)
2. [Configurar Terminal en Modo PDV](#2-configurar-terminal-en-modo-pdv)
3. [Crear Orden de Pago](#3-crear-orden-de-pago)
4. [Consultar Estado de Orden](#4-consultar-estado-de-orden)
5. [Cancelar Orden](#5-cancelar-orden)
6. [Estados de Pago](#estados-de-pago)
7. [Notas Importantes](#notas-importantes)

---

## 1. Obtener Lista de Terminales

Obtiene todas las terminales asociadas a tu cuenta de Mercado Pago.

### **📌 Endpoint**
```
GET https://api.mercadopago.com/point/integration-api/devices
```

### **🔑 Headers**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer APP_USR-{TU_ACCESS_TOKEN}"
}
```

### **✅ Respuesta Exitosa (200 OK)**
```json
{
  "devices": [
    {
      "id": "DEVICE_ID",
      "pos_id": 123456789,
      "store_id": "987654321",
      "external_pos_id": "",
      "operating_mode": "PDV"
    }
  ]
}
```

### **📖 Referencia Oficial**
[Get Terminals - Mercado Pago Developers](https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/terminals/get-terminals/get)

---

## 2. Configurar Terminal en Modo PDV

**⚠️ IMPORTANTE:** La terminal debe estar en modo **PDV** para recibir órdenes desde la API. El modo **STANDALONE** solo permite pagos manuales desde la terminal.

### **📌 Endpoint**
```
PATCH https://api.mercadopago.com/point/integration-api/devices/{device_id}
```

### **🔑 Headers**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer APP_USR-{TU_ACCESS_TOKEN}"
}
```

### **📤 Body**
```json
{
  "operating_mode": "PDV"
}
```

### **✅ Respuesta Exitosa (200 OK)**
```json
{
  "id": "DEVICE_ID",
  "operating_mode": "PDV"
}
```

### **📝 Modos de Operación**
| Modo | Descripción |
|------|-------------|
| `PDV` | **Point of Sale** - Recibe órdenes desde API (integración) |
| `STANDALONE` | Modo independiente - Solo acepta pagos manuales |

### **📖 Referencia Oficial**
[Update Operation Mode - Mercado Pago Developers](https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/terminals/update-operation-mode/patch)

---

## 3. Crear Orden de Pago

Envía una orden de pago a la terminal física. La terminal mostrará la pantalla de cobro al cliente.

### **📌 Endpoint**
```
POST https://api.mercadopago.com/v1/orders
```

### **🔑 Headers**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer APP_USR-{TU_ACCESS_TOKEN}",
  "X-Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000"
}
```

> **💡 Idempotency Key:** UUID v4 único para evitar duplicados. Genera uno nuevo por cada orden.

### **📤 Body**
```json
{
  "type": "point",
  "external_reference": "orden_mesa_5_001",
  "description": "Orden Mesa 5 - Bar POS",
  "expiration_time": "PT3M",
  "transactions": {
    "payments": [
      {
        "amount": "10.00"
      }
    ]
  },
  "config": {
    "point": {
      "terminal_id": "DEVICE_ID",
      "print_on_terminal": "seller_ticket"
    }
  }
}
```

### **📋 Parámetros**

| Campo | Tipo | Descripción | Obligatorio |
|-------|------|-------------|-------------|
| `type` | String | Siempre `"point"` para terminales | ✅ Sí |
| `external_reference` | String | Identificador único de tu sistema (ej. `orden_123`) | ✅ Sí |
| `description` | String | Descripción visible en dashboard | ❌ No |
| `expiration_time` | String | Tiempo de expiración ISO 8601 (ej. `PT3M` = 3 minutos) | ❌ No |
| `transactions.payments[].amount` | String | Monto en pesos (ej. `"10.00"` = $10 MXN) | ✅ Sí |
| `config.point.terminal_id` | String | ID de la terminal destino | ✅ Sí |
| `config.point.print_on_terminal` | String | `seller_ticket`, `client_ticket`, `both`, `none` | ❌ No |

### **⏱️ Formatos de Expiración**
- `PT3M` → 3 minutos
- `PT5M` → 5 minutos
- `PT10M` → 10 minutos
- `PT1H` → 1 hora

### **🖨️ Opciones de Impresión**
| Valor | Descripción |
|-------|-------------|
| `seller_ticket` | Solo ticket vendedor |
| `client_ticket` | Solo ticket cliente |
| `both` | Ambos tickets |
| `none` | No imprimir |

### **✅ Respuesta Exitosa (201 Created)**
```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-123456789abc",
  "type": "point",
  "processing_mode": "automatic",
  "external_reference": "orden_mesa_5_001",
  "description": "Orden Mesa 5 - Bar POS",
  "expiration_time": "PT3M",
  "country_code": "MEX",
  "user_id": "123456789",
  "status": "created",
  "status_detail": "created",
  "currency": "MXN",
  "created_date": "2025-10-13T03:09:47.562Z",
  "last_updated_date": "2025-10-13T03:09:47.562Z",
  "integration_data": {
    "application_id": "987654321"
  },
  "transactions": {
    "payments": [
      {
        "id": "payment_123456",
        "amount": "10.00",
        "status": "created"
      }
    ]
  },
  "config": {
    "point": {
      "terminal_id": "DEVICE_ID",
      "print_on_terminal": "seller_ticket"
    }
  }
}
```

### **📖 Referencia Oficial**
[Create Order - Mercado Pago Developers](https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/orders/create-order/post)

---

## 4. Consultar Estado de Orden

Consulta el estado actual de una orden para saber si fue aprobada, está en proceso, o fue cancelada.

### **📌 Endpoint**
```
GET https://api.mercadopago.com/v1/orders/{order_id}
```

### **🔑 Headers**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer APP_USR-{TU_ACCESS_TOKEN}"
}
```

### **✅ Respuesta Exitosa (200 OK)**

#### **Estado: En Terminal (Esperando Pago)**
```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-123456789abc",
  "type": "point",
  "processing_mode": "automatic",
  "external_reference": "orden_mesa_5_001",
  "description": "Orden Mesa 5 - Bar POS",
  "expiration_time": "PT3M",
  "country_code": "MEX",
  "user_id": "123456789",
  "status": "at_terminal",
  "status_detail": "at_terminal",
  "currency": "MXN",
  "created_date": "2025-10-13T03:21:49.528Z",
  "last_updated_date": "2025-10-13T03:21:50.681Z",
  "integration_data": {
    "application_id": "987654321"
  },
  "transactions": {
    "payments": [
      {
        "id": "payment_123456",
        "amount": "10.00",
        "status": "at_terminal"
      }
    ]
  },
  "config": {
    "point": {
      "terminal_id": "DEVICE_ID",
      "print_on_terminal": "seller_ticket"
    }
  }
}
```

#### **Estado: Pagado (Aprobado)**
```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-123456789abc",
  "status": "paid",
  "status_detail": "accredited",
  "transactions": {
    "payments": [
      {
        "id": "payment_123456",
        "amount": "10.00",
        "status": "approved",
        "status_detail": "accredited"
      }
    ]
  }
}
```

### **📖 Referencia Oficial**
[Get Order - Mercado Pago Developers](https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/orders/get-order/get)

---

## 5. Cancelar Orden

Cancela una orden que aún no ha sido pagada. Útil para timeout o cancelación manual.

### **📌 Endpoint**
```
POST https://api.mercadopago.com/v1/orders/{order_id}/cancel
```

### **🔑 Headers**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer APP_USR-{TU_ACCESS_TOKEN}",
  "X-Idempotency-Key": "550e8400-e29b-41d4-a716-446655440001"
}
```

### **✅ Respuesta Exitosa (200 OK)**
```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-123456789abc",
  "type": "point",
  "processing_mode": "automatic",
  "external_reference": "orden_mesa_5_001",
  "description": "Orden Mesa 5 - Bar POS",
  "expiration_time": "PT3M",
  "country_code": "MEX",
  "user_id": "123456789",
  "status": "canceled",
  "status_detail": "canceled",
  "currency": "MXN",
  "created_date": "2025-10-13T03:09:47.562Z",
  "last_updated_date": "2025-10-13T03:10:06.128Z",
  "integration_data": {
    "application_id": "987654321"
  },
  "transactions": {
    "payments": [
      {
        "id": "payment_123456",
        "amount": "10.00",
        "status": "canceled",
        "status_detail": "canceled_by_api"
      }
    ]
  },
  "config": {
    "point": {
      "terminal_id": "DEVICE_ID",
      "print_on_terminal": "seller_ticket"
    }
  }
}
```

### **📖 Referencia Oficial**
[Cancel Order - Mercado Pago Developers](https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/orders/cancel-order/post)

---

## Estados de Pago

### **📊 Estados de Orden (`status`)**

| Estado | Descripción | Acción Requerida |
|--------|-------------|------------------|
| `created` | Orden creada, enviándose a terminal | ⏳ Esperar |
| `at_terminal` | Mostrándose en terminal, esperando pago | ⏳ Cliente está pagando |
| `processing` | Procesando pago | ⏳ Esperar |
| `paid` | Pago aprobado | ✅ Cerrar orden |
| `canceled` | Orden cancelada | ❌ Reintentar |
| `expired` | Expiró el tiempo límite | ❌ Crear nueva orden |

### **💳 Estados de Transacción (`transactions.payments[].status`)**

| Estado | Descripción |
|--------|-------------|
| `created` | Pago iniciado |
| `at_terminal` | En terminal esperando tarjeta |
| `approved` | Pago aprobado ✅ |
| `rejected` | Pago rechazado ❌ |
| `canceled` | Pago cancelado ❌ |

### **🔍 Status Detail**

| Detail | Significado |
|--------|-------------|
| `accredited` | Dinero acreditado en cuenta |
| `canceled_by_api` | Cancelado por llamada API |
| `canceled_by_user` | Usuario canceló en terminal |
| `expired` | Tiempo de espera agotado |

---

## Notas Importantes

### ⚠️ **Requisitos Previos**
1. **Terminal debe estar en modo PDV** - Usa endpoint #2 para configurar
2. **Terminal debe estar online** - Verificar conexión a internet
3. **Access Token válido** - Debe tener permisos para Point
4. **Idempotency Keys únicos** - Genera UUID v4 nuevo por cada operación

### 💰 **Montos y Moneda**
- Montos siempre como **string** con dos decimales: `"10.00"`
- Moneda automática: **MXN** (pesos mexicanos)
- Monto mínimo: **$5.00 MXN**

### ⏱️ **Timeouts y Polling**
- **Crear orden**: Esperar 2-3 segundos para que llegue a terminal
- **Polling recomendado**: Cada 5 segundos durante 90 segundos máximo
- **Expiración sugerida**: 3-5 minutos (`PT3M` - `PT5M`)

### 🔄 **Idempotencia**
```javascript
// ❌ MAL - Mismo UUID en múltiples órdenes
const key = '12345678-1234-1234-1234-123456789abc';

// ✅ BIEN - Nuevo UUID por cada orden
import { v4 as uuidv4 } from 'uuid';
const key = uuidv4(); // Genera: 550e8400-e29b-41d4-a716-446655440000
```

### 🚫 **Errores Comunes**

| Error | Causa | Solución |
|-------|-------|----------|
| `400 Bad Request` | Payload incorrecto | Verificar formato JSON |
| `401 Unauthorized` | Token inválido | Regenerar access token |
| `404 Not Found` | Terminal ID incorrecto | Verificar ID con endpoint #1 |
| `409 Conflict` | Terminal ocupada | Esperar o cancelar orden previa |
| `422 Unprocessable` | Monto menor a $5.00 | Usar monto ≥ $5.00 MXN |
| `429 Too Many Requests` | Rate limit excedido | Esperar 10+ segundos |

### 📱 **Ambiente de Pruebas**
Para testing, usa el [modo sandbox de Mercado Pago](https://www.mercadopago.com.mx/developers/es/docs/point/integration-configuration/credentials):
- Access Token: `TEST-123456...`
- Tarjetas de prueba: [Ver documentación oficial](https://www.mercadopago.com.mx/developers/es/docs/point/additional-content/your-integrations/test-cards)

---

## 🔗 Referencias Oficiales

- [Documentación Point API](https://www.mercadopago.com.mx/developers/es/docs/point)
- [API Reference](https://www.mercadopago.com.mx/developers/es/reference/in-person-payments)
- [Credenciales y Testing](https://www.mercadopago.com.mx/developers/es/docs/point/integration-configuration/credentials)
- [Tarjetas de Prueba](https://www.mercadopago.com.mx/developers/es/docs/point/additional-content/your-integrations/test-cards)

---

✅ **Documentación actualizada:** Octubre 2025 by Erick Pinzón