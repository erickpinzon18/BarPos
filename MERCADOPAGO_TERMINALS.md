# 🖥️ Configuración de Terminales Mercado Pago

## ✅ Terminal Configurada

### Terminal 1: Casa Pedre - Cuarto

**Información de la Terminal:**
- **Device ID**: `N950NCC303060763`
- **Store ID**: `Casa Pedre`
- **POS ID**: `Cuarto`
- **Ubicación**: Cuarto
- **Estado**: ✅ Configurada y lista para usar

---

## 📋 Datos Técnicos

### Credenciales de la Aplicación
- **Access Token**: Configurado en `.env` como `VITE_MERCADOPAGO_ACCESS_TOKEN`
- **User ID**: Configurado en `.env` como `VITE_MERCADOPAGO_USER_ID`
- **Ambiente**: `production`

### Configuración en el Código
La terminal está configurada en:
```typescript
// src/services/mercadoPagoService.ts
const TERMINALS: Terminal[] = [
  {
    id: 'N950NCC303060763',
    name: 'Terminal Casa Pedre - Cuarto',
    location: 'Cuarto',
    storeId: 'Casa Pedre',
    posId: 'Cuarto',
    externalId: 'BAR-POS-CASA-PEDRE-CUARTO'
  },
];
```

---

## 🧪 Cómo Probar la Terminal

1. **Ve a Admin → Configuración → Configurar Terminal**
2. Verifica que aparezca la terminal "Terminal Casa Pedre - Cuarto"
3. Haz clic en **"Hacer Cobro de Prueba ($1.00)"**
4. Se abrirá el modal de Mercado Pago
5. Selecciona la terminal (solo hay una disponible)
6. Confirma el inicio del pago
7. La terminal física mostrará la pantalla de pago
8. Completa el pago en la terminal Point

---

## 📝 Notas Importantes

### Device ID vs POS ID vs Store ID

- **Device ID** (`N950NCC303060763`): 
  - Identificador único del dispositivo físico
  - Se usa como `id` principal en la configuración
  
- **Store ID** (`Casa Pedre`):
  - Identificador de la tienda/sucursal en Mercado Pago
  - Agrupa múltiples puntos de venta
  
- **POS ID** (`Cuarto`):
  - Identificador del punto de venta específico
  - Identifica la ubicación de la terminal dentro de la tienda

### API Endpoints Usados

1. **Crear Intención de Pago**:
   ```
   POST /point/integration-api/payment-intents
   ```

2. **Consultar Estado de Pago**:
   ```
   GET /point/integration-api/payment-intents/{payment_intent_id}
   ```

3. **Listar Dispositivos** (opcional):
   ```
   GET /point/integration-api/devices
   ```

---

## 🔧 Agregar Más Terminales

Si necesitas agregar más terminales en el futuro, edita el array `TERMINALS` en `mercadoPagoService.ts`:

```typescript
const TERMINALS: Terminal[] = [
  {
    id: 'N950NCC303060763',
    name: 'Terminal Casa Pedre - Cuarto',
    location: 'Cuarto',
    storeId: 'Casa Pedre',
    posId: 'Cuarto',
    externalId: 'BAR-POS-CASA-PEDRE-CUARTO'
  },
  // Nueva terminal:
  {
    id: 'DEVICE-ID-2',
    name: 'Terminal 2 - [Nombre]',
    location: '[Ubicación]',
    storeId: '[Store ID]',
    posId: '[POS ID]',
    externalId: 'BAR-POS-[IDENTIFICADOR]'
  },
];
```

---

## ⚠️ Solución de Problemas

### Error al obtener terminales (fetchRealTerminals)
Si el endpoint `/point/integration-api/devices` da error:
- ✅ **Solución aplicada**: Usar configuración manual con datos reales
- Los datos están hardcodeados en `TERMINALS` array
- No es necesario llamar a la API para listar dispositivos

### Terminal no responde
- Verifica que la terminal esté encendida
- Confirma que esté conectada a internet
- Verifica que el Device ID sea correcto
- Asegúrate de que la terminal esté vinculada a la cuenta con el Access Token configurado

### Pago no se procesa
- Revisa las credenciales en `.env`
- Verifica que el Access Token sea de producción (`APP_USR-...`)
- Confirma que el ambiente sea `production`
- Revisa los logs en la consola del navegador

---

## 📞 Recursos

- **Panel de Desarrolladores**: https://www.mercadopago.com.mx/developers/panel/app
- **Mercado Pago Point**: https://www.mercadopago.com.mx/point
- **Documentación API Point**: https://www.mercadopago.com.mx/developers/es/docs/mp-point/integration-api
- **Guía de Configuración**: Ver `MERCADOPAGO_SETUP.md`

---

## ✅ Checklist de Verificación

- [x] Device ID configurado: `N950NCC303060763`
- [x] Store ID configurado: `Casa Pedre`
- [x] POS ID configurado: `Cuarto`
- [x] Access Token en `.env`
- [x] User ID en `.env`
- [x] Ambiente en `production`
- [ ] Prueba de cobro exitosa
- [ ] Terminal respondiendo correctamente

---

**Última actualización**: Terminal configurada con datos reales de Mercado Pago Point
