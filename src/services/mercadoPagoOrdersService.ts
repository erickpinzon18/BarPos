// src/services/mercadoPagoOrdersService.ts
/**
 * Servicio para integración con Mercado Pago Point usando Orders API (v1/orders)
 * Documentación: https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/orders
 * 
 * Este servicio implementa la API v1/orders según la documentación oficial.
 * Los logs están preparados para después guardar en Firebase/Firestore.
 */

import { savePayment } from './firestoreService';

// ========================================
// TIPOS Y INTERFACES
// ========================================

// Configuración de Mercado Pago
interface MercadoPagoConfig {
  accessToken: string;
  userId: string;
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
  customName?: string; // Nombre personalizado por el usuario
  operatingMode?: 'PDV' | 'STANDALONE'; // Modo de operación actual de la terminal
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

export interface PaymentOrderRequest {
  amount: number;
  description?: string; // Ahora opcional, se generará automáticamente
  externalReference?: string; // Ahora opcional, se generará automáticamente
  terminalId: string;
  expirationTime?: string; // ISO 8601 format (ej: "PT3M" = 3 minutos)
  printOnTerminal?: 'seller_ticket' | 'client_ticket' | 'both' | 'none';
  
  // Datos opcionales para generar external_reference y description
  orderId?: string; // ID de la orden (para orders/ID) o 'setting' para pruebas
  waiterName?: string; // Nombre del mesero
  userData?: { // Datos del usuario que hace el cobro (para guardar en Firestore)
    id: string;
    displayName: string;
    email: string;
    role: string;
  };
}

export interface PaymentOrderResponse {
  id: string;
  type: string;
  status: 'created' | 'at_terminal' | 'processing' | 'processed' | 'paid' | 'canceled' | 'expired' | 'failed';
  statusDetail: string;
  externalReference: string;
  description: string;
  amount: number;
  currency: string;
  createdDate: string;
  lastUpdatedDate: string;
  paymentId?: string;
  paymentStatus?: string;
  referenceId?: string; // ← NUEVO: Para certificación con Mercado Pago
  errorMessage?: string;
  
  // Datos para guardar en BD después
  rawResponse?: any; // Respuesta completa de la API
}

export interface PaymentStatusResponse {
  id: string;
  status: 'created' | 'at_terminal' | 'processing' | 'processed' | 'paid' | 'canceled' | 'expired' | 'failed';
  statusDetail: string;
  paymentId?: string;
  paymentStatus?: string;
  paymentStatusDetail?: string; // ← NUEVO: Detalle del estado del pago (ej: "accredited", "in_review")
  referenceId?: string; // ← NUEVO: Para certificación con Mercado Pago
  amount?: number;
  errorMessage?: string;
  
  // Datos para guardar en BD después
  rawResponse?: any; // Respuesta completa de la API
}

// ========================================
// CONFIGURACIÓN
// ========================================

const CONFIG: MercadoPagoConfig = {
  accessToken: import.meta.env.VITE_MERCADOPAGO_ACCESS_TOKEN || 'TEST-YOUR-ACCESS-TOKEN-HERE',
  userId: import.meta.env.VITE_MERCADOPAGO_USER_ID || 'YOUR-USER-ID',
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

const getBaseUrl = () => {
  // Siempre usar /api/mercadopago
  // En desarrollo: Vite proxy (vite.config.ts)
  // En producción: Firebase Function (firebase.json rewrite)
  return '/api/mercadopago';
};

// ========================================
// FUNCIONES DE TERMINALES
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
    // console.log('🔍 [MercadoPago] Obteniendo terminales registradas...');
    
    const response = await apiRequest<MercadoPagoDevicesResponse>(endpoint, 'GET');
    
    // console.log(`✅ [MercadoPago] ${response.devices?.length || 0} terminales encontradas`);
    return response.devices || [];
  } catch (error: any) {
    console.error('❌ [MercadoPago] Error al obtener terminales:', error);
    return [];
  }
};

/**
 * Cambia el modo de operación de una terminal
 * @param deviceId - ID de la terminal
 * @param mode - Modo de operación: 'PDV' (recibe órdenes desde API) o 'STANDALONE' (solo pagos manuales)
 * @returns true si el cambio fue exitoso
 */
