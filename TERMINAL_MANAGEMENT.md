# 🖥️ Sistema de Gestión de Terminales

## 📋 Descripción

Este sistema permite habilitar/deshabilitar terminales de Mercado Pago para controlar cuáles están disponibles al momento de realizar un cobro.

---

## ✨ Características

### 1. **Gestión de Terminales**
- ✅ Ver todas las terminales registradas en tu cuenta de Mercado Pago
- ✅ Habilitar/deshabilitar terminales individualmente
- ✅ Sincronización con Firestore para persistencia
- ✅ Actualización en tiempo real

### 2. **Filtrado Automático**
- ✅ Solo las terminales habilitadas aparecen en el modal de pago
- ✅ Validación automática al momento de cobrar
- ✅ Indicadores visuales de estado

---

## 🚀 Cómo Usar

### **Paso 1: Ver Terminales**

1. Ve a **Settings** → **Configurar Terminal**
2. Haz clic en **"🔄 Actualizar Terminales"** para cargar desde la API
3. Verás todas las terminales registradas en tu cuenta

### **Paso 2: Habilitar/Deshabilitar**

Cada terminal tiene un **toggle switch** a la derecha:

- **🟢 Verde (ON)**: Terminal habilitada - aparecerá en el modal de cobro
- **⚫ Gris (OFF)**: Terminal deshabilitada - NO aparecerá en el modal de cobro

Solo haz clic en el switch para cambiar el estado. El cambio se guarda automáticamente.

### **Paso 3: Cobrar**

1. Ve a cualquier mesa y agrega productos
2. Haz clic en **"Cobrar"**
3. Selecciona **"Mercado Pago Terminal"**
4. **Solo verás las terminales habilitadas** en la lista
5. Selecciona la terminal y procesa el pago

---

## 🎯 Casos de Uso

### **Ejemplo 1: Terminal en Mantenimiento**

Si una terminal está en reparación:
1. Desactiva el toggle en Settings
2. Esa terminal ya no aparecerá en el modal de cobro
3. Los meseros no podrán seleccionarla accidentalmente

### **Ejemplo 2: Apertura de Nuevo Punto de Venta**

Cuando agregas una nueva terminal:
1. Registra la terminal en Mercado Pago
2. Haz clic en "Actualizar Terminales" en Settings
3. La nueva terminal aparecerá automáticamente
4. Activa el toggle para habilitarla

### **Ejemplo 3: Solo Usar Terminal Principal**

Si solo quieres usar una terminal específica:
1. Desactiva todas las demás terminales
2. Solo la terminal principal estará habilitada
3. Los meseros solo verán esa opción

---

## 🔧 Arquitectura Técnica

### **Flujo de Datos**

```
API Mercado Pago → getFormattedTerminals() → Combina con Firestore → UI
                                                     ↓
                                            config/terminals
                                            { enabled: { ... } }
```

### **Almacenamiento en Firestore**

**Colección**: `config`  
**Documento**: `terminals`

```json
{
  "enabled": {
    "NEWLAND_N950__N950NCC303060763": true,
    "TERMINAL_ID_2": false,
    "TERMINAL_ID_3": true
  },
  "updatedAt": "2025-01-10T10:30:00Z"
}
```

### **Funciones Principales**

#### `getTerminalsConfig()` - firestoreService.ts
Obtiene la configuración de terminales habilitadas desde Firestore.

```typescript
const config = await getTerminalsConfig();
// Retorna: { "TERMINAL_ID": true/false }
```

#### `setTerminalEnabled()` - firestoreService.ts
Guarda el estado de una terminal.

```typescript
await setTerminalEnabled("TERMINAL_ID", true);
```

#### `getFormattedTerminals(config)` - mercadoPagoService.ts
Obtiene terminales de la API y las combina con la configuración.

```typescript
const terminals = await getFormattedTerminals(config);
// Retorna: Terminal[] con campo 'enabled'
```

#### `getEnabledTerminals(config)` - mercadoPagoService.ts
Filtra solo las terminales habilitadas.

```typescript
const enabled = await getEnabledTerminals(config);
// Retorna: Solo terminales con enabled !== false
```

---

## 📊 Estados de Terminal

| Estado | Indicador Visual | Aparece en Cobro | Descripción |
|--------|-----------------|------------------|-------------|
| **Habilitada** | 🟢 Badge verde + Toggle ON | ✅ Sí | Terminal activa y disponible |
| **Deshabilitada** | ⚫ Badge gris + Toggle OFF | ❌ No | Terminal oculta del flujo de cobro |

---

## 🛡️ Seguridad

- ✅ Solo administradores pueden habilitar/deshabilitar terminales
- ✅ Cambios guardados en Firestore con autenticación
- ✅ Validación en el cliente y servidor
- ✅ No se pueden eliminar terminales, solo deshabilitar

---

## 📝 Notas

- **Por defecto**, todas las nuevas terminales están **habilitadas**
- Si deshabilitas todas las terminales, aparecerá un mensaje de advertencia en el modal de cobro
- Los cambios se reflejan **inmediatamente** en toda la aplicación
- La configuración persiste entre sesiones

---

## 🐛 Troubleshooting

### "No hay terminales habilitadas"
**Solución**: Ve a Settings → Configurar Terminal y habilita al menos una terminal

### "Terminal no aparece en la lista"
**Solución**: 
1. Verifica que la terminal esté registrada en Mercado Pago
2. Haz clic en "Actualizar Terminales"
3. Revisa que el Access Token sea correcto

### "Toggle no guarda el cambio"
**Solución**:
1. Verifica la conexión a internet
2. Revisa la consola del navegador
3. Confirma que tienes permisos de administrador

---

## 📞 Contacto

Para reportar problemas o sugerencias sobre el sistema de terminales, contacta al equipo de desarrollo.
