# 💳 Guía para Realizar el Primer Cobro Real con Mercado Pago

## ⚠️ IMPORTANTE: Monto Mínimo

**Mercado Pago Point requiere un monto mínimo de $5.00 MXN por transacción.**

- ✅ Monto mínimo: **$5.00 MXN**
- ❌ No puedes cobrar menos de $5.00

---

## ✅ Requisitos Previos

Antes de hacer tu primer cobro, verifica que tengas:

1. ✅ **Access Token configurado** en `.env`
   ```bash
   VITE_MERCADOPAGO_ACCESS_TOKEN=APP_USR-5769151890028796-100601-87ab9f31390e3a40c5fc396b6e537a6c-2229414856
   VITE_MERCADOPAGO_USER_ID=tu-user-id
   VITE_MERCADOPAGO_ENV=production
   ```

2. ✅ **Servidor reiniciado** después de configurar las variables
   ```bash
   # Presiona Ctrl+C para detener
   npm run dev
   ```

3. ✅ **Terminal de Mercado Pago**
   - Encendida y conectada a internet
   - Con batería suficiente
   - En modo operativo (pantalla lista para cobrar)

4. ✅ **Al menos una terminal habilitada** en Settings
   - Ve a Settings → Configurar Terminal
   - Verifica que el toggle esté en verde (🟢)

---

## 🎯 Paso a Paso: Tu Primer Cobro de $5.00 MXN

### **1. Verifica la Configuración de la Terminal**

1. Ve a **Settings** → **Configurar Terminal**
2. Haz clic en **"🔄 Actualizar Terminales"**
3. Verás tu terminal:
   ```
   Terminal N950NCC303060763  [✓ Habilitada]
   📍 Standalone              [🟢●] Activa
   Device ID: NEWLAND_N950__N950NCC303060763
   ```
4. Si el toggle está apagado (⚫), enciéndelo haciendo clic

---

### **2. Realiza el Cobro de Prueba**

**Opción A: Desde Settings (Recomendado para primera vez)**

1. En **Settings** → **Configurar Terminal**
2. Baja hasta la sección **"🧪 Prueba de Pago Productivo"**
3. Haz clic en **"💳 Hacer Cobro de Prueba ($5.00)"**
4. Sigue los pasos del modal

**Opción B: Desde una Mesa**

1. Ve a cualquier **Mesa** (ej: Mesa 1)
2. Agrega productos que sumen al menos **$5.00**
3. Haz clic en **"Cobrar"**
4. Selecciona **"Mercado Pago Terminal"**

---

### **3. Flujo del Modal de Pago**

#### **Paso 1: Seleccionar Terminal**
```
┌─────────────────────────────────────┐
│  Selecciona la Terminal             │
├─────────────────────────────────────┤
│  ○ Terminal N950NCC303060763        │
│     📍 Standalone                   │
└─────────────────────────────────────┘
```
- Haz clic en la terminal disponible

#### **Paso 2: Confirmar**
```
┌─────────────────────────────────────┐
│  Terminal de Pago                   │
│  Se abrirá una ventana en la        │
│  terminal para procesar el pago     │
├─────────────────────────────────────┤
│  [Abrir Terminal y Continuar]       │
└─────────────────────────────────────┘
```
- Haz clic en **"Abrir Terminal y Continuar"**

#### **Paso 3: Procesamiento**
```
┌─────────────────────────────────────┐
│  ✓ Conectando con terminal          │
│  🔄 Esperando pago del cliente      │
│     ████████████████░░░░░ 45s       │
└─────────────────────────────────────┘
```
- Espera a que la terminal muestre la pantalla de pago
- El cliente acerca su tarjeta/teléfono
- Máximo 60 segundos de espera

#### **Paso 4: Resultado**
```
┌─────────────────────────────────────┐
│  ✓ Pago Aprobado                    │
│     La transacción fue exitosa      │
├─────────────────────────────────────┤
│  [Continuar y Cerrar Mesa]          │
└─────────────────────────────────────┘
```
- Si es exitoso, puedes cerrar la mesa
- Si falla, puedes reintentar

---

## 🖥️ Qué Ver en la Terminal Física

### **Estado 1: Esperando Conexión**
```
Terminal Mercado Pago
━━━━━━━━━━━━━━━━━━━
   Conectando...
```

### **Estado 2: Lista para Cobrar**
```
Terminal Mercado Pago
━━━━━━━━━━━━━━━━━━━
   $5.00 MXN
   
   Acerque su tarjeta
   o teléfono
```

### **Estado 3: Procesando**
```
Terminal Mercado Pago
━━━━━━━━━━━━━━━━━━━
   Procesando...
   
   Por favor espere
```

### **Estado 4: Aprobado**
```
Terminal Mercado Pago
━━━━━━━━━━━━━━━━━━━
   ✓ APROBADO
   
   $5.00 MXN
   **** 4242
```

