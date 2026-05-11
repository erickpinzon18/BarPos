# Sistema de Promociones — Documentación de Cambios

## Objetivo

Implementar un sistema de promociones con hora de corte que permite al administrador configurar descuentos por categoría y/o productos específicos. Las promociones se muestran visualmente en el modal de agregar productos y en la lista de items de la orden.

---

## Archivos Modificados

### 1. `src/utils/types.ts`

**Qué se cambió:**

Se agregó el tipo `fixedprice` al union `DiscountType` y se documentó el campo `discountValue`:

```ts
export type DiscountType = 'percentage' | 'fixed' | '2x1' | 'nxprice' | 'fixedprice';

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  discountType: DiscountType;
  /**
   * Valor del descuento según tipo:
   * - percentage: 0-100
   * - fixed: monto a descontar en pesos
   * - 2x1: ignorado
   * - nxprice: precio del bundle
   * - fixedprice: precio final por unidad (ej: $1000 por botella)
   */
  discountValue: number;
  categories: CategoryKey[];       // [] = aplica a todas las categorías
  productIds: string[];            // [] = aplica a todos los productos de la categoría
  cutoffTime: string;              // "HH:MM" en formato 24h, ej: "20:40"
  active: boolean;                 // ⚠️ Campo en Firestore es "active" (NO "isActive")
  createdAt: Date;
  updatedAt: Date;
}
```

**Campo clave `productIds`:** Permite restringir la promo a productos específicos dentro de una categoría. Si está vacío, aplica a toda la categoría.

**Campo clave `cutoffTime`:** Hora límite en formato `"HH:MM"`. Después de esta hora la promo no aplica aunque esté activa.

---

### 2. `src/hooks/usePromotions.ts`

**Qué contiene (hook existente, no modificado pero usado en todas partes):**

```ts
// Hook que retorna promociones activas de Firestore
export function useActivePromotions(): { promotions: Promotion[] }

// Función que valida si la hora actual es ANTES del cutoffTime
export function isPromotionWithinSchedule(cutoffTime: string): boolean
// Ejemplo: cutoffTime = "20:40" → retorna true si son las 19:00, false si son las 21:00
```

---

### 3. `src/pages/admin/Promotions.tsx`

**Qué se cambió:**

1. Agregado `'fixedprice'` al objeto `discountTypeLabels`:
   ```ts
   fixedprice: 'Precio Fijo x Unidad'
   ```

2. El campo de valor en el formulario ahora muestra descripción y placeholder diferente según el tipo:
   - `fixedprice`: label = "Precio Fijo por Unidad ($)", placeholder = "1000", hint explicativo en azul
   - `percentage`: label = "Porcentaje (%)"
   - `fixed`: label = "Monto ($)"

3. Las tarjetas de promoción muestran: `Precio fijo $1000/u` para el tipo `fixedprice`.

4. **Acordeón de productos por categoría** (ya existía desde sesión anterior): Al seleccionar una categoría, aparece un acordeón expandible con la lista de productos. Se puede elegir "Todos" o marcar productos específicos. Los `productIds` seleccionados se guardan en Firestore.

---

### 4. `src/pages/admin/Checkout.tsx`
### 5. `src/pages/waiter/Checkout.tsx`
### 6. `src/pages/kitchen/Checkout.tsx`

**Qué se cambió en los 3 archivos (mismo patrón):**

**A) Filtro de items aplicables ahora tiene 3 niveles:**

```ts
const applicableItems = (() => {
  // 1. Filtrar por categoría (si hay categorías definidas)
  let items = selectedPromo.categories.length > 0
    ? activeItems.filter(i => selectedPromo.categories.includes(i.category))
    : activeItems;
  // 2. Filtrar por productId específico (si hay productos definidos)
  if (selectedPromo.productIds && selectedPromo.productIds.length > 0) {
    items = items.filter(i => selectedPromo.productIds.includes(i.productId));
  }
  return items;
})();
```

**B) Switch de tipos de descuento ahora incluye `fixedprice`:**

