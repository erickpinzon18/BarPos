# 💳 Referencias de Pago para Pruebas - Mercado Pago Point

## 🎯 Para Pruebas de Calidad y Demostración

Cuando necesites hacer pruebas o demostrar el sistema a clientes/evaluadores, usa estas referencias de pago:

---

## 📱 Métodos de Pago de Prueba en Terminal

### **Opción 1: QR de Prueba (Mercado Pago App)**
Si estás en ambiente **Sandbox (Pruebas)**:

```
📱 Usuario de Prueba:
Email: test_user_XXXXXXXX@testuser.com
Contraseña: qatest####

Saldo disponible: Ilimitado (pruebas)
```

**Para obtener usuarios de prueba:**
1. Ve a: https://www.mercadopago.com.mx/developers/panel/test-users
2. Genera usuarios de prueba (comprador y vendedor)
3. Usa la app de Mercado Pago con estas credenciales

---

### **Opción 2: Tarjetas de Prueba**
Mercado Pago proporciona tarjetas de prueba para ambiente **Sandbox**:

#### ✅ **Tarjetas que APRUEBAN el pago:**

| Tarjeta | Número | CVV | Fecha | Nombre |
|---------|--------|-----|-------|--------|
| **Visa** | `4075 5957 1648 3764` | 123 | 11/25 | APRO |
| **Mastercard** | `5031 7557 3453 0604` | 123 | 11/25 | APRO |

#### ❌ **Tarjetas que RECHAZAN el pago:**

| Tarjeta | Número | CVV | Fecha | Nombre | Tipo de Rechazo |
|---------|--------|-----|-------|--------|-----------------|
| **Visa** | `4013 5406 8274 6260` | 123 | 11/25 | OTRA | Fondos insuficientes |
| **Mastercard** | `5031 4332 1540 6351` | 123 | 11/25 | OTRA | Rechazada por banco |

---

## 🏭 Ambiente de Producción

Si estás usando **Producción** (access token con `APP_USR-`), las tarjetas de prueba **NO FUNCIONAN**.

Debes usar:
- ✅ Tarjetas reales
- ✅ Cuentas reales de Mercado Pago
- ✅ Pagos reales (se cobrarán de verdad)

---

## 🧪 Escenarios de Prueba Recomendados

### **1. Pago Exitoso ($5.00 MXN)**
```
Referencia: TEST-PAGO-EXITOSO-001
Monto: $5.00 MXN
Método: Tarjeta 4075 5957 1648 3764
Resultado esperado: ✅ APPROVED
```

### **2. Pago Rechazado por Fondos ($5.00 MXN)**
```
Referencia: TEST-PAGO-RECHAZADO-002
Monto: $5.00 MXN
Método: Tarjeta 4013 5406 8274 6260
Resultado esperado: ❌ REJECTED (insufficient_funds)
```

### **3. Pago Cancelado por Cliente ($10.00 MXN)**
```
Referencia: TEST-PAGO-CANCELADO-003
Monto: $10.00 MXN
Método: Cancelar en la terminal antes de pagar
Resultado esperado: 🚫 CANCELLED
```

### **4. Timeout (No Completado) ($5.00 MXN)**
```
Referencia: TEST-TIMEOUT-004
Monto: $5.00 MXN
Método: No acercar tarjeta durante 60 segundos
Resultado esperado: ⏱️ TIMEOUT
```

---

## 📊 Datos para Referencia Externa

Cuando crees órdenes, usa referencias descriptivas:

```typescript
// Ejemplos de external_reference
`order-${tableNumber}-${timestamp}`        // order-5-1699564800000
`mesa-${tableNumber}-${orderNumber}`       // mesa-5-001
`pos-${location}-${sequence}`              // pos-casa-pedre-0042
`test-${environment}-${timestamp}`         // test-production-1699564800000
```

---

## 🎨 Formato de Referencias para Evaluación

### **Para mostrar calidad del sistema:**

