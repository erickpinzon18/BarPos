# ⚠️ IMPORTANTE: Requisitos de Mercado Pago Point

## 🚫 Monto Mínimo

**Mercado Pago Point NO acepta pagos menores a $5.00 MXN**

```
❌ Error: amount: Must be greater than or equal to 500
```

### Restricciones:
- **Mínimo absoluto**: $5.00 MXN (500 centavos)
- **Formato**: Número entero en centavos
- **Ejemplo**: Para cobrar $5.00 → `amount: 500`

---

## ✅ Ejemplos Válidos

| Monto | Centavos | Código | Estado |
|-------|----------|--------|--------|
| $5.00 | 500 | `amount: 500` | ✅ Mínimo válido |
| $10.00 | 1000 | `amount: 1000` | ✅ Válido |
| $15.50 | 1550 | `amount: 1550` | ✅ Válido |
| $99.99 | 9999 | `amount: 9999` | ✅ Válido |

---

## ❌ Ejemplos NO Válidos

| Monto | Centavos | Código | Error |
|-------|----------|--------|-------|
| $1.00 | 100 | `amount: 100` | ❌ Menor a 500 |
| $4.50 | 450 | `amount: 450` | ❌ Menor a 500 |
| $4.99 | 499 | `amount: 499` | ❌ Menor a 500 |

---

## 🔧 Validación en el Código

El servicio ahora valida automáticamente el monto mínimo:

```typescript
// En mercadoPagoService.ts
if (request.amount < 5) {
  throw new Error(
    `El monto mínimo para cobrar es $5.00 MXN (recibido: $${request.amount.toFixed(2)})`
  );
}
```

---

## 📝 Para Testing

### ❌ NO PUEDES hacer:
```javascript
// Esto fallará con error 400
createPaymentIntent({
  amount: 1.00,  // ❌ Error: menor a $5.00
  terminalId: "...",
  externalReference: "test-001"
})
```

### ✅ SÍ PUEDES hacer:
```javascript
// Esto funcionará correctamente
createPaymentIntent({
  amount: 5.00,  // ✅ Mínimo válido
  terminalId: "...",
  externalReference: "test-001"
})
```

---

## 🎯 Para tu Primera Prueba

**Usa un monto de $5.00 MXN mínimo:**

1. Ve a una mesa
2. Agrega productos que sumen **al menos $5.00**
3. Cobra con Mercado Pago Terminal
4. Observa el proceso en la consola

**Ejemplo de productos para sumar $5.00:**
- 1 cerveza ($50.00) ✅
- 1 refresco ($35.00) ✅
- 1 botana ($45.00) ✅
- 5 tacos a $1.00 c/u = $5.00 ✅

---

## 📚 Referencias

- [Documentación API - Crear Payment Intent](https://www.mercadopago.com.mx/developers/es/reference/point_apis_mlm/_point_integration-api_devices_deviceid_payment-intents/post)
- **Campo `amount`**: "Un valor entero positivo que representa cuánto cobrar. El valor debe tener dos decimales en la parte entera (por ejemplo, 175 para cobrar $1,75). **Must be greater than or equal to 500**"

---

## 🐛 Si ves este error:

```
Error: amount: Must be greater than or equal to 500
```

**Solución:**
1. Verifica que el monto sea ≥ $5.00 MXN
2. Asegúrate de convertir correctamente: `Math.round(amount * 100)`
3. El resultado debe ser ≥ 500

---

✅ **Con esta restricción en mente, tu sistema ya está listo para cobrar desde $5.00 MXN en adelante**
