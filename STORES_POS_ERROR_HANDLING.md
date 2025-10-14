# 🛠️ Mejoras en Manejo de Errores - Stores & POS

## 📋 Resumen de Cambios

Se ha mejorado el manejo de errores de validación de la API de Mercado Pago para mostrar mensajes detallados al usuario cuando hay problemas con los datos ingresados.

## ❌ Problema Anterior

Cuando la API de Mercado Pago rechazaba una solicitud por errores de validación (por ejemplo, nombre de ciudad inválido), el usuario solo veía un mensaje genérico como "Error al guardar sucursal" sin información sobre qué campo tenía el problema.

### Ejemplo de Error API:
```json
{
  "status": 400,
  "error": "validation_error",
  "message": "Validation Error",
  "causes": [
    {
      "code": 400,
      "description": "location.city_name was invalid. Valid values are: Aguascalientes, Arteaga, Cadereyta De Jiménez, Colón, El Marqués, San Juan Del Río, Santa Catarina, Tequisquiapan, Toliman"
    }
  ]
}
```

El usuario veía:
- ❌ Toast genérico: "Error al guardar sucursal"
- ❌ Sin información de qué campo falló
- ❌ Sin opciones válidas sugeridas

## ✅ Solución Implementada

### 1. **mercadoPagoStoresService.ts** - Propagación de Causes

```typescript
if (!response.ok) {
  // Crear un error con la información de validación
  const error: any = new Error(data.message || data.error || `HTTP ${response.status}: ${response.statusText}`);
  
  // Adjuntar causes para que el componente pueda mostrarlos
  if (data.causes) {
    error.causes = data.causes;
  }
  
  return {
    success: false,
    error: error.message,
    data: error, // Incluir el error completo con causes en data
  };
}
```

**Cambio clave**: Ahora el objeto `result.data` contiene el error completo con el array `causes`.

### 2. **StoreModal.tsx** - Extracción y Visualización de Errores

```typescript
try {
  const result = await createStore(payload);
  if (!result.success) {
    // Extraer mensajes de validación del resultado
    const error: any = result.data || new Error(result.error || 'Error al crear sucursal');
    error.message = result.error || 'Error al crear sucursal';
    throw error;
  }
  // ...
} catch (error: any) {
  // Extraer mensajes de validación detallados si existen
  let errorMessage = error?.message || 'Error al guardar sucursal';
  
  // Si hay causes en el error (validation errors de MP)
  if (error?.causes && Array.isArray(error.causes) && error.causes.length > 0) {
    const validationErrors = error.causes
      .map((cause: any) => cause.description || cause.message)
      .filter(Boolean)
      .join('\n');
    
    if (validationErrors) {
      errorMessage = validationErrors;
    }
  }
  
  // Mostrar error con toast más largo para mensajes de validación
  toast.error(errorMessage, {
    duration: 8000, // 8 segundos para leer validaciones largas
    style: {
      maxWidth: '600px',
    },
  });
}
```

**Características**:
- ✅ Extrae todos los mensajes del array `causes`
- ✅ Los concatena con saltos de línea (`\n`)
- ✅ Toast con duración de 8 segundos (vs 4 segundos default)
- ✅ Ancho máximo de 600px para textos largos

### 3. **POSModal.tsx** - Mismo Tratamiento

Se aplicó la misma lógica de manejo de errores para la creación/edición de POS/Cajas.

## 🎯 Resultado Final

Ahora el usuario ve:
- ✅ Mensaje específico del error
- ✅ Campo que causó el problema
- ✅ Valores válidos sugeridos (cuando aplica)
- ✅ Toast más largo para leer la información
- ✅ Toast más ancho para textos largos

### Ejemplo Visual:

**Antes:**
```
❌ Error al guardar sucursal
```

**Después:**
```
❌ location.city_name was invalid. Valid values are: 
Aguascalientes, Arteaga, Cadereyta De Jiménez, Colón, 
El Marqués, San Juan Del Río, Santa Catarina, 
Tequisquiapan, Toliman
```

## 📊 Errores Comunes que Ahora se Muestran Claramente

### 1. **Ciudad Inválida**
```
location.city_name was invalid. Valid values are: [lista de ciudades]
```

### 2. **Estado Inválido**
```
location.state_name was invalid. Valid values are: [lista de estados]
```

### 3. **Categoría MCC Inválida**
```
category was invalid. Valid MCC codes for your business type: [códigos]
```

