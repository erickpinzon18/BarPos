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
export interface Terminal {
  id: string;
  name: string;
  location: string;
  storeId: string;  // ID de la tienda en Mercado Pago
  posId: string;    // ID del punto de venta (cada terminal física tiene uno)
  externalId: string; // ID externo para tu aplicación
  enabled?: boolean; // Si la terminal está habilitada para usar en el sistema
}

// Respuesta de la API de dispositivos
interface MercadoPagoDevice {
  id: string;
  pos_id: number;
  store_id: string;
  external_pos_id: string;
  operating_mode: 'PDV' | 'STANDALONE';
}

interface MercadoPagoDevicesResponse {
  devices: MercadoPagoDevice[];
  paging: {
    total: number;
    limit: number;
    offset: number;
  };
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
// ✅ Configurado con datos reales de Mercado Pago
// NOTA: Esta configuración es para fallback. Las terminales se obtienen dinámicamente de la API.
const TERMINALS: Terminal[] = [
  {
    id: 'NEWLAND_N950__N950NCC303060763',  // Device ID completo de la API
    name: 'Terminal Casa Pedre - Cuarto',
    location: 'Cuarto',
    storeId: '75133024',                    // Store ID real de la API
    posId: '119553847',                     // POS ID real de la API
    externalId: 'BAR-POS-CASA-PEDRE-CUARTO'
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
  // En desarrollo, usar el proxy de Vite para evitar problemas de CORS
  if (import.meta.env.DEV) {
    return '/api/mercadopago';
  }
  
  // En producción, necesitarás un backend que haga las peticiones
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
 * Obtiene todas las terminales disponibles (configuradas manualmente)
 */
export const getAvailableTerminals = (): Terminal[] => {
  return TERMINALS;
};

/**
 * Obtiene las terminales reales desde la API de Mercado Pago
 * @returns Array de dispositivos Point registrados en tu cuenta
 */
export const fetchRealTerminals = async (): Promise<MercadoPagoDevice[]> => {
  const endpoint = '/point/integration-api/devices';
  
  try {
    console.log('🔍 [MercadoPago] Obteniendo terminales registradas...');
    
    const response = await apiRequest<MercadoPagoDevicesResponse>(endpoint, 'GET');
    
    console.log(`✅ [MercadoPago] ${response.devices?.length || 0} terminales encontradas`);
    return response.devices || [];
  } catch (error: any) {
    console.error('❌ [MercadoPago] Error al obtener terminales:', error);
    return [];
  }
};

/**
 * Obtiene las terminales reales formateadas como Terminal[]
 * @param enabledConfig - Opcional: objeto con la configuración de terminales habilitadas
 */
export const getFormattedTerminals = async (enabledConfig?: Record<string, boolean>): Promise<Terminal[]> => {
  const devices = await fetchRealTerminals();
  
  return devices.map((device) => ({
    id: device.id,
    name: `Terminal ${device.id.split('__')[1] || device.id}`, // Extraer parte legible del ID
    location: device.operating_mode === 'PDV' ? 'Punto de Venta' : 'Standalone',
    storeId: device.store_id,
    posId: device.pos_id.toString(),
    externalId: device.external_pos_id || `BAR-POS-${device.id}`,
    enabled: enabledConfig ? (enabledConfig[device.id] !== false) : true // Por defecto habilitadas
  }));
};

/**
 * Obtiene solo las terminales habilitadas
 */
export const getEnabledTerminals = async (enabledConfig?: Record<string, boolean>): Promise<Terminal[]> => {
  const allTerminals = await getFormattedTerminals(enabledConfig);
  return allTerminals.filter(t => t.enabled !== false);
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
    'Content-Type': 'application/json',
  };

  // Solo agregar Authorization en producción (cuando no usamos proxy)
  if (!import.meta.env.DEV) {
    headers['Authorization'] = `Bearer ${CONFIG.accessToken}`;
  }
  
  // Agregar X-Idempotency-Key para POST/PUT/DELETE
  if (method !== 'GET') {
    headers['X-Idempotency-Key'] = `${Date.now()}-${Math.random()}`;
  }

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

  // Validar monto mínimo de $5.00 MXN
  if (request.amount < 5) {
    throw new Error(`El monto mínimo para cobrar es $5.00 MXN (recibido: $${request.amount.toFixed(2)})`);
  }

  console.log(`💳 [MercadoPago] Creando intención de pago en ${terminal.name}...`);

  // Endpoint para crear intención de pago en Point
  // Documentación: https://www.mercadopago.com.mx/developers/es/reference/point_apis_mlm/_point_integration-api_devices_deviceid_payment-intents/post
  const endpoint = `/point/integration-api/devices/${terminal.id}/payment-intents`;

  // El payload solo debe tener amount y additional_info según la API de Mercado Pago
  // IMPORTANTE: amount debe ser >= 500 (mínimo $5.00 MXN)
  const payload = {
    amount: Math.round(request.amount * 100), // Convertir a centavos (ej: 1.75 -> 175)
    additional_info: {
      external_reference: request.externalReference,
      print_on_terminal: true, // Imprimir ticket en la terminal
    },
  };

  try {
    const response = await apiRequest<any>(endpoint, 'POST', payload);

    return {
      id: response.id,
      status: 'PENDING', // La intención de pago siempre inicia como PENDING
      amount: response.amount / 100, // Convertir de centavos a pesos
      description: request.description, // Guardar la descripción original
      externalReference: response.additional_info?.external_reference || request.externalReference,
      createdAt: new Date().toISOString(),
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
    
    // DEBUG: Mostrar toda la respuesta para ver qué campos tiene
    console.log('🔍 [MercadoPago] Respuesta completa del payment intent:', JSON.stringify(response, null, 2));
    
    // La API devuelve el estado en response.state (no response.status)
    // Posibles valores: OPEN, PROCESSING, FINISHED, CANCELED, ERROR
    const apiState = response.state || 'OPEN';
    
    // Mapear el estado de la API a nuestro formato
    let mappedStatus: PaymentStatusResponse['status'];
    
    if (apiState === 'OPEN') {
      mappedStatus = 'PENDING';
    } else if (apiState === 'PROCESSING') {
      mappedStatus = 'PROCESSING';
    } else if (apiState === 'FINISHED') {
      // Si está FINISHED, revisar si hay payment y si fue aprobado
      if (response.payment?.status === 'approved') {
        mappedStatus = 'APPROVED';
      } else if (response.payment?.status === 'rejected') {
        mappedStatus = 'REJECTED';
      } else {
        mappedStatus = 'CANCELLED';
      }
    } else if (apiState === 'CANCELED' || apiState === 'CANCELLED') {
      mappedStatus = 'CANCELLED';
    } else if (apiState === 'ERROR') {
      mappedStatus = 'REJECTED';
    } else {
      mappedStatus = 'PENDING';
    }

    console.log(`📊 [MercadoPago] Estado API: ${apiState} → Mapeado: ${mappedStatus}`);

    return {
      id: response.id,
      status: mappedStatus,
      paymentId: response.payment?.id,
      amount: response.amount,
      statusDetail: response.payment?.status_detail || apiState,
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

    // 2. Hacer polling del estado cada 5 segundos (máximo 90 segundos)
    onStatusChange?.('processing', 'Esperando pago del cliente...');
    
    const maxAttempts = 18; // 18 intentos x 5 segundos = 90 segundos
    let attempts = 0;
    let finalStatus: PaymentStatusResponse | null = null;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
      attempts++;

      try {
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
      } catch (error: any) {
        // Si hay error de rate limit, esperar más tiempo
        if (error.message.includes('Too Many Requests')) {
          console.log('⚠️ [MercadoPago] Rate limit alcanzado, esperando 10 segundos...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        } else {
          throw error; // Re-lanzar otros errores
        }
      }
      
      // Continuar esperando si está PENDING o PROCESSING
      const timeLeft = (maxAttempts - attempts) * 5;
      onStatusChange?.('processing', `Esperando pago... (${timeLeft}s)`);
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
