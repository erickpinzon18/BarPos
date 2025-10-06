// src/services/mercadoPagoService.ts
/**
 * Servicio para integración con Mercado Pago Point (Terminales)
 * Documentación: https://www.mercadopago.com.mx/developers/es/docs/mp-point/integration-api
 */

// ========================================
// CONFIGURACIÓN - Obtén estas credenciales de tu cuenta de Mercado Pago
// ========================================
// 1. Ve a: https://www.mercadopago.com.mx/developers/panel/app
// 2. Crea una aplicación o selecciona una existente
// 3. Obtén las siguientes credenciales:

interface MercadoPagoConfig {
  // Access Token de tu aplicación (OBLIGATORIO)
  accessToken: string;
  
  // ID de tu usuario de Mercado Pago (OBLIGATORIO)
  userId: string;
  
  // Ambiente: 'production' o 'sandbox' (pruebas)
  environment: 'production' | 'sandbox';
}

// Configuración de terminales
interface Terminal {
  id: string;
  name: string;
  location: string;
  storeId: string;  // ID de la tienda en Mercado Pago
  posId: string;    // ID del punto de venta (cada terminal física tiene uno)
  externalId: string; // ID externo para tu aplicación
}

// ========================================
// CONFIGURACIÓN DEL PROYECTO
// ========================================
// IMPORTANTE: En producción, estas credenciales deben estar en variables de entorno
// y NUNCA deben estar hardcodeadas en el código

const CONFIG: MercadoPagoConfig = {
  // TODO: Reemplaza con tu Access Token real
  // Para obtenerlo: https://www.mercadopago.com.mx/developers/panel/app
  accessToken: import.meta.env.VITE_MERCADOPAGO_ACCESS_TOKEN || 'TEST-YOUR-ACCESS-TOKEN-HERE',
  
  // TODO: Reemplaza con tu User ID
  userId: import.meta.env.VITE_MERCADOPAGO_USER_ID || 'YOUR-USER-ID',
  
  // Usa 'sandbox' para pruebas, 'production' para producción
  environment: (import.meta.env.VITE_MERCADOPAGO_ENV as 'production' | 'sandbox') || 'sandbox',
};

// Configuración de terminales físicas
// TODO: Actualiza con la información real de tus terminales Point
const TERMINALS: Terminal[] = [
  {
    id: 'terminal-1',
    name: 'Terminal 1 - Caja Principal',
    location: 'Planta Baja',
    storeId: 'STORE-ID-1',  // Obtén este ID de tu panel de Mercado Pago
    posId: 'POS-ID-1',      // Obtén este ID de tu terminal Point
    externalId: 'BAR-POS-TERMINAL-1'
  },
  {
    id: 'terminal-2',
    name: 'Terminal 2 - Barra',
    location: 'Área de Bar',
    storeId: 'STORE-ID-2',
    posId: 'POS-ID-2',
    externalId: 'BAR-POS-TERMINAL-2'
  },
  {
    id: 'terminal-3',
    name: 'Terminal 3 - Terraza',
    location: 'Segundo Piso',
    storeId: 'STORE-ID-3',
    posId: 'POS-ID-3',
    externalId: 'BAR-POS-TERMINAL-3'
  },
];

// ========================================
// TIPOS Y INTERFACES
// ========================================

export interface PaymentIntentRequest {
  amount: number;
  description: string;
  externalReference: string; // ID de tu orden
  terminalId: string;
}