```ts
switch (selectedPromo.discountType) {
  case 'percentage':
    return applicableSubtotal * (selectedPromo.discountValue / 100);

  case 'fixed':
    return Math.min(selectedPromo.discountValue, applicableSubtotal);

  case '2x1': {
    let discount = 0;
    for (const item of applicableItems) {
      discount += Math.floor(item.quantity / 2) * item.productPrice;
    }
    return discount;
  }

  case 'fixedprice': {
    // Descuento = (precio original - precio fijo) × cantidad
    // Solo aplica si el precio original > precio fijo configurado
    let discount = 0;
    for (const item of applicableItems) {
      const diff = item.productPrice - selectedPromo.discountValue;
      if (diff > 0) discount += diff * item.quantity;
    }
    return discount;
  }

  default:
    return 0;
}
```

**Ejemplo `fixedprice`:**
- Botella Black Label = $1,500 original
- `discountValue` = $1,000 (precio fijo deseado)
- Descuento calculado = $500 por unidad
- Total = $1,000 ✓

> **IMPORTANTE:** El descuento en Checkout solo se aplica cuando el usuario **selecciona manualmente la promoción** en el dropdown del Checkout. No es automático — el mesero debe elegirla.

---

### 7. `src/pages/waiter/OrderDetails.tsx`

**Qué se cambió:**

1. **Imports nuevos:**
   ```ts
   import { useActivePromotions, isPromotionWithinSchedule } from '../../hooks/usePromotions';
   import { Tag, Clock } from 'lucide-react'; // iconos adicionales
   ```

2. **Hook agregado:**
   ```ts
   const { promotions: activePromotions } = useActivePromotions();
   ```

3. **Helper `getItemPromo`:** Busca la primera promo activa que aplique a un item de la orden:
   ```ts
   const getItemPromo = (item: OrderItem) => {
     if (item.isDeleted) return null;
     return activePromotions.find(promo => {
       const categoryMatch = promo.categories.length === 0 || promo.categories.includes(item.category);
       const productMatch = !promo.productIds || promo.productIds.length === 0 || promo.productIds.includes(item.productId);
       return categoryMatch && productMatch;
     }) ?? null;
   };
   ```

4. **`autoDiscount`:** Calcula el descuento estimado total de todos los items activos con promos vigentes. Se muestra en el resumen de la orden como:
   ```
   Subtotal:           $1,500.00
   🏷️ Promo estimada:  -$500.00
   ─────────────────────────────
   Total con promo:    $1,000.00
   ```

5. **Badge "PROMO" en cada item de la orden:**
   - Si la promo es vigente: borde izquierdo verde + fondo verde oscuro + badge sólido verde `🏷️ PROMO · hasta HH:MMhrs`
   - Si la promo expiró: badge ámbar `⏰ PROMO expirada`
   - Sin promo: apariencia normal

6. **`activePromotions` pasado al `<AddItemModal>`:**
   ```tsx
   <AddItemModal
     ...
     activePromotions={activePromotions}
   />
   ```

---

### 8. `src/pages/admin/OrderDetails.tsx`
### 9. `src/pages/kitchen/OrderDetails.tsx`

Mismos cambios que `waiter/OrderDetails.tsx`: imports, hook, `getItemPromo`, badge en items con borde verde, y `activePromotions` pasado al `<AddItemModal>`. Además, `admin/OrderDetails` ahora también incluye `autoDiscount` en el resumen de la orden (Subtotal → Promo estimada → Total con promo).

---

### 10. `src/components/common/AddItemModal.tsx`

**Qué se cambió:**

1. **Nueva prop opcional:**
   ```ts
   interface AddItemModalProps {
     ...
     activePromotions?: Promotion[]; // nueva
   }
   ```

2. **Helper `getProductPromo`:** Para cada producto en el catálogo, busca si hay promo activa y vigente aplicable:
   ```ts
   const getProductPromo = useMemo(() => (product: Product): Promotion | null => {
     return activePromotions.find(promo => {
       if (!isPromotionWithinSchedule(promo.cutoffTime)) return false;
       const catOk = promo.categories.length === 0 || promo.categories.includes(product.category);
       const prodOk = !promo.productIds || promo.productIds.length === 0 || promo.productIds.includes(product.id);
       return catOk && prodOk;
     }) ?? null;
   }, [activePromotions]);
   ```

