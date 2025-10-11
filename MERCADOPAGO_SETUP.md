# 🔐 Guía de Configuración - Mercado Pago Point

## 📋 Credenciales Necesarias

Para usar las **terminales Point** de Mercado Pago, solo necesitas **3 variables de entorno**:

### 1️⃣ Access Token (OBLIGATORIO)
- **Variable**: `VITE_MERCADOPAGO_ACCESS_TOKEN`
- **Formato Producción**: `APP-XXXXXXXXXXXXXXXXXX`
- **Formato Sandbox**: `TEST-XXXXXXXXXXXXXXXXXX`
- **Dónde obtenerlo**: 
  1. Ve a https://www.mercadopago.com.mx/developers/panel/app
  2. Selecciona tu aplicación
  3. Ve a "Credenciales de producción"
  4. Copia el "Access Token"

### 2️⃣ User ID (OBLIGATORIO)
- **Variable**: `VITE_MERCADOPAGO_USER_ID`
- **Formato**: Número de 9 dígitos (ejemplo: `123456789`)
- **Dónde obtenerlo**:
  1. En el mismo panel de desarrolladores
  2. O en tu perfil de Mercado Pago
  3. Es tu identificador único de cuenta

### 3️⃣ Environment (OBLIGATORIO)
- **Variable**: `VITE_MERCADOPAGO_ENV`
- **Valores válidos**: `production` o `sandbox`
- **Regla**: DEBE coincidir con el tipo de Access Token
  - Si usas `APP-*` → `production`
  - Si usas `TEST-*` → `sandbox`

---

## ❌ Credenciales NO Necesarias

Para Point API (terminales físicas), **NO necesitas**:

- ❌ **Public Key** - Solo para Checkout Web/SDK JS
- ❌ **Client ID** - Solo para OAuth/Marketplace
- ❌ **Client Secret** - Solo para OAuth/Marketplace

Estas credenciales se usan para otros productos de Mercado Pago, pero **NO para terminales Point**.

---

## ⚙️ Configuración en tu Proyecto

### Paso 1: Editar `.env`

```bash
# Mercado Pago - Producción
VITE_MERCADOPAGO_ACCESS_TOKEN=APP-1234567890123456
VITE_MERCADOPAGO_USER_ID=123456789
VITE_MERCADOPAGO_ENV=production
```

### Paso 2: Configurar Terminales

Edita `src/services/mercadoPagoService.ts` líneas 55-75:

```typescript
const TERMINALS: Terminal[] = [
  {
    id: 'terminal-1',
    name: 'Caja Principal',
    location: 'Planta Baja',
    storeId: 'TU-STORE-ID-REAL',    // ⚠️ Actualiza esto
    posId: 'TU-POS-ID-REAL',        // ⚠️ Actualiza esto
    externalId: 'bar-pos-caja-1',
  },
  // ... más terminales
];
```

**¿Dónde obtengo Store ID y POS ID?**

1. Ve a https://www.mercadopago.com.mx/point
2. En "Mis dispositivos" verás tus terminales
3. Haz clic en cada terminal para ver sus detalles
4. Ahí encontrarás:
   - **Store ID**: ID de la tienda/sucursal
   - **POS ID**: ID único del dispositivo Point

---

## 🧪 Modo Testing (Sandbox)

Si quieres probar primero en sandbox:

```bash
# Mercado Pago - Sandbox
VITE_MERCADOPAGO_ACCESS_TOKEN=TEST-1234567890123456
VITE_MERCADOPAGO_USER_ID=123456789
VITE_MERCADOPAGO_ENV=sandbox
```

**Nota**: En sandbox NO se conecta con terminales reales, es solo para probar la integración.

---

## ✅ Verificar Configuración

Una vez configurado, reinicia el servidor:

```bash
npm run dev
```

Luego prueba el flujo:

1. **Admin** → Checkout → Seleccionar "Tarjeta" o "Transferencia"
2. Debería abrir el modal de Mercado Pago
3. Seleccionar terminal
4. **IMPORTANTE**: La terminal física debe estar:
   - ✅ Encendida
   - ✅ Conectada a internet
   - ✅ Logueada con tu cuenta de Mercado Pago

---

## 🔴 Troubleshooting

### Error: "Terminal no encontrada"
- Verifica que `storeId` y `posId` sean correctos
- Asegúrate de que la terminal esté registrada en tu cuenta

### Error: "Unauthorized" o "Invalid token"
- Verifica que el Access Token sea correcto
- Asegúrate de usar el token de PRODUCCIÓN (APP-*)
- Verifica que el User ID sea correcto

### Error: "Payment intent failed"
- Verifica que la terminal esté encendida
- Asegúrate de que tenga internet
- Verifica que esté logueada con tu cuenta

### El pago se queda en "Processing"
- La terminal debe estar disponible y lista
- El cliente debe completar el pago en 60 segundos
- Si no, el sistema hace timeout automáticamente

---

## 📞 Soporte

- **Documentación Oficial**: https://www.mercadopago.com.mx/developers/es/docs/mp-point
- **API Reference**: https://www.mercadopago.com.mx/developers/es/reference
- **Soporte Mercado Pago**: https://www.mercadopago.com.mx/ayuda

---

## 🎯 Próximos Pasos

Una vez que tu primera transacción funcione:

1. ✅ Actualiza todas tus terminales en `mercadoPagoService.ts`
2. ✅ Prueba con diferentes métodos de pago (débito, crédito)
3. ✅ Verifica que los tickets se impriman en la terminal
4. ✅ Revisa los pagos en tu dashboard de Mercado Pago
5. ⚠️ Guarda el `.env` en lugar seguro (NUNCA lo subas a git)

---

**¡Listo para recibir pagos productivos!** 💳✨
