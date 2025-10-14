# 🏪📱 Corrección de Ubicación y Visualización de Terminales

## 📋 Resumen de Cambios

Se realizaron dos actualizaciones importantes en el sistema de Sucursales y Cajas:

1. **Corrección del formato de ubicación** para coincidir con la estructura real de la API de Mercado Pago
2. **Visualización de terminales/devices** asociadas a cada caja (POS)

---

## 🔧 Problema 1: Estructura de Ubicación Incorrecta

### ❌ Problema

El código esperaba ubicación con campos separados pero la API devuelve `address_line`.

### ✅ Solución

#### 1. **mercadoPagoStoresService.ts** - Actualización de Tipos

```typescript
export interface StoreLocation {
  address_line: string; // ✅ Una sola línea
  latitude?: number;
  longitude?: number;
  reference?: string;
}
```

#### 2. **StoreModal.tsx** - Formulario Simplificado

- 1 campo: Dirección completa
- Placeholder: "Ej: Calle Principal, 123, Ciudad de México, CDMX"

#### 3. **Settings.tsx** - Visualización

```tsx
📍 {store.location.address_line}
```

---

## 📱 Característica 2: Visualización de Terminales

### API

```bash
GET /pos/{pos_id}/devices
```

### Implementación

**Nuevas funciones:**
- `getDevicesByPOS(posId)` - Obtener devices de un POS
- `getPOSWithDevices(storeId?)` - Obtener POS con devices

**Visualización en UI:**
```
📱 Terminales (2)
┌──────────────────────────────┐
│ TERMINAL123456    [PDV]      │
│ TERMINAL789012    [STANDALONE]│
└──────────────────────────────┘
```

**Colores:**
- 🔵 PDV (Azul)
- 🟣 STANDALONE (Púrpura)

---

## 📝 Archivos Modificados

1. `src/services/mercadoPagoStoresService.ts`
   - Tipo `StoreLocation` actualizado
   - Nuevos tipos: `Device`, `DevicesSearchResponse`
   - Funciones: `getDevicesByPOS()`, `getPOSWithDevices()`

2. `src/components/common/StoreModal.tsx`
   - Campo único: `addressLine`
   - Formulario simplificado

3. `src/components/common/POSModal.tsx`
   - Dropdown usa `external_id`

4. `src/pages/admin/Settings.tsx`
   - Carga devices en `refreshStores()`
   - Visualización de terminales en tarjetas POS

---

**Última actualización**: Octubre 2025  
**Estado**: ✅ Implementado y Probado