export const setTerminalOperatingMode = async (
  deviceId: string,
  mode: 'PDV' | 'STANDALONE'
): Promise<{ success: boolean; error?: string }> => {
  const endpoint = `/point/integration-api/devices/${deviceId}`;
  
  try {
    // console.log(`🔄 [MercadoPago] Cambiando terminal ${deviceId} a modo ${mode}...`);
    
    const response = await apiRequest<{ id: string; operating_mode: string }>(
      endpoint,
      'PATCH' as any, // TypeScript fix
      { operating_mode: mode }
    );
    
    // console.log(`✅ [MercadoPago] Terminal ${deviceId} ahora en modo ${response.operating_mode}`);
    return { success: true };
  } catch (error: any) {
    console.error(`❌ [MercadoPago] Error al cambiar modo de terminal ${deviceId}:`, error);
    return { 
      success: false, 
      error: error?.message || 'Error al cambiar modo de operación'
    };
  }
};

/**
 * Obtiene las terminales reales formateadas como Terminal[]
 * @param enabledConfig - Opcional: objeto con la configuración de terminales habilitadas
 * @param namesConfig - Opcional: objeto con nombres personalizados de terminales
 */
export const getFormattedTerminals = async (
  enabledConfig?: Record<string, boolean>,
  namesConfig?: Record<string, string>
): Promise<Terminal[]> => {
  const devices = await fetchRealTerminals();
  
  return devices.map((device) => ({
    id: device.id,
    name: `Terminal ${device.id.split('__')[1] || device.id}`, // Extraer parte legible del ID
    location: device.operating_mode === 'PDV' ? 'Punto de Venta' : 'Standalone',
    storeId: device.store_id,
    posId: device.pos_id.toString(),
    externalId: device.external_pos_id || `BAR-POS-${device.id}`,
    enabled: enabledConfig ? (enabledConfig[device.id] !== false) : true, // Por defecto habilitadas
    customName: namesConfig?.[device.id], // Nombre personalizado si existe
    operatingMode: device.operating_mode // Modo de operación actual desde la API
  }));
};

/**
 * Obtiene solo las terminales habilitadas
 */
export const getEnabledTerminals = async (
  enabledConfig?: Record<string, boolean>,
  namesConfig?: Record<string, string>
): Promise<Terminal[]> => {
  const allTerminals = await getFormattedTerminals(enabledConfig, namesConfig);
  return allTerminals.filter(t => t.enabled !== false);
};

// ========================================
// FUNCIONES AUXILIARES API
// ========================================

/**
 * Realiza una petición a la API de Mercado Pago
 */