### 4. **Formato de Horario Inválido**
```
business_hours.monday.open must be in HH:MM format
```

### 5. **Coordenadas GPS Fuera de Rango**
```
location.latitude must be between -90 and 90
location.longitude must be between -180 and 180
```

## 🔍 Flujo Completo de Error

```
1. Usuario llena formulario con ciudad "Ciudad de México"
   ↓
2. Envía payload a API de Mercado Pago
   ↓
3. API valida y rechaza: 400 Bad Request
   {
     "causes": [{
       "description": "location.city_name was invalid. Valid values are: ..."
     }]
   }
   ↓
4. mercadoPagoStoresService.ts captura el error
   - Extrae causes del response
   - Lo adjunta al error
   - Lo incluye en result.data
   ↓
5. StoreModal.tsx recibe result.success = false
   - Extrae el error de result.data
   - Busca error.causes array
   - Extrae descriptions de cada cause
   - Las concatena con \n
   ↓
6. Toast muestra mensaje completo al usuario
   - Duración: 8 segundos
   - Ancho: 600px
   - Contenido: Lista de ciudades válidas
   ↓
7. Usuario ve exactamente qué corregir ✅
```

## 🎨 Configuración de Toast

```typescript
toast.error(errorMessage, {
  duration: 8000, // 8 segundos (vs 4 default)
  style: {
    maxWidth: '600px', // Más ancho para listas largas
  },
});
```

**Por qué 8 segundos:**
- Listas de ciudades/estados pueden ser largas
- Usuario necesita tiempo para leer y copiar valores
- Evita que el toast desaparezca antes de leer

**Por qué 600px:**
- Permite mostrar listas en varias columnas visualmente
- No se corta en pantallas medianas
- Mantiene legibilidad sin ocupar toda la pantalla

## 🧪 Casos de Prueba

### Test 1: Ciudad Inválida
```typescript
// Input:
{
  name: "Sucursal Centro",
  location: {
    city_name: "Ciudad Inventada",
    state_name: "Querétaro"
  }
}

// Output esperado:
Toast de 8s con mensaje:
"location.city_name was invalid. Valid values are: El Marqués, 
San Juan Del Río, Querétaro, ..."
```

### Test 2: Múltiples Errores
```typescript
// Input:
{
  name: "", // Vacío
  location: {
    city_name: "Ciudad Inventada",
    state_name: "Estado Inventado"
  }
}

// Output esperado:
Toast con ambos errores:
"name is required
location.city_name was invalid. Valid values are: ...
location.state_name was invalid. Valid values are: ..."
```

### Test 3: Error de Red (No Causes)
```typescript
// Escenario: Timeout o error de red

// Output esperado:
Toast genérico (fallback):
"Error al guardar sucursal"
```

## 📝 Archivos Modificados

1. **src/services/mercadoPagoStoresService.ts**
   - Líneas ~190-210: Propagación de causes en apiRequest()

2. **src/components/common/StoreModal.tsx**
   - Líneas ~160-200: Extracción y display de validation errors

3. **src/components/common/POSModal.tsx**
   - Líneas ~95-135: Extracción y display de validation errors

## ✅ Beneficios

1. **Mejor UX**: Usuario sabe exactamente qué corregir
2. **Menos Soporte**: Errores auto-explicativos
3. **Más Rápido**: No necesita ir a consola o documentación
4. **Certificación MP**: Cumple con requisitos de manejo de errores
5. **Escalable**: Funciona para cualquier validation error de MP

## 🔮 Mejoras Futuras (Opcional)

1. **Validación Cliente**: Validar ciudades antes de enviar
2. **Autocompletado**: Dropdown con ciudades válidas
3. **Caché de Valores**: Guardar lista de ciudades/estados válidos
4. **Traducción**: Traducir mensajes de error si API está en inglés
5. **Agrupación**: Mostrar errores por campo en lugar de lista

## 📚 Referencias

- [Mercado Pago Stores API Docs](https://www.mercadopago.com.mx/developers/es/reference/stores/_users_user_id_stores/post)
- [React Hot Toast Docs](https://react-hot-toast.com/docs)
- [HTTP 400 Bad Request](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/400)

---

**Última actualización**: Octubre 2025  
**Autor**: Sistema de Manejo de Errores Mejorado  
**Estado**: ✅ Implementado y Probado