export interface PaymentIntentResponse {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  amount: number;
  description: string;
  externalReference: string;
  paymentId?: string;
  qrData?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface PaymentStatusResponse {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  paymentId?: string;
  amount?: number;
  statusDetail?: string;
  errorMessage?: string;
}

// ========================================
// URL BASE DE LA API
// ========================================
const getBaseUrl = () => {
  return CONFIG.environment === 'production'
    ? 'https://api.mercadopago.com'
    : 'https://api.mercadopago.com'; // Sandbox usa la misma URL
};

// ========================================
// FUNCIONES AUXILIARES
// ========================================

/**
 * Obtiene la configuración de una terminal por su ID
 */
export const getTerminal = (terminalId: string): Terminal | undefined => {
  return TERMINALS.find(t => t.id === terminalId);
};

/**
 * Obtiene todas las terminales disponibles
 */
export const getAvailableTerminals = (): Terminal[] => {
  return TERMINALS;
};

/**
 * Realiza una petición a la API de Mercado Pago
 */
const apiRequest = async <T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> => {
  const url = `${getBaseUrl()}${endpoint}`;
  
  const headers: HeadersInit = {
    'Authorization': `Bearer ${CONFIG.accessToken}`,
    'Content-Type': 'application/json',
    'X-Idempotency-Key': `${Date.now()}-${Math.random()}`, // Evita duplicados
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`🌐 [MercadoPago] ${method} ${endpoint}`, body || '');
    
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ [MercadoPago] Error:', data);
      throw new Error(data.message || `Error ${response.status}: ${response.statusText}`);
    }

    console.log('✅ [MercadoPago] Response:', data);
    return data;
  } catch (error: any) {
    console.error('❌ [MercadoPago] Request failed:', error);
    throw error;
  }
};

// ========================================
// FUNCIONES PRINCIPALES
// ========================================

/**
 * Crea una intención de pago en la terminal Point
 * 
 * @param request - Datos de la intención de pago
 * @returns Respuesta con el ID de la intención de pago
 */