---

## 📊 Monitoreo en Tiempo Real

### **Consola del Navegador**
Abre las DevTools (F12) y ve a la pestaña "Console". Verás logs como:

```javascript
💳 [MercadoPago] Creando intención de pago en Terminal N950NCC303060763...
🌐 [MercadoPago] POST /point/integration-api/devices/NEWLAND_N950__N950NCC303060763/payment-intents
✅ [MercadoPago] Response: { id: "12345", status: "PENDING", ... }
🔍 [MercadoPago] Consultando estado de pago: 12345...
🔄 [MercadoPago] Intento 1/30 - Estado: PROCESSING
🔄 [MercadoPago] Intento 2/30 - Estado: PROCESSING
✅ [MercadoPago] Intento 3/30 - Estado: APPROVED
```

---

## 🐛 Problemas Comunes y Soluciones

### ❌ "Amount must be greater than or equal to 500"
**Problema**: El monto es menor a $5.00 MXN  
**Solución**:
1. Mercado Pago Point tiene un monto mínimo de **$5.00 MXN**
2. Asegúrate de cobrar al menos $5.00
3. No puedes hacer pruebas con $1.00 o menos de $5.00

### ❌ "401 Unauthorized"
**Problema**: Access Token incorrecto o expirado  
**Solución**:
1. Verifica que el token en `.env` sea correcto
2. Asegúrate de que empiece con `APP_USR-` (producción)
3. Reinicia el servidor: `npm run dev`

### ❌ "Terminal no encontrada"
**Problema**: El ID de la terminal no coincide  
**Solución**:
1. Ve a Settings → Configurar Terminal
2. Haz clic en "Actualizar Terminales"
3. Verifica que el Device ID sea el correcto

### ❌ "Tiempo de espera agotado"
**Problema**: La terminal no respondió en 60 segundos  
**Solución**:
1. Verifica que la terminal esté encendida
2. Revisa la conexión a internet de la terminal
3. Reinicia la terminal física
4. Intenta nuevamente

### ❌ "No hay terminales habilitadas"
**Problema**: Todas las terminales están deshabilitadas  
**Solución**:
1. Ve a Settings → Configurar Terminal
2. Activa el toggle (🟢) de al menos una terminal

### ❌ "CORS Error" (en desarrollo)
**Problema**: El proxy de Vite no está funcionando  
**Solución**:
1. Verifica que `vite.config.ts` tenga el proxy configurado
2. Reinicia completamente el servidor
3. Verifica que el `.env` esté en la raíz del proyecto

---

## 📝 Checklist Antes de Cobrar

- [ ] Variables de entorno configuradas (`.env`)
- [ ] Servidor reiniciado después de configurar `.env`
- [ ] Terminal física encendida y conectada
- [ ] Al menos una terminal habilitada en Settings
- [ ] Access Token válido (empieza con `APP_USR-` para producción)
- [ ] Consola del navegador abierta para monitorear (F12)

---

## 🎉 Después del Primer Cobro Exitoso

Una vez que hagas tu primer cobro de $5.00 MXN:

1. ✅ **Verifica en Mercado Pago**
   - Ve a https://www.mercadopago.com.mx/
   - Revisa tus ventas
   - Deberías ver el pago de $5.00

2. ✅ **Verifica el Ticket Impreso**
   - La terminal debería imprimir un comprobante
   - Verifica que tenga el monto correcto

3. ✅ **Ya puedes cobrar montos reales**
   - El sistema está 100% funcional
   - Recuerda: **mínimo $5.00 MXN** por transacción
   - Los pagos se procesan en tiempo real

---

## 🔐 Seguridad en Producción

### **IMPORTANTE: Protege tu Access Token**

❌ **NUNCA** hagas esto:
```javascript
// NO expongas el token en el código
const token = "APP_USR-5769151890028796-..."; 
```

✅ **SIEMPRE** usa variables de entorno:
```javascript
// Correcto: usar variables de entorno
const token = import.meta.env.VITE_MERCADOPAGO_ACCESS_TOKEN;
```

### **Despliegue en Producción**

Cuando despliegues (Vercel, Netlify, etc.):

1. Agrega las variables de entorno en el panel de configuración
2. **NO** subas el archivo `.env` a Git
3. Asegúrate de que `.env` esté en `.gitignore`
4. Para producción real, considera usar un backend para manejar los tokens

---

## 📞 Soporte

Si encuentras problemas:
1. Revisa la consola del navegador (F12)
2. Verifica los logs de la terminal física
3. Consulta la documentación: [Mercado Pago Developers](https://www.mercadopago.com.mx/developers/es/docs/mp-point/integration-api)

---

¡Tu sistema está listo para cobrar! 🚀💰
