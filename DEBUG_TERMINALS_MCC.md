# 🐛 Debug: Terminales y MCC no se muestran

## 🎯 Problemas Reportados

1. **Las terminales no se muestran** en las tarjetas de cajas (POS)
2. **El MCC no se muestra correctamente** en el modal de editar caja

## 🔍 Cambios Realizados para Debugging

### 1. **Settings.tsx** - Logs en `refreshStores()`

Agregados console.logs detallados para rastrear:
- ✅ Cuántas sucursales se cargan
- ✅ Cuántas cajas tiene cada sucursal
- ✅ Cuántos devices se encuentran para cada caja
- ✅ Contenido completo de los devices

**Logs a buscar en consola:**
```
🔄 Cargando sucursales y dispositivos...
✅ N sucursales encontradas
📦 Procesando store: Nombre (X cajas)
  🔍 Buscando devices para POS: Nombre (ID)
    ✅/⚠️ N devices encontrados para Nombre
    Devices: [array]
✅ Todas las sucursales con devices cargadas: [data]
```

### 2. **Settings.tsx** - Visualización Mejorada de Terminales

**Cambios:**
- Agregado log en cada render de devices
- Si no hay terminales, muestra "📱 Sin terminales asociadas"
- Si hay terminales, las muestra con:
  - Fondo gris oscuro para destacarlas
  - Título en color amber
  - Texto más visible (gray-300 en lugar de gray-500)
  - Badges más prominentes para el operating_mode

**Ejemplo visual:**
```
┌─────────────────────────────────┐
│ 💳 Caja Principal               │
│ ID: 52417380                    │
├─────────────────────────────────┤
│ Categoría:  Restaurant/Bar      │
│ MCC:        621102              │
│ Monto fijo: ✓ Sí                │
├─────────────────────────────────┤
│ 📱 Terminales (2)               │
│ ┌───────────────────────────┐  │
│ │ TERMINAL123456    [PDV]   │  │
│ │ TERMINAL789012    [STANDALONE]│
│ └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 3. **POSModal.tsx** - Logs en useEffect y Select

**Logs agregados:**
- Al cargar datos de POS existente
- Todos los campos del POS
- Valor de category antes y después
- Logs cuando cambia el valor del select

**Logs a buscar en consola:**
```
📝 Editando POS: [objeto]
  - Nombre: X
  - Category (original): 621102
  - Store ID: X
  - Fixed amount: true
  - External ID: X
  - External Store ID: X
  - Category (estado): 621102

🏷️ Renderizando select MCC
  - Valor actual de category: 621102
  - MCC_CATEGORIES: {...}

🔄 Cambiando MCC de 621102 a 5812
```

### 4. **POSModal.tsx** - Indicador Visual de MCC

Agregado debajo del select:
```
Actual: 621102 - Restaurant/Bar
```

Esto permite ver en tiempo real qué MCC está seleccionado.

## 📊 Cómo Diagnosticar

### Paso 1: Abre la Consola del Navegador
```
Chrome/Edge: F12 o Ctrl+Shift+I (Cmd+Option+I en Mac)
Safari: Cmd+Option+C
Firefox: F12 o Ctrl+Shift+K
```

### Paso 2: Recarga la Página
Presiona `Cmd+R` (Mac) o `F5` (Windows/Linux)

### Paso 3: Ve a "Sucursales y Cajas"
Deberías ver en consola:
```
🔄 Cargando sucursales y dispositivos...
```

### Paso 4: Revisa los Logs

#### ✅ Si ves devices encontrados:
```
✅ 2 devices encontrados para Caja Principal
Devices: [{id: "TERM123", operating_mode: "PDV"}, ...]
```
→ **Los devices se están cargando correctamente**

#### ⚠️ Si ves 0 devices:
```
⚠️ 0 devices encontrados para Caja Principal
```
→ **Posibles causas:**
1. La caja realmente no tiene terminales asociadas en MP
2. Error en el endpoint `/pos/{id}/devices`
3. Token no tiene permisos para ver devices

### Paso 5: Abre el Modal de Editar Caja

Deberías ver en consola:
```
📝 Editando POS: {name: "Cuarto", category: 621102, ...}
  - Category (original): 621102
```

#### ✅ Si ves el category correcto:
→ **El problema puede estar en el render del select**

#### ⚠️ Si category es undefined o 0:
→ **El POS no tiene category guardado en la API**

## 🔧 Posibles Soluciones

### Problema: Devices no aparecen

#### Causa 1: Error de API
**Síntoma:** Console muestra error en `getDevicesByPOS`

**Solución:**
```typescript
// Verificar que el endpoint esté correcto
GET /pos/{pos_id}/devices
```

#### Causa 2: Token sin permisos
**Síntoma:** 403 Forbidden en llamada a devices

**Solución:**
- Verificar scopes del token en panel de MP
- Asegurarse que incluya permisos para `read:devices`

#### Causa 3: Caja sin terminales
**Síntoma:** API devuelve array vacío `{devices: []}`

**Solución:**
- Asociar terminales a la caja desde el panel de MP
- O usar la API de MP para crear devices

### Problema: MCC no se muestra

#### Causa 1: Category no definido
**Síntoma:** Console muestra `Category (original): undefined`

**Solución:**
```typescript
// Al crear POS, asegurarse de enviar category:
{
  name: "Caja",
  store_id: "123",
  category: 621102, // ← IMPORTANTE
  fixed_amount: false
}
```

#### Causa 2: Select no encuentra el valor
**Síntoma:** Select muestra opción en blanco

**Solución:**
- Verificar que `category` sea un número: `621102`
- No una cadena: `"621102"`
- Convertir con `parseInt()` si es necesario

## 🧪 Prueba Manual

### Test 1: Verificar Estructura de Datos

En consola, ejecuta:
```javascript
// Ver stores cargadas
console.log(stores);

// Ver primera caja
console.log(stores[0]?.pos[0]);

// Ver devices de primera caja
console.log(stores[0]?.pos[0]?.devices);
```

### Test 2: Verificar API Directamente

Curl para obtener devices:
```bash
curl -X GET \
  'https://api.mercadopago.com/pos/YOUR_POS_ID/devices' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

Respuesta esperada:
```json
{
  "devices": [
    {
      "id": "TERMINAL123",
      "pos_id": "52417380",
      "operating_mode": "PDV"
    }
  ]
}
```

### Test 3: Verificar MCC en API

Curl para obtener POS:
```bash
curl -X GET \
  'https://api.mercadopago.com/pos/YOUR_POS_ID' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
```

Verificar que incluya:
```json
{
  "id": "52417380",
  "name": "Cuarto",
  "category": 621102,  // ← Debe estar presente
  "fixed_amount": true
}
```

## 📝 Próximos Pasos

1. **Recargar la aplicación** y revisar consola
2. **Compartir los logs** si el problema persiste
3. **Verificar respuesta de API** con los curls de prueba
4. **Revisar permisos del token** en panel de MP

## ✅ Checklist de Verificación

- [ ] Consola muestra "Cargando sucursales y dispositivos"
- [ ] Consola muestra cantidad de stores/POS/devices
- [ ] Consola muestra array de devices (aunque sea vacío)
- [ ] UI muestra "Sin terminales asociadas" si devices = []
- [ ] UI muestra terminales si devices.length > 0
- [ ] Modal muestra "Category (original): NUMBER"
- [ ] Modal muestra "Actual: NUMBER - Name" debajo del select
- [ ] Select MCC tiene una opción seleccionada (no en blanco)

---

**Creado**: Octubre 2025  
**Propósito**: Debugging de terminales y MCC  
**Estado**: 🔍 Investigación activa