```javascript
// Orden #1 - Pago exitoso
{
  orderId: "BAR-001-20251009-1530",
  externalReference: "EVAL-MESA-01-COMPLETA",
  amount: 125.50,
  items: [
    { name: "Cerveza Corona", qty: 2, price: 45.00 },
    { name: "Tacos al Pastor", qty: 5, price: 15.00 },
    { name: "Guacamole", qty: 1, price: 35.50 }
  ],
  status: "APPROVED",
  timestamp: "2025-10-09T15:30:00Z"
}

// Orden #2 - Orden dividida
{
  orderId: "BAR-002-20251009-1545",
  externalReference: "EVAL-MESA-02-DIVIDIDA",
  amount: 89.00,
  items: [
    { name: "Margarita", qty: 1, price: 65.00 },
    { name: "Nachos", qty: 1, price: 24.00 }
  ],
  status: "APPROVED",
  timestamp: "2025-10-09T15:45:00Z"
}

// Orden #3 - Orden múltiple
{
  orderId: "BAR-003-20251009-1600",
  externalReference: "EVAL-MESA-03-GRANDE",
  amount: 450.00,
  items: [
    { name: "Botella Tequila", qty: 1, price: 350.00 },
    { name: "Alitas BBQ", qty: 2, price: 50.00 }
  ],
  status: "APPROVED",
  timestamp: "2025-10-09T16:00:00Z"
}
```

---

## 🔍 Verificación de Pagos

Después de cada prueba, verifica en:

1. **Consola del Navegador (F12)**
   - Busca logs: `💳 [MercadoPago]`
   - Verifica el payment_intent_id
   - Confirma el status final

2. **Panel de Mercado Pago**
   - Ve a: https://www.mercadopago.com.mx/
   - Ingresa con tu cuenta
   - Revisa "Ventas" o "Actividad"
   - Busca la referencia externa

3. **Terminal Física**
   - Verifica el ticket impreso
   - Confirma el monto
   - Valida la fecha/hora

---

## 📝 Checklist para Evaluación de Calidad

- [ ] **Pago exitoso en primera prueba** ($5.00 mínimo)
- [ ] **Ticket impreso correctamente** (monto, fecha, referencia)
- [ ] **Terminal responde en < 10 segundos**
- [ ] **Estados actualizados en tiempo real** (PENDING → PROCESSING → APPROVED)
- [ ] **Manejo correcto de errores** (timeout, rechazo, cancelación)
- [ ] **Múltiples terminales funcionando** (si aplica)
- [ ] **Referencia externa visible** en panel de Mercado Pago
- [ ] **Logs completos y descriptivos** en consola
- [ ] **UI/UX clara** (modales, mensajes, feedback visual)
- [ ] **Mesa cerrada automáticamente** después de pago exitoso

---

## 🎯 Demostración Profesional

### **Script de Demostración (5 minutos)**

```
1. [0:00-0:30] Mostrar configuración
   - Settings → Configurar Terminal
   - Mostrar credenciales configuradas
   - Mostrar terminales habilitadas

2. [0:30-1:00] Crear orden de prueba
   - Abrir Mesa 1
   - Agregar 2 cervezas ($45 c/u = $90)
   - Agregar 1 orden de tacos ($35)
   - Total: $125.00

3. [1:00-2:30] Procesar pago
   - Clic en "Cobrar"
   - Seleccionar "Mercado Pago Terminal"
   - Elegir terminal física
   - Mostrar UI de procesamiento

4. [2:30-4:00] Completar transacción
   - Acercar tarjeta a terminal
   - Esperar aprobación
   - Mostrar ticket impreso
   - Mostrar mesa cerrada

5. [4:00-5:00] Verificar en Mercado Pago
   - Abrir panel web
   - Buscar transacción
   - Confirmar referencia externa
   - Mostrar detalles completos
```

---

## 💡 Tips para Impresionar

1. **Usa referencias descriptivas**: `DEMO-${fecha}-${concepto}`
2. **Muestra logs en tiempo real**: Consola abierta durante demo
3. **Prepara múltiples escenarios**: Éxito, rechazo, cancelación
4. **Ticket físico listo**: Imprime uno de ejemplo
5. **Dashboard abierto**: Mercado Pago en otra pestaña

---

## 🔗 Enlaces Útiles

- [Panel de Desarrolladores](https://www.mercadopago.com.mx/developers/panel/app)
- [Usuarios de Prueba](https://www.mercadopago.com.mx/developers/panel/test-users)
- [Tarjetas de Prueba](https://www.mercadopago.com.mx/developers/es/docs/checkout-api/testing)
- [Documentación Point API](https://www.mercadopago.com.mx/developers/es/reference/point_apis_mlm/_point_integration-api_devices_deviceid_payment-intents/post)
- [Estado de Servicios](https://status.mercadopago.com/)

---

✅ **Con estas referencias y escenarios, tendrás todo listo para una demostración profesional del sistema**