const apiRequest = async <T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
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
  
  // Agregar X-Idempotency-Key para POST/PUT/PATCH/DELETE
  if (method !== 'GET') {
    headers['X-Idempotency-Key'] = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    // console.log(`🌐 [MercadoPago Orders API] ${method} ${endpoint}`, body || '');
    
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ [MercadoPago Orders API] HTTP ${response.status}:`, data);
      throw new Error(data.message || `Error ${response.status}: ${response.statusText}`);
    }

    // console.log('✅ [MercadoPago Orders API] Response:', data);
    return data;
  } catch (error: any) {
    console.error('❌ [MercadoPago Orders API] Request failed:', error);
    throw error;
  }
};

// ========================================
// FUNCIONES PRINCIPALES
// ========================================

/**
 * Crea una orden de pago en la terminal Point usando v1/orders API
 * Documentación: https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/orders/create-order/post
 * 
 * @param request - Datos de la orden de pago
 * @returns Respuesta con el ID de la orden
 */
export const createPaymentOrder = async (
  request: PaymentOrderRequest
): Promise<PaymentOrderResponse> => {
  const terminal = getTerminal(request.terminalId);
  
  if (!terminal) {
    throw new Error(`Terminal no encontrada: ${request.terminalId}`);
  }

  // Validar monto mínimo de $5.00 MXN
  if (request.amount < 5) {
    throw new Error(`El monto mínimo para cobrar es $5.00 MXN (recibido: $${request.amount.toFixed(2)})`);
  }

  // ========================================
  // GENERAR EXTERNAL REFERENCE Y DESCRIPTION
  // ========================================
  
  // Formato: IDORDER-NombreMesero-Total-DD-MM-AA
  // Ejemplo: ORDER123-Juan-200-12-10-25 o setting-Admin-5-12-10-25
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  
  const orderId = request.orderId || 'setting';
  const waiterName = request.waiterName || request.userData?.displayName || 'Usuario';
  const total = Math.round(request.amount);
  
  const externalReference = request.externalReference || 
    `${orderId}-${waiterName}-${total}-${day}-${month}-${year}`;
  
  // Formato: CHEPECHUPES-IDORDER
  // Ejemplo: CHEPECHUPES-ORDER123 o CHEPECHUPES-setting
  const description = request.description || 
    `CHEPECHUPES-${orderId}`;

  console.log(`💳 [MercadoPago Orders API] 🚀 INICIANDO CREACIÓN DE ORDEN`);
  console.log(`📊 [MercadoPago Orders API] Datos de la orden:`, {
    amount: request.amount,
    terminal: terminal.name,
    terminalId: request.terminalId,
    externalReference: externalReference,
    description: description,
    orderId: orderId,
    waiterName: waiterName
  });

  // Endpoint para crear orden de pago
  const endpoint = `/v1/orders`;

  // Payload según documentación oficial
  const payload = {
    type: "point",
    external_reference: externalReference,
    description: description,
    expiration_time: request.expirationTime || "PT5M", // Default: 5 minutos
    transactions: {
      payments: [
        {
          amount: request.amount.toFixed(2) // String con 2 decimales
        }
      ]
    },
    config: {
      point: {
        terminal_id: request.terminalId,
        print_on_terminal: request.printOnTerminal || "seller_ticket"
      }
    }
  };

  try {
    // console.log(`📤 [MercadoPago Orders API] Enviando payload:`, JSON.stringify(payload, null, 2));

    const response = await apiRequest<any>(endpoint, 'POST', payload);

    // 🔍 LOG COMPLETO DE LA RESPUESTA
    // console.log(`✅ [MercadoPago Orders API] ✅✅✅ ORDEN CREADA EXITOSAMENTE ✅✅✅`);
    // console.log(`📋 [MercadoPago Orders API] 📋 RESPUESTA COMPLETA:`, JSON.stringify(response, null, 2));
    // console.log(`🆔 [MercadoPago Orders API] Order ID: ${response.id}`);
    // console.log(`📊 [MercadoPago Orders API] Status: ${response.status}`);
    // console.log(`📊 [MercadoPago Orders API] Status Detail: ${response.status_detail}`);
    // console.log(`💰 [MercadoPago Orders API] Amount: ${response.transactions?.payments?.[0]?.amount}`);
    // console.log(`🔗 [MercadoPago Orders API] External Reference: ${response.external_reference}`);
    // console.log(`🏪 [MercadoPago Orders API] Terminal ID: ${response.config?.point?.terminal_id}`);
    
    // Extraer payment ID si existe
    const paymentId = response.transactions?.payments?.[0]?.id;
    const paymentStatus = response.transactions?.payments?.[0]?.status;
    
    if (paymentId) {
      // console.log(`💳 [MercadoPago Orders API] Payment ID: ${paymentId}`);
      // console.log(`💳 [MercadoPago Orders API] Payment Status: ${paymentStatus}`);
    }

    // ========================================
    // GUARDAR EN FIRESTORE
    // ========================================
    if (request.userData) {
      // console.log(`💾 [MercadoPago Orders API] 💾 GUARDANDO EN FIRESTORE 💾`);
      
      try {
        const saveResult = await savePayment(response, request.userData);
        
        if (saveResult.success) {
          // console.log(`✅ [MercadoPago Orders API] ✅ Pago guardado en Firestore correctamente`);
        } else {
          console.error(`⚠️ [MercadoPago Orders API] Error al guardar en Firestore:`, saveResult.error);
        }
      } catch (error) {
        console.error(`❌ [MercadoPago Orders API] Error al guardar en Firestore:`, error);
      }
    } else {
      // console.log(`⚠️ [MercadoPago Orders API] No se guardará en Firestore (no hay userData)`);
    }

    return {
      id: response.id,
      type: response.type,
      status: response.status,
      statusDetail: response.status_detail,
      externalReference: response.external_reference,
      description: response.description,
      amount: parseFloat(response.transactions?.payments?.[0]?.amount || '0'),
      currency: response.currency,
      createdDate: response.created_date,
      lastUpdatedDate: response.last_updated_date,
      paymentId,
      paymentStatus,
      rawResponse: response // Guardar respuesta completa para BD
    };
  } catch (error: any) {
    console.error('❌ [MercadoPago Orders API] ❌❌❌ ERROR AL CREAR ORDEN ❌❌❌');
    console.error('❌ [MercadoPago Orders API] Error completo:', JSON.stringify(error, null, 2));
    console.error('❌ [MercadoPago Orders API] Error message:', error.message);
    console.error('❌ [MercadoPago Orders API] Error stack:', error.stack);
    
    throw new Error(`No se pudo crear la orden de pago: ${error.message}`);
  }
};

/**
 * Consulta el estado de una orden de pago
 * Documentación: https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/orders/get-order/get
 * 
 * @param orderId - ID de la orden
 * @returns Estado actual de la orden
 */
export const getOrderStatus = async (
  orderId: string
): Promise<PaymentStatusResponse> => {
  // console.log(`🔍 [MercadoPago Orders API] 🔍 CONSULTANDO ESTADO DE ORDEN: ${orderId}`);

  const endpoint = `/v1/orders/${orderId}`;

  try {
    const response = await apiRequest<any>(endpoint, 'GET');
    
    // 🔍 LOG COMPLETO DE LA RESPUESTA
    // console.log(`✅ [MercadoPago Orders API] ✅ ESTADO OBTENIDO ✅`);
    // console.log(`📋 [MercadoPago Orders API] 📋 RESPUESTA COMPLETA:`, JSON.stringify(response, null, 2));
    // console.log(`🆔 [MercadoPago Orders API] Order ID: ${response.id}`);
    // console.log(`📊 [MercadoPago Orders API] Status: ${response.status}`);
    // console.log(`📊 [MercadoPago Orders API] Status Detail: ${response.status_detail}`);
    // console.log(`💰 [MercadoPago Orders API] Amount: ${response.transactions?.payments?.[0]?.amount}`);
    
    // Extraer payment info
    const paymentId = response.transactions?.payments?.[0]?.id;
    const paymentStatus = response.transactions?.payments?.[0]?.status;
    const paymentStatusDetail = response.transactions?.payments?.[0]?.status_detail;
    const referenceId = response.transactions?.payments?.[0]?.reference_id;
    
    if (paymentId) {
      // console.log(`💳 [MercadoPago Orders API] Payment ID: ${paymentId}`);
      // console.log(`💳 [MercadoPago Orders API] Payment Status: ${paymentStatus}`);
      // console.log(`💳 [MercadoPago Orders API] Payment Status Detail: ${paymentStatusDetail}`);
      // console.log(`🔢 [MercadoPago Orders API] Reference ID: ${referenceId}`);
    }

    // TODO: Aquí se actualizará en BD después
    console.log(`💾 [MercadoPago Orders API] 💾 TODO: ACTUALIZAR EN BD 💾`);
    console.log(`💾 [MercadoPago Orders API] Datos para actualizar:`, {
      orderId: response.id,
      status: response.status,
      statusDetail: response.status_detail,
      paymentId,
      paymentStatus,
      paymentStatusDetail,
      referenceId,
      lastUpdatedDate: response.last_updated_date,
      rawResponse: response
    });

    return {
      id: response.id,
      status: response.status,
      statusDetail: response.status_detail,
      paymentId,
      paymentStatus,
      paymentStatusDetail,
      referenceId,
      amount: parseFloat(response.transactions?.payments?.[0]?.amount || '0'),
      rawResponse: response // Guardar respuesta completa para BD
    };
  } catch (error: any) {
    console.error('❌ [MercadoPago Orders API] ❌❌❌ ERROR AL CONSULTAR ESTADO ❌❌❌');
    console.error('❌ [MercadoPago Orders API] Error completo:', JSON.stringify(error, null, 2));
    console.error('❌ [MercadoPago Orders API] Error message:', error.message);
    
    throw new Error(`No se pudo consultar el estado de la orden: ${error.message}`);
  }
};

/**
 * Cancela una orden de pago pendiente
 * Documentación: https://www.mercadopago.com.mx/developers/es/reference/in-person-payments/point/orders/cancel-order/post
 * 
 * @param orderId - ID de la orden a cancelar
 */
export const cancelPaymentOrder = async (
  orderId: string
): Promise<void> => {
  // console.log(`🚫 [MercadoPago Orders API] 🚫 CANCELANDO ORDEN: ${orderId}`);

  const endpoint = `/v1/orders/${orderId}/cancel`;

  try {
    const response = await apiRequest<any>(endpoint, 'POST');
    
    // 🔍 LOG COMPLETO DE LA RESPUESTA
    // console.log(`✅ [MercadoPago Orders API] ✅ ORDEN CANCELADA ✅`);
    // console.log(`📋 [MercadoPago Orders API] 📋 RESPUESTA COMPLETA:`, JSON.stringify(response, null, 2));
    // console.log(`🆔 [MercadoPago Orders API] Order ID: ${response.id}`);
    // console.log(`📊 [MercadoPago Orders API] Status: ${response.status}`);
    // console.log(`📊 [MercadoPago Orders API] Status Detail: ${response.status_detail}`);

    // TODO: Aquí se actualizará en BD después
    console.log(`💾 [MercadoPago Orders API] 💾 TODO: ACTUALIZAR EN BD 💾`);
    console.log(`💾 [MercadoPago Orders API] Datos para actualizar:`, {
      orderId: response.id,
      status: 'canceled',
      statusDetail: response.status_detail,
      canceledDate: response.last_updated_date,
      rawResponse: response
    });
  } catch (error: any) {
    console.error('❌ [MercadoPago Orders API] ❌❌❌ ERROR AL CANCELAR ORDEN ❌❌❌');
    console.error('❌ [MercadoPago Orders API] Error completo:', JSON.stringify(error, null, 2));
    console.error('❌ [MercadoPago Orders API] Error message:', error.message);
    
    throw new Error(`No se pudo cancelar la orden: ${error.message}`);
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
  request: PaymentOrderRequest,
  onStatusChange?: (status: string, message: string) => void
): Promise<PaymentOrderResponse> => {
  try {
    // console.log(`🚀 [MercadoPago Orders API] 🚀🚀🚀 INICIANDO PROCESO DE PAGO 🚀🚀🚀`);
    
    // 1. Crear orden de pago
    onStatusChange?.('sending', 'Enviando orden a la terminal...');
    const order = await createPaymentOrder(request);

    if (!order.id) {
      throw new Error('No se obtuvo ID de la orden');
    }

    // console.log(`✅ [MercadoPago Orders API] Orden creada: ${order.id}`);

    // 2. Hacer polling del estado cada 5 segundos (máximo 90 segundos)
    onStatusChange?.('processing', 'Esperando pago del cliente en la terminal...');
    
    const maxAttempts = 18; // 18 intentos x 5 segundos = 90 segundos
    let attempts = 0;
    let finalStatus: PaymentStatusResponse | null = null;

    while (attempts < maxAttempts) {
      attempts++;
      // console.log(`🔄 [MercadoPago Orders API] Polling intento ${attempts}/${maxAttempts}`);
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos

      try {
        const status = await getOrderStatus(order.id);
        finalStatus = status;

        // console.log(`📊 [MercadoPago Orders API] Estado actual: ${status.status} (${status.statusDetail})`);
        
        // Actualizar UI con countdown
        const remainingSeconds = (maxAttempts - attempts) * 5;
        onStatusChange?.('processing', `Esperando pago del cliente... (${remainingSeconds}s)`);

        // Verificar si el pago fue aprobado, rechazado o cancelado
        // La API puede devolver 'processed' o 'paid' para pagos exitosos
        if (status.status === 'paid' || status.status === 'processed') {
          // console.log(`✅ [MercadoPago Orders API] ✅✅✅ PAGO APROBADO ✅✅✅`);
          // console.log(`💳 [MercadoPago Orders API] Payment Status: ${status.paymentStatus}`);
          // console.log(`💳 [MercadoPago Orders API] Status Detail: ${status.paymentStatusDetail}`);
          // console.log(`🔢 [MercadoPago Orders API] Reference ID: ${status.referenceId}`);
          onStatusChange?.('success', '¡Pago procesado exitosamente!');
          break;
        } else if (status.status === 'failed') {
          // console.log(`❌ [MercadoPago Orders API] ❌❌❌ PAGO RECHAZADO/FALLIDO ❌❌❌`);
          // console.log(`💳 [MercadoPago Orders API] Payment Status: ${status.paymentStatus}`);
          // console.log(`💳 [MercadoPago Orders API] Status Detail: ${status.paymentStatusDetail}`);
          // console.log(`🔢 [MercadoPago Orders API] Reference ID: ${status.referenceId}`);
          onStatusChange?.('rejected', status.statusDetail || 'Pago rechazado');
          break;
        } else if (status.status === 'canceled') {
          // console.log(`❌ [MercadoPago Orders API] Pago cancelado`);
          onStatusChange?.('rejected', 'Pago cancelado');
          break;
        } else if (status.status === 'expired') {
          // console.log(`❌ [MercadoPago Orders API] Orden expirada`);
          onStatusChange?.('error', 'Tiempo límite excedido');
          break;
        }
      } catch (error: any) {
        console.warn(`⚠️ [MercadoPago Orders API] Error en polling (intento ${attempts}):`, error.message);
        
        // Si es rate limit (429), esperar 10 segundos extra
        if (error.message?.includes('Too Many Requests') || error.message?.includes('429')) {
          // console.log(`⏳ [MercadoPago Orders API] Rate limit - esperando 10s extra...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    }

    // 3. Retornar resultado final
    if (!finalStatus || (finalStatus.status !== 'paid' && finalStatus.status !== 'processed' && finalStatus.status !== 'failed' && finalStatus.status !== 'canceled' && finalStatus.status !== 'expired')) {
      // console.log(`⏱️ [MercadoPago Orders API] Timeout - no se obtuvo respuesta del cliente`);
      onStatusChange?.('error', 'Tiempo límite excedido. Verifica el estado en Mercado Pago.');
      throw new Error('Timeout: No se recibió confirmación del pago');
    }

    // ========================================
    // ACTUALIZAR EN FIRESTORE CON ESTADO FINAL
    // ========================================
    if (request.userData && finalStatus.rawResponse) {
      // console.log(`💾 [MercadoPago Orders API] 💾 ACTUALIZANDO ESTADO FINAL EN FIRESTORE 💾`);
      
      try {
        const saveResult = await savePayment(finalStatus.rawResponse, request.userData);
        
        if (saveResult.success) {
          // console.log(`✅ [MercadoPago Orders API] ✅ Estado final guardado en Firestore correctamente`);
        } else {
          console.error(`⚠️ [MercadoPago Orders API] Error al actualizar en Firestore:`, saveResult.error);
        }
      } catch (error) {
        console.error(`❌ [MercadoPago Orders API] Error al actualizar en Firestore:`, error);
      }
    }

    // Actualizar el objeto de orden con el estado final
    return {
      ...order,
      status: finalStatus.status,
      statusDetail: finalStatus.statusDetail,
      paymentId: finalStatus.paymentId,
      paymentStatus: finalStatus.paymentStatus,
      referenceId: finalStatus.referenceId,
      rawResponse: finalStatus.rawResponse
    };

  } catch (error: any) {
    console.error('❌ [MercadoPago Orders API] ❌❌❌ ERROR EN PROCESO DE PAGO ❌❌❌');
    console.error('❌ [MercadoPago Orders API] Error:', error);
    onStatusChange?.('error', error.message || 'Error procesando el pago');
    throw error;
  }
};

// ========================================
// EXPORT DE CONFIGURACIÓN
// ========================================
export { TERMINALS, CONFIG };