3. **Helper `getEffectivePrice`:** Calcula el precio por unidad con la promo aplicada:
   ```ts
   const getEffectivePrice = (product: Product, promo: Promotion | null): number => {
     if (!promo) return product.price;
     switch (promo.discountType) {
       case 'fixedprice': return Math.min(product.price, promo.discountValue);
       case 'percentage':  return product.price * (1 - promo.discountValue / 100);
       case 'fixed':       return Math.max(0, product.price - promo.discountValue);
       default:            return product.price;
     }
   };
   ```

4. **Tarjetas de producto actualizadas:**
   - Con promo vigente: borde izquierdo verde grueso + fondo tintado verde + badge esquina `🏷️ PROMO` en verde sólido + precio con descuento en verde + precio original tachado + nombre de promo con hora límite + botón verde
   - Con promo expirada: borde izquierdo ámbar + fondo ámbar tenue + badge esquina `⏰ EXPIRADA` en ámbar + precio normal + nombre de promo con leyenda "expiró HH:MM hrs"
   - Sin promo: apariencia normal (fondo gris, precio rojo, botón azul)

---

## Flujo Completo del Sistema

```
Admin crea promo en /admin/promotions
  ├── Tipo: fixedprice / percentage / fixed / 2x1
  ├── Valor: precio fijo o porcentaje
  ├── Hora límite: "20:40" (cutoffTime)
  ├── Categorías: ["botella"] (o vacío = todas)
  └── Productos específicos: ["id1", "id2"] (o vacío = toda la categoría)
         ↓
Se guarda en Firestore colección `promotions` con isActive: true
         ↓
useActivePromotions() (en OrderDetails y AddItemModal)
  └── Escucha en tiempo real los docs donde isActive == true
         ↓
En AddItemModal (catálogo de productos):
  └── Muestra badge PROMO + precio con descuento en cards relevantes
         ↓
En OrderDetails (lista de items de la orden):
  └── Muestra badge PROMO inline + borde verde en items relevantes
  └── Muestra resumen "Promo estimada: -$X" en el total (solo waiter)
         ↓
En Checkout (al cobrar):
  └── El mesero selecciona la promoción manualmente en dropdown
  └── El sistema calcula applicableItems (por categoría + productIds)
  └── Aplica la fórmula de descuento según discountType
  └── Valida isPromotionWithinSchedule(cutoffTime) — si expiró, retorna 0
```

---

## Problema Pendiente / Por Verificar

El descuento en Checkout **requiere selección manual** de la promo en el dropdown. Si el sistema no está aplicando el descuento:

1. Verificar que `useActivePromotions` retorna datos (revisar en consola del navegador)
2. Verificar que el `cutoffTime` en Firestore está en formato `"HH:MM"` (24h), ej: `"20:40"` no `"08:40 PM"`
3. Verificar que `isPromotionWithinSchedule` compara correctamente:
   ```ts
   // En src/hooks/usePromotions.ts — verificar esta función
   export function isPromotionWithinSchedule(cutoffTime: string): boolean {
     const now = new Date();
     const [hours, minutes] = cutoffTime.split(':').map(Number);
     const cutoff = new Date();
     cutoff.setHours(hours, minutes, 0, 0);
     return now <= cutoff; // true = aún dentro del horario
   }
   ```
4. Verificar que `productIds` en Firestore contiene los IDs correctos de los productos (comparar con los IDs en la colección `products`)
5. En Checkout, el `item.productId` debe coincidir con los IDs en `promo.productIds`

---

## Estructura en Firestore

Colección: `promotions`

```json
{
  "id": "auto-generated",
  "name": "Precio Fijo Botellas Nacionales",
  "description": "Pruebas",
  "discountType": "fixedprice",
  "discountValue": 1000,
  "cutoffTime": "20:40",
  "categories": ["botella"],
  "productIds": ["abc123", "def456", "ghi789"],
  "active": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```
