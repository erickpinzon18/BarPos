# 🔧 Configuración Firebase Functions para Mercado Pago Proxy

## ❓ ¿Por qué necesitas esto?

En **local**, Vite usa un proxy (configurado en `vite.config.ts`) que funciona perfecto.
En **producción**, ese proxy NO existe, causando errores de CORS al intentar llamar directamente a Mercado Pago desde el navegador.

**Solución:** Firebase Cloud Functions actúa como backend/proxy permanente.

---

## 📋 Pasos de Configuración

### 1️⃣ Instalar dependencias de Functions

```bash
cd functions
npm install
cd ..
```

### 2️⃣ Configurar el Access Token en Firebase

Firebase Functions **NO** lee el archivo `.env`, necesitas configurar el token usando Firebase CLI:

```bash
firebase functions:config:set mercadopago.access_token="TU_ACCESS_TOKEN_AQUI"
```

Ejemplo:
```bash
firebase functions:config:set mercadopago.access_token="APP_USR-5769151890028594-102223-e69a8be9df6e23f7b0efdc23ba73e78f-2229414856"
```

**Verificar que se guardó:**
```bash
firebase functions:config:get
```

Deberías ver:
```json
{
  "mercadopago": {
    "access_token": "APP_USR-..."
  }
}
```

### 3️⃣ Habilitar Billing en Firebase (Requerido para Functions)

⚠️ **IMPORTANTE:** Firebase Functions requiere el plan **Blaze (Pay as you go)**.

1. Ve a: https://console.firebase.google.com
2. Selecciona tu proyecto
3. En el menú lateral: **⚙️ Settings → Usage and billing**
4. Click en **Modify plan**
5. Selecciona **Blaze (Pay as you go)**

**No te preocupes:** El plan Blaze incluye una cuota gratuita generosa:
- ✅ 2 millones de invocaciones/mes GRATIS
- ✅ 400,000 GB-segundos/mes GRATIS
- ✅ 200,000 CPU-segundos/mes GRATIS

Tu app probablemente nunca excederá la cuota gratuita. 💚

### 4️⃣ Desplegar las Functions

```bash
# Build del frontend
npm run build

# Desplegar SOLO las functions
firebase deploy --only functions

# O desplegar todo (hosting + functions)
firebase deploy
```

### 5️⃣ Verificar que funciona

Después del deploy, verás algo como:

```
✔  Deploy complete!

Function URL (mercadopagoProxy):
  https://us-central1-tu-proyecto.cloudfunctions.net/mercadopagoProxy
```

**Probar manualmente:**
```bash
curl -H "Authorization: Bearer TU_TOKEN" \
  https://us-central1-tu-proyecto.cloudfunctions.net/mercadopagoProxy/point/integration-api/devices
```

---

## 🔄 Cómo Funciona

### En Local (Desarrollo):
```
Tu App → http://localhost:5173/api/mercadopago/devices
           ↓ (Vite Proxy en vite.config.ts)
           ↓ Agrega Authorization header
           ↓
        https://api.mercadopago.com/devices
```

### En Producción (Firebase):
```
Tu App → https://tu-app.web.app/api/mercadopago/devices
           ↓ (Firebase Rewrite en firebase.json)
           ↓
        Firebase Cloud Function (mercadopagoProxy)
           ↓ Agrega Authorization header
           ↓
        https://api.mercadopago.com/devices
```

---

## 🧪 Testing Local de Functions (Opcional)

Si quieres probar las functions en local antes de desplegar:

```bash
# Terminal 1: Emulador de Functions
firebase emulators:start --only functions

# Terminal 2: Tu app React con Vite
npm run dev
```

Actualiza `vite.config.ts` para apuntar al emulador:
```typescript
proxy: {
  '/api/mercadopago': {
    target: 'http://localhost:5001/tu-proyecto/us-central1/mercadopagoProxy',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/mercadopago/, ''),
  }
}
```

---

## 📊 Monitoreo y Logs

Ver logs de la función:
```bash
firebase functions:log
```

O en la consola web:
https://console.firebase.google.com → Functions → Logs

---

## ⚠️ Troubleshooting

### Error: "Billing account not configured"
**Solución:** Habilita el plan Blaze (paso 3).

### Error: "functions:config:get returns empty"
**Solución:** Vuelve a configurar el token:
```bash
firebase functions:config:set mercadopago.access_token="TU_TOKEN"
```

### Error: "CORS error" en producción
**Solución:** Verifica que el rewrite en `firebase.json` esté correcto:
```json
{
  "source": "/api/mercadopago/**",
  "function": "mercadopagoProxy"
}
```

### Error: "Function timeout"
**Solución:** Aumenta el timeout en `functions/src/index.ts`:
```typescript
export const mercadopagoProxy = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onRequest((req, res) => {
    // ...
  });
```

---

## 💰 Costos Estimados

Con 1000 usuarios/día haciendo ~10 peticiones cada uno:
- **Invocaciones:** 10,000/día = 300,000/mes → **GRATIS** (dentro de la cuota)
- **Compute time:** ~1 seg/petición → **GRATIS** (dentro de la cuota)

**Conclusión:** Para tu bar, prácticamente será gratis. 💚

---

## 🚀 Despliegue Rápido (Resumen)

```bash
# 1. Instalar
cd functions && npm install && cd ..

# 2. Configurar token
firebase functions:config:set mercadopago.access_token="TU_TOKEN"

# 3. Habilitar plan Blaze en Firebase Console

# 4. Desplegar
npm run build
firebase deploy

# ✅ ¡Listo!
```

---

## 📚 Referencias

- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [Firebase Hosting Rewrites](https://firebase.google.com/docs/hosting/full-config#rewrites)
- [Mercado Pago API](https://www.mercadopago.com.mx/developers/es/reference)
