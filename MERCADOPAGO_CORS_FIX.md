# 🔧 Fix CORS - Mercado Pago API

## 🚨 Problema

La API de Mercado Pago **NO permite peticiones directas desde el navegador** debido a políticas CORS (Cross-Origin Resource Sharing). Esto es por seguridad, ya que expone credenciales privadas en el cliente.

### Error que obtienes:
```
Preflight response is not successful. Status code: 405
Fetch API cannot load https://api.mercadopago.com/point/integration-api/devices due to access control checks.
```

---

## ✅ Solución Implementada: Proxy de Vite (Desarrollo)

He configurado un **proxy en Vite** que redirige las peticiones a través del servidor de desarrollo, evitando CORS.

### Cómo funciona:

```
Cliente (React)  →  Vite Proxy  →  API Mercado Pago
```

El proxy:
1. Intercepta las peticiones a `/api/mercadopago/*`
2. Las redirige a `https://api.mercadopago.com/*`
3. Agrega automáticamente el header `Authorization` con tu token
4. Evita problemas de CORS

---

## 🚀 Cómo usar

### 1. Reinicia el servidor de desarrollo

**IMPORTANTE**: Detén el servidor actual y reinícialo:

```bash
# Presiona Ctrl+C para detener el servidor actual

# Reinicia con:
npm run dev
# o
yarn dev
```

### 2. Verifica que funcione

Abre la página de Settings → pestaña "Configurar Terminal" y deberías ver tus terminales cargadas desde la API.

---

## 📝 Cambios Realizados

### 1. **vite.config.ts**
- ✅ Agregado proxy para `/api/mercadopago`
- ✅ El proxy agrega automáticamente el header `Authorization`

### 2. **mercadoPagoService.ts**
- ✅ En desarrollo: usa `/api/mercadopago` (proxy de Vite)
- ✅ En producción: necesitarás un backend real

---

## 🏗️ Para Producción

Este proxy **solo funciona en desarrollo**. Para producción necesitas:

### **Opción A: Backend Propio (Recomendado)**

Crear endpoints en tu backend (Node.js, Python, etc.):

```javascript
// Ejemplo con Express.js
app.get('/api/terminals', async (req, res) => {
  const response = await fetch('https://api.mercadopago.com/point/integration-api/devices', {
    headers: {
      'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
    }
  });
  const data = await response.json();
  res.json(data);
});
```

### **Opción B: Cloud Functions**

Usar Firebase Cloud Functions o similares:

```javascript
exports.getTerminals = functions.https.onCall(async (data, context) => {
  const response = await fetch('https://api.mercadopago.com/point/integration-api/devices', {
    headers: {
      'Authorization': `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
    }
  });
  return await response.json();
});
```

### **Opción C: Hardcodear Terminales**

Si no cambian frecuentemente, usa las terminales hardcodeadas en `TERMINALS[]`:

```typescript
const TERMINALS: Terminal[] = [
  {
    id: 'NEWLAND_N950__N950NCC303060763',
    name: 'Terminal Casa Pedre - Cuarto',
    location: 'Cuarto',
    storeId: '75133024',
    posId: '119553847',
    externalId: 'BAR-POS-CASA-PEDRE-CUARTO'
  },
];
```

---

## 🔒 Seguridad

### ⚠️ NUNCA expongas tu Access Token en el cliente

```javascript
// ❌ MAL - Token expuesto en el navegador
fetch('https://api.mercadopago.com/...', {
  headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
});

// ✅ BIEN - Token en el backend/proxy
fetch('/api/mercadopago/...'); // El proxy agrega el token
```

---

## 🧪 Testing

Para probar que funciona:

1. Reinicia el servidor (`npm run dev`)
2. Ve a Settings → Configurar Terminal
3. Haz clic en "🔄 Actualizar Terminales"
4. Deberías ver tu terminal: **Terminal N950NCC303060763**

---

## 📞 Contacto

Si tienes problemas, revisa:
- ✅ Que el servidor de Vite esté reiniciado
- ✅ Que el archivo `.env` tenga el `VITE_MERCADOPAGO_ACCESS_TOKEN`
- ✅ Que la consola no muestre errores de CORS
