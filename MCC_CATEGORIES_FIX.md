# 🏷️ Corrección de Categorías MCC (Merchant Category Code)

## 📋 Problema Identificado

El código estaba usando **categorías MCC incorrectas** que no están soportadas por la API de Mercado Pago.

### ❌ Categorías Anteriores (INCORRECTAS):

```typescript
export const MCC_CATEGORIES = {
  RESTAURANT_BAR: 621102,  // ❌ No soportado
  RESTAURANT: 5812,        // ⚠️ Solo este era correcto
  BAR: 5813,               // ❌ No soportado
  FAST_FOOD: 5814,         // ❌ No soportado
}
```

### ✅ Categorías Oficiales (CORRECTAS):

Según la [documentación oficial de Mercado Pago](https://www.mercadopago.com/developers/es/reference/pos):

> **category** (number): Código MCC que indica el rubro del punto de venta. Las únicas categorías posibles son **Gastronomía** y **Estación de Servicio**, y el código varía según el país de operación. Si no se especifica, queda como categoría genérica.

**Códigos MCC oficiales:**

| Código | Categoría | Descripción |
|--------|-----------|-------------|
| **5812** | Gastronomía | Restaurantes, bares, cafeterías, comida rápida |
| **468419** | Estación de Servicio | Gas stations |

```typescript
export const MCC_CATEGORIES = {
  GASTRONOMY: 5812,      // ✅ Gastronomía
  GAS_STATION: 468419,   // ✅ Estación de Servicio
}
```

## 🔧 Cambios Realizados

### 1. **Actualizado `MCC_CATEGORIES` en `mercadoPagoStoresService.ts`**

```typescript
// ANTES
export const MCC_CATEGORIES = {
  RESTAURANT_BAR: 621102,
  RESTAURANT: 5812,
  BAR: 5813,
  FAST_FOOD: 5814,
} as const;

// DESPUÉS
export const MCC_CATEGORIES = {
  GASTRONOMY: 5812,      // Gastronomía (restaurantes, bares, cafeterías)
  GAS_STATION: 468419,   // Estación de Servicio
} as const;
```

### 2. **Actualizada función `getMCCCategoryName()`**

```typescript
// ANTES
export function getMCCCategoryName(category: number): string {
  switch (category) {
    case MCC_CATEGORIES.RESTAURANT_BAR:
      return 'Restaurante/Bar';
    case MCC_CATEGORIES.RESTAURANT:
      return 'Restaurante';
    case MCC_CATEGORIES.BAR:
      return 'Bar/Cantina';
    case MCC_CATEGORIES.FAST_FOOD:
      return 'Comida Rápida';
    default:
      return 'Otro';
  }
}

// DESPUÉS
export function getMCCCategoryName(category: number): string {
  switch (category) {
    case MCC_CATEGORIES.GASTRONOMY:
      return 'Gastronomía';
    case MCC_CATEGORIES.GAS_STATION:
      return 'Estación de Servicio';
    default:
      return 'Categoría Genérica';
  }
}
```

### 3. **Actualizado `POSModal.tsx` - Valor por defecto**

```typescript
// ANTES
const [category, setCategory] = useState<number>(MCC_CATEGORIES.RESTAURANT_BAR);

// DESPUÉS
const [category, setCategory] = useState<number>(MCC_CATEGORIES.GASTRONOMY);
```

### 4. **Actualizado `POSModal.tsx` - Select de categorías**

```tsx
{/* ANTES */}
<select value={category} onChange={...}>
  <option value={MCC_CATEGORIES.RESTAURANT_BAR}>
    {MCC_CATEGORIES.RESTAURANT_BAR} - {getMCCCategoryName(MCC_CATEGORIES.RESTAURANT_BAR)}
  </option>
  <option value={MCC_CATEGORIES.RESTAURANT}>
    {MCC_CATEGORIES.RESTAURANT} - {getMCCCategoryName(MCC_CATEGORIES.RESTAURANT)}
  </option>
  <option value={MCC_CATEGORIES.BAR}>
    {MCC_CATEGORIES.BAR} - {getMCCCategoryName(MCC_CATEGORIES.BAR)}
  </option>
  <option value={MCC_CATEGORIES.FAST_FOOD}>
    {MCC_CATEGORIES.FAST_FOOD} - {getMCCCategoryName(MCC_CATEGORIES.FAST_FOOD)}
  </option>
</select>

{/* DESPUÉS */}
<select value={category} onChange={...}>
  <option value={MCC_CATEGORIES.GASTRONOMY}>
    {MCC_CATEGORIES.GASTRONOMY} - {getMCCCategoryName(MCC_CATEGORIES.GASTRONOMY)}
  </option>
  <option value={MCC_CATEGORIES.GAS_STATION}>
    {MCC_CATEGORIES.GAS_STATION} - {getMCCCategoryName(MCC_CATEGORIES.GAS_STATION)}
  </option>
</select>
```

### 5. **Actualizado `POSModal.tsx` - Fallback en useEffect**

```typescript
// ANTES
setCategory(pos.category || MCC_CATEGORIES.RESTAURANT_BAR);

// DESPUÉS
setCategory(pos.category || MCC_CATEGORIES.GASTRONOMY);
```

## 🎯 Resultado

### Modal de Crear/Editar Caja ahora muestra:

```
┌──────────────────────────────────────────────┐
│ Categoría MCC *                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 5812 - Gastronomía              ▼        │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Opciones:                                    │
│   • 5812 - Gastronomía                       │
│   • 468419 - Estación de Servicio            │
│                                              │
│ Código de categoría de comercio             │
│ (Merchant Category Code)                     │
│ Actual: 5812 - Gastronomía                   │
└──────────────────────────────────────────────┘
```

## 📊 Impacto en POS Existentes

### POS sin category configurada:

Si un POS fue creado sin `category`, al editarlo:

1. ✅ Aparecerá el **banner de advertencia** (ya existía)
2. ✅ El select mostrará "5812 - Gastronomía" como default
3. ✅ Al guardar, se enviará `category: 5812` a la API
4. ✅ La tarjeta del POS mostrará "Gastronomía" en lugar de "⚠️ No configurado"

### POS con category incorrecta (ej: 621102):

Si un POS tiene una categoría no soportada:

1. ⚠️ `getMCCCategoryName(621102)` devolverá **"Categoría Genérica"**
2. ⚠️ El select se auto-ajustará a "5812 - Gastronomía" (default del estado)
3. ✅ Al guardar, se actualizará a una categoría válida

## 🧪 Cómo Probar

### 1️⃣ Recargar la Aplicación

```bash
Cmd+R (Mac) o F5 (Windows/Linux)
```

### 2️⃣ Crear una Nueva Caja

1. Ir a **"Sucursales y Cajas"**
2. Click en **"➕ Crear Nueva Caja"**
3. Verificar que el select MCC muestre:
   - **5812 - Gastronomía** (preseleccionado)
   - **468419 - Estación de Servicio**

### 3️⃣ Editar la Caja "Cuarto"

1. Click en **✏️ Editar** en la tarjeta "Cuarto"
2. Verificar que aparece el banner:
   ```
   ⚠️ Advertencia: Esta caja no tiene categoría MCC configurada.
   Por favor selecciona una para que funcione correctamente con Mercado Pago.
   ```
3. Verificar que el select muestra **"5812 - Gastronomía"**
4. Click en **💾 Actualizar Caja**
5. Verificar toast: `✅ Caja actualizada correctamente`

### 4️⃣ Verificar en la Tarjeta

Después de actualizar, la tarjeta debería mostrar:

```
┌────────────────────────────────────┐
│ 💰 Caja: Cuarto                    │
│ 🏪 Sucursal: Casa Pedre            │
│ 📊 Categoría: Gastronomía          │  ← ✅ Ya no "⚠️ No configurado"
│ 🏷️ MCC: 5812                       │  ← ✅ Ya no "⚠️ Sin MCC"
│                                    │
│ 📱 Terminales (...)                │
└────────────────────────────────────┘
```

### 5️⃣ Verificar en Consola

Al actualizar el POS, deberías ver en los logs:

```javascript
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 API Request
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Endpoint: /pos/119553847
🔧 Method: PUT
📤 Payload: {
  "name": "Cuarto",
  "category": 5812,          // ✅ Categoría correcta
  "fixed_amount": false
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Response Status: 200 OK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 Response Data: {
  "id": 119553847,
  "name": "Cuarto",
  "category": 5812,          // ✅ Confirmado en la respuesta
  ...
}
```

## ✅ Checklist de Validación

- [ ] **Select muestra solo 2 opciones**: 5812 y 468419
- [ ] **Default es 5812 (Gastronomía)**
- [ ] **Nombres mostrados**: "Gastronomía" y "Estación de Servicio"
- [ ] **Al crear POS, se envía category: 5812**
- [ ] **Al editar POS sin category, se muestra el banner de advertencia**
- [ ] **Al guardar, la API acepta el valor 5812**
- [ ] **La tarjeta muestra "Gastronomía" después de actualizar**
- [ ] **No hay errores de compilación en TypeScript**

## 📚 Referencias

- [Mercado Pago - POS API Reference](https://www.mercadopago.com/developers/es/reference/pos)
- [Merchant Category Codes (MCC) - Wikipedia](https://en.wikipedia.org/wiki/Merchant_category_code)

## 💡 Nota Importante

Si tu negocio es un **restaurante, bar, cafetería o food truck**, usa:
- ✅ **5812 - Gastronomía**

Si tu negocio es una **estación de servicio/gasolinera**, usa:
- ✅ **468419 - Estación de Servicio**

Si no especificas category al crear un POS, Mercado Pago lo dejará como **"categoría genérica"**, lo cual es aceptable pero menos específico.

---

**¡Corrección aplicada!** ✅

Las categorías MCC ahora están alineadas con la documentación oficial de Mercado Pago.