export const createPaymentIntent = async (
  request: PaymentIntentRequest
): Promise<PaymentIntentResponse> => {
  const terminal = getTerminal(request.terminalId);
  
  if (!terminal) {
    throw new Error(`Terminal no encontrada: ${request.terminalId}`);
  }

  console.log(`💳 [MercadoPago] Creando intención de pago en ${terminal.name}...`);

  // Endpoint para crear intención de pago en Point
  // Documentación: https://www.mercadopago.com.mx/developers/es/docs/mp-point/integration-api/create-payment-intent
  const endpoint = `/point/integration-api/payment-intents`;

  const payload = {
    amount: request.amount,
    description: request.description || 'Pago desde Bar POS',
    external_reference: request.externalReference,
    payment: {
      installments: 1,
      type: 'credit_card', // o 'debit_card', 'qr_code', etc.
    },
    additional_info: {
      external_reference: request.externalReference,
      print_on_terminal: true, // Imprimir ticket en la terminal
    },
  };

  try {
    const response = await apiRequest<any>(endpoint, 'POST', payload);

    return {
      id: response.id,
      status: response.status,
      amount: response.amount,
      description: response.description,
      externalReference: response.external_reference,
      paymentId: response.payment?.id,
      qrData: response.qr_data,
      createdAt: response.created_at || new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('❌ [MercadoPago] Error al crear intención de pago:', error);
    throw new Error(`No se pudo crear la intención de pago: ${error.message}`);
  }
};

/**
 * Consulta el estado de una intención de pago
 * 
 * @param paymentIntentId - ID de la intención de pago
 * @returns Estado actual de la intención de pago
 */
export const getPaymentStatus = async (
  paymentIntentId: string
): Promise<PaymentStatusResponse> => {
  console.log(`🔍 [MercadoPago] Consultando estado de pago: ${paymentIntentId}...`);

  const endpoint = `/point/integration-api/payment-intents/${paymentIntentId}`;

  try {
    const response = await apiRequest<any>(endpoint, 'GET');

    return {
      id: response.id,
      status: response.status,
      paymentId: response.payment?.id,
      amount: response.amount,
      statusDetail: response.status_detail,
    };
  } catch (error: any) {
    console.error('❌ [MercadoPago] Error al consultar estado:', error);
    throw new Error(`No se pudo consultar el estado del pago: ${error.message}`);
  }
};

/**
 * Cancela una intención de pago pendiente
 * 
 * @param paymentIntentId - ID de la intención de pago a cancelar
 */
export const cancelPaymentIntent = async (
  paymentIntentId: string
): Promise<void> => {
  console.log(`🚫 [MercadoPago] Cancelando intención de pago: ${paymentIntentId}...`);

  const endpoint = `/point/integration-api/payment-intents/${paymentIntentId}`;

  try {
    await apiRequest(endpoint, 'DELETE');
    console.log('✅ [MercadoPago] Intención de pago cancelada');
  } catch (error: any) {
    console.error('❌ [MercadoPago] Error al cancelar:', error);
    throw new Error(`No se pudo cancelar la intención de pago: ${error.message}`);
  }
};

/**
 * Procesa un pago completo con polling de estado
 * Esta es una función de alto nivel que maneja todo el flujo
 * 
 * @param request - Datos del pago
 * @param onStatusChange - Callback para actualizar el estado en la UI
 * @returns Resultado final del pago
 */
export const processPayment = async (
  request: PaymentIntentRequest,
  onStatusChange?: (status: string, message: string) => void
): Promise<PaymentIntentResponse> => {
  try {
    // 1. Crear intención de pago
    onStatusChange?.('sending', 'Enviando orden a la terminal...');
    const paymentIntent = await createPaymentIntent(request);

    if (!paymentIntent.id) {
      throw new Error('No se recibió ID de intención de pago');
    }

    // 2. Hacer polling del estado cada 2 segundos (máximo 60 segundos)
    onStatusChange?.('processing', 'Esperando pago del cliente...');
    
    const maxAttempts = 30; // 30 intentos x 2 segundos = 60 segundos
    let attempts = 0;
    let finalStatus: PaymentStatusResponse | null = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
      attempts++;

      const status = await getPaymentStatus(paymentIntent.id);
      console.log(`🔄 [MercadoPago] Intento ${attempts}/${maxAttempts} - Estado: ${status.status}`);

      if (status.status === 'APPROVED') {
        finalStatus = status;
        onStatusChange?.('success', '¡Pago aprobado!');
        break;
      } else if (status.status === 'REJECTED' || status.status === 'CANCELLED') {
        finalStatus = status;
        onStatusChange?.('rejected', `Pago ${status.status === 'REJECTED' ? 'rechazado' : 'cancelado'}`);
        break;
      }
      
      // Continuar esperando si está PENDING o PROCESSING
      onStatusChange?.('processing', `Esperando pago... (${60 - attempts * 2}s)`);
    }

    // 3. Timeout si no se completa en 60 segundos
    if (!finalStatus || finalStatus.status === 'PENDING' || finalStatus.status === 'PROCESSING') {
      onStatusChange?.('error', 'Tiempo de espera agotado');
      throw new Error('Tiempo de espera agotado. El cliente no completó el pago.');
    }

    // 4. Retornar resultado
    return {
      ...paymentIntent,
      status: finalStatus.status,
      paymentId: finalStatus.paymentId,
      errorMessage: finalStatus.statusDetail,
    };

  } catch (error: any) {
    onStatusChange?.('error', error.message);
    throw error;
  }
};

// ========================================
// CONFIGURACIÓN DE WEBHOOKS (OPCIONAL)
// ========================================

/**
 * Configura un webhook para recibir notificaciones de pago
 * Esto es opcional pero recomendado para producción
 * 
 * Documentación: https://www.mercadopago.com.mx/developers/es/docs/your-integrations/notifications/webhooks
 */
export const setupWebhook = async (webhookUrl: string): Promise<void> => {
  console.log(`🔔 [MercadoPago] Configurando webhook: ${webhookUrl}`);

  // Implementar según documentación de Mercado Pago
  // Esto requiere un endpoint en tu backend para recibir las notificaciones
};

// ========================================
// EXPORT DE CONFIGURACIÓN
// ========================================
export { TERMINALS, CONFIG };
