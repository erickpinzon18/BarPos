/**
 * Servicio para gestionar Sucursales (Stores) y Cajas (POS) de Mercado Pago
 * 
 * Documentación:
 * - Stores: https://www.mercadopago.com.mx/developers/es/reference/stores
 * - POS: https://www.mercadopago.com.mx/developers/es/reference/pos
 */

const API_BASE = '/api/mercadopago';

// Obtener configuración desde variables de entorno
const CONFIG = {
  userId: import.meta.env.VITE_MERCADOPAGO_USER_ID || '',
  accessToken: import.meta.env.VITE_MERCADOPAGO_ACCESS_TOKEN || '',
};

// Log de configuración al cargar el módulo
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('⚙️ Mercado Pago Stores Service - Configuration');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('👤 User ID:', CONFIG.userId || '❌ NOT CONFIGURED');
console.log('🔑 Access Token:', CONFIG.accessToken ? `${CONFIG.accessToken.substring(0, 20)}... (${CONFIG.accessToken.length} chars)` : '❌ NOT CONFIGURED');
console.log('🌐 API Base:', API_BASE);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ==================== TIPOS ====================

export interface StoreLocation {
  address_line: string; // Línea completa de dirección: "Street Name, Number, City, State"
  latitude?: number;
  longitude?: number;
  reference?: string;
}

export interface BusinessHours {
  monday?: { open: string; close: string }[];
  tuesday?: { open: string; close: string }[];
  wednesday?: { open: string; close: string }[];
  thursday?: { open: string; close: string }[];
  friday?: { open: string; close: string }[];
  saturday?: { open: string; close: string }[];
  sunday?: { open: string; close: string }[];
}

export interface Store {
  id: string;
  name: string;
  date_creation?: string;
  business_hours?: BusinessHours;
  location: StoreLocation;
  external_id?: string;
}

export interface CreateStorePayload {
  name: string;
  business_hours?: BusinessHours;
  location: StoreLocation;
  external_id?: string;
}

export interface UpdateStorePayload {
  name?: string;
  business_hours?: BusinessHours;
  location?: StoreLocation;
  external_id?: string;
}

export interface POS {
  id: string;
  name: string;
  fixed_amount?: boolean;
  category?: number; // Opcional porque puede no estar configurado
  store_id: string;
  external_id?: string;
  external_store_id?: string; // ID externo de la sucursal
  date_created?: string;
  date_last_updated?: string;
}

export interface CreatePOSPayload {
  name: string;
  fixed_amount?: boolean;
  category: number;
  store_id: string;
  external_id?: string;
  external_store_id?: string; // ID externo de la sucursal
}

export interface UpdatePOSPayload {
  name?: string;
  fixed_amount?: boolean;
  category?: number;
  external_id?: string;
  external_store_id?: string; // ID externo de la sucursal (aunque no se puede cambiar el store_id)
}

export interface StoresSearchResponse {
  results: Store[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
}

export interface POSSearchResponse {
  results: POS[];
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
}

// Tipos para Devices/Terminales
export interface Device {
  id: string;
  pos_id: number;
  store_id: string;
  external_pos_id?: string;
  operating_mode: 'PDV' | 'STANDALONE' | 'UNDEFINED';
  date_created?: string;
  date_last_updated?: string;
}

export interface DevicesSearchResponse {
  data: {
    terminals: Device[];
  };
  paging: {
    total: number;
    offset: number;
    limit: number;
  };
}

// Categorías MCC oficiales soportadas por Mercado Pago
// Documentación: https://www.mercadopago.com/developers/es/reference/pos
export const MCC_CATEGORIES = {
  GASTRONOMY: 5812,      // Gastronomía (restaurantes, bares, cafeterías)
  GAS_STATION: 468419,   // Estación de Servicio
} as const;

// ==================== FUNCIONES AUXILIARES ====================

/**
 * Genera un UUID v4 simple para usar como idempotency key
 */
function generateIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Función genérica para hacer peticiones a la API de Mercado Pago
 */
async function apiRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' = 'GET',
  body?: any
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const headers: HeadersInit = {
      'Authorization': `Bearer ${CONFIG.accessToken}`,
      'Content-Type': 'application/json',
    };

    // Agregar Idempotency-Key para POST, PUT, PATCH
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      headers['X-Idempotency-Key'] = generateIdempotencyKey();
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const fullUrl = `${API_BASE}${endpoint}`;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔵 Mercado Pago API Request');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 Full URL:', fullUrl);
    console.log('📍 Endpoint:', endpoint);
    console.log('🔧 Method:', method);
    console.log('🔑 Authorization:', CONFIG.accessToken ? `Bearer ${CONFIG.accessToken.substring(0, 20)}...` : '❌ NO TOKEN');
    console.log('👤 User ID:', CONFIG.userId || '❌ NO USER ID');
    console.log('📋 Headers:', JSON.stringify(headers, null, 2));
    if (body) {
      console.log('📤 Body:', JSON.stringify(body, null, 2));
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const response = await fetch(fullUrl, options);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`${response.ok ? '✅' : '❌'} Response Status: ${response.status} ${response.statusText}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const data = await response.json();
    console.log('📥 Response Data:', JSON.stringify(data, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!response.ok) {
      console.error('❌ Request Failed');
      console.error('Status:', response.status);
      console.error('Error:', data.error);
      console.error('Message:', data.message);
      if (data.causes) {
        console.error('Causes:', data.causes);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
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

    console.log('✅ Request Successful');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return { success: true, data };
  } catch (error: any) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('💥 Exception in API Request');
    console.error('Error:', error);
    console.error('Message:', error?.message);
    console.error('Stack:', error?.stack);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return {
      success: false,
      error: error?.message || 'Error desconocido en la petición',
    };
  }
}

// ==================== API DE STORES (SUCURSALES) ====================

/**
 * Obtener una sucursal por ID
 * curl -X GET 'https://api.mercadopago.com/stores/31410148'
 */
export async function getStore(storeId: string): Promise<{ success: boolean; data?: Store; error?: string }> {
  console.log('🔍 getStore() called with ID:', storeId);
  return apiRequest<Store>(`/stores/${storeId}`, 'GET');
}

/**
 * Buscar todas las sucursales del usuario
 * curl -X GET 'https://api.mercadopago.com/users/{user_id}/stores/search?external_id=SUC001'
 * 
 * Parámetros query opcionales:
 * - offset: número de elementos a saltar (default: 0)
 * - limit: número máximo de resultados (default: 50)
 * - external_id: buscar por ID externo específico
 */
export async function searchStores(
  params?: {
    offset?: number;
    limit?: number;
    external_id?: string;
  }
): Promise<{ success: boolean; data?: StoresSearchResponse; error?: string }> {
  const { offset = 0, limit = 50, external_id } = params || {};
  
  console.log('🔍 searchStores() called');
  console.log('📊 Parameters:', { offset, limit, external_id, userId: CONFIG.userId });
  
  // Validar configuración
  if (!CONFIG.userId || CONFIG.userId === 'YOUR-USER-ID') {
    console.error('❌ User ID not configured!');
    return {
      success: false,
      error: 'VITE_MERCADOPAGO_USER_ID no está configurado en el archivo .env',
    };
  }
  
  if (!CONFIG.accessToken || (!CONFIG.accessToken.includes('APP_') && !CONFIG.accessToken.includes('TEST-'))) {
    console.error('❌ Access Token not configured or invalid!');
    return {
      success: false,
      error: 'VITE_MERCADOPAGO_ACCESS_TOKEN no está configurado correctamente en el archivo .env',
    };
  }
  
  // Construir query string
  const queryParams = new URLSearchParams();
  if (offset) queryParams.append('offset', offset.toString());
  if (limit) queryParams.append('limit', limit.toString());
  if (external_id) queryParams.append('external_id', external_id);
  
  const queryString = queryParams.toString();
  const endpoint = `/users/${CONFIG.userId}/stores/search${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<StoresSearchResponse>(endpoint, 'GET');
}

/**
 * Crear una nueva sucursal
 * curl -X POST 'https://api.mercadopago.com/users/{user_id}/stores'
 */
export async function createStore(
  payload: CreateStorePayload
): Promise<{ success: boolean; data?: Store; error?: string }> {
  console.log('➕ createStore() called');
  console.log('📤 Payload:', payload);
  
  if (!CONFIG.userId) {
    return {
      success: false,
      error: 'VITE_MERCADOPAGO_USER_ID no está configurado',
    };
  }
  
  const endpoint = `/users/${CONFIG.userId}/stores`;
  return apiRequest<Store>(endpoint, 'POST', payload);
}

/**
 * Actualizar una sucursal existente
 * curl -X PUT 'https://api.mercadopago.com/users/{user_id}/stores/{store_id}'
 */
export async function updateStore(
  storeId: string,
  payload: UpdateStorePayload
): Promise<{ success: boolean; data?: Store; error?: string }> {
  console.log('✏️ updateStore() called with ID:', storeId);
  console.log('📤 Payload:', payload);
  
  if (!CONFIG.userId) {
    return {
      success: false,
      error: 'VITE_MERCADOPAGO_USER_ID no está configurado',
    };
  }
  
  const endpoint = `/users/${CONFIG.userId}/stores/${storeId}`;
  return apiRequest<Store>(endpoint, 'PUT', payload);
}

/**
 * Eliminar una sucursal
 * curl -X DELETE 'https://api.mercadopago.com/users/{user_id}/stores/{store_id}'
 * 
 * NOTA: No se puede eliminar si tiene cajas (POS) asociadas
 */
export async function deleteStore(
  storeId: string
): Promise<{ success: boolean; data?: { id: string; status: string }; error?: string }> {
  console.log('🗑️ deleteStore() called with ID:', storeId);
  
  if (!CONFIG.userId) {
    return {
      success: false,
      error: 'VITE_MERCADOPAGO_USER_ID no está configurado',
    };
  }
  
  const endpoint = `/users/${CONFIG.userId}/stores/${storeId}`;
  return apiRequest<{ id: string; status: string }>(endpoint, 'DELETE');
}

// ==================== API DE POS (CAJAS) ====================

/**
 * Obtener una caja por ID
 * curl -X GET 'https://api.mercadopago.com/pos/1988157'
 */
export async function getPOS(posId: string): Promise<{ success: boolean; data?: POS; error?: string }> {
  console.log('🔍 getPOS() called with ID:', posId);
  return apiRequest<POS>(`/pos/${posId}`, 'GET');
}

/**
 * Buscar todas las cajas (opcionalmente filtradas)
 * curl -X GET 'https://api.mercadopago.com/pos?external_id=SUC001POS001'
 * 
 * Parámetros query opcionales:
 * - store_id: filtrar por sucursal
 * - external_id: buscar por ID externo específico
 * - offset: número de elementos a saltar (default: 0)
 * - limit: número máximo de resultados (default: 50)
 */
export async function searchPOS(
  params?: {
    store_id?: string;
    external_id?: string;
    offset?: number;
    limit?: number;
  }
): Promise<{ success: boolean; data?: POSSearchResponse; error?: string }> {
  const { store_id, external_id, offset = 0, limit = 50 } = params || {};
  
  console.log('🔍 searchPOS() called');
  console.log('📊 Parameters:', { store_id, external_id, offset, limit });
  
  // Construir query string
  const queryParams = new URLSearchParams();
  if (offset) queryParams.append('offset', offset.toString());
  if (limit) queryParams.append('limit', limit.toString());
  if (store_id) queryParams.append('store_id', store_id);
  if (external_id) queryParams.append('external_id', external_id);
  
  const queryString = queryParams.toString();
  const endpoint = `/pos${queryString ? `?${queryString}` : ''}`;
  
  return apiRequest<POSSearchResponse>(endpoint, 'GET');
}

/**
 * Crear una nueva caja
 * curl -X POST 'https://api.mercadopago.com/pos'
 */
export async function createPOS(
  payload: CreatePOSPayload
): Promise<{ success: boolean; data?: POS; error?: string }> {
  console.log('➕ createPOS() called');
  console.log('📤 Payload:', payload);
  
  return apiRequest<POS>('/pos', 'POST', payload);
}

/**
 * Actualizar una caja existente
 * curl -X PUT 'https://api.mercadopago.com/pos/{pos_id}'
 * 
 * NOTA: No se puede cambiar el store_id
 */
export async function updatePOS(
  posId: string,
  payload: UpdatePOSPayload
): Promise<{ success: boolean; data?: POS; error?: string }> {
  console.log('✏️ updatePOS() called with ID:', posId);
  console.log('📤 Payload:', payload);
  
  return apiRequest<POS>(`/pos/${posId}`, 'PUT', payload);
}

/**
 * Eliminar una caja
 * curl -X DELETE 'https://api.mercadopago.com/pos/{pos_id}'
 */
export async function deletePOS(
  posId: string
): Promise<{ success: boolean; data?: { id: string; status: string }; error?: string }> {
  console.log('🗑️ deletePOS() called with ID:', posId);
  
  return apiRequest<{ id: string; status: string }>(`/pos/${posId}`, 'DELETE');
}

// ==================== DEVICES / TERMINALES ====================

/**
 * Buscar devices/terminales asociados a un POS
 * 
 * Curl de referencia:
 * curl -X GET \
 *   'https://api.mercadopago.com/terminals/v1/list?pos_id=XXX&limit=50' \
 *   -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
 */
export async function getDevicesByPOS(
  posId: string
): Promise<{ success: boolean; data?: DevicesSearchResponse; error?: string }> {
  console.log('📱 getDevicesByPOS() called for POS ID:', posId);
  
  return apiRequest<DevicesSearchResponse>(`/terminals/v1/list?pos_id=${posId}&limit=50`, 'GET');
}

/**
 * Obtener todas las cajas con sus terminales asociadas
 */
export async function getPOSWithDevices(
  storeId?: string
): Promise<{
  success: boolean;
  data?: Array<POS & { devices: Device[] }>;
  error?: string;
}> {
  console.log('🏪📱 getPOSWithDevices() - Starting to fetch POS and Devices');
  
  try {
    // Paso 1: Obtener todos los POS (filtrados por store si se especifica)
    const posResult = await searchPOS(storeId ? { store_id: storeId } : {});
    
    if (!posResult.success || !posResult.data) {
      return {
        success: false,
        error: posResult.error || 'Error al obtener POS',
      };
    }
    
    const posList = posResult.data.results;
    console.log(`✅ Found ${posList.length} POS`);
    
    // Paso 2: Para cada POS, obtener sus devices
    const posWithDevices = await Promise.all(
      posList.map(async (pos) => {
        const devicesResult = await getDevicesByPOS(pos.id);
        
        return {
          ...pos,
          devices: devicesResult.success && devicesResult.data 
            ? devicesResult.data.data.terminals 
            : [],
        };
      })
    );
    
    console.log(`✅ Loaded devices for all ${posWithDevices.length} POS`);
    
    return {
      success: true,
      data: posWithDevices,
    };
  } catch (error: any) {
    console.error('❌ Error in getPOSWithDevices:', error);
    return {
      success: false,
      error: error?.message || 'Error al cargar POS con devices',
    };
  }
}

// ==================== FUNCIONES DE UTILIDAD ====================

/**
 * Obtener todas las sucursales con sus cajas asociadas
 */
export async function getStoresWithPOS(): Promise<{
  success: boolean;
  data?: Array<Store & { pos: POS[] }>;
  error?: string;
}> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏪 getStoresWithPOS() - Starting to fetch stores and POS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    // 1. Obtener todas las sucursales
    console.log('📍 Step 1: Fetching stores...');
    const storesResult = await searchStores();
    
    if (!storesResult.success || !storesResult.data) {
      console.error('❌ Failed to fetch stores:', storesResult.error);
      return { success: false, error: storesResult.error || 'Error al obtener sucursales' };
    }

    const stores = storesResult.data.results;
    console.log(`✅ Found ${stores.length} stores`);

    // 2. Obtener todas las cajas
    console.log('📍 Step 2: Fetching POS...');
    const posResult = await searchPOS();
    
    if (!posResult.success || !posResult.data) {
      console.error('❌ Failed to fetch POS:', posResult.error);
      return { success: false, error: posResult.error || 'Error al obtener cajas' };
    }

    const allPOS = posResult.data.results;
    console.log(`✅ Found ${allPOS.length} POS`);

    // 3. Asociar cajas a sus sucursales
    console.log('📍 Step 3: Associating POS to stores...');
    const storesWithPOS = stores.map((store) => {
      const storePOS = allPOS.filter((pos) => pos.store_id === store.id);
      console.log(`  Store "${store.name}" (${store.id}) has ${storePOS.length} POS`);
      return {
        ...store,
        pos: storePOS,
      };
    });

    console.log('✅ Successfully associated all POS to stores');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return { success: true, data: storesWithPOS };
  } catch (error: any) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('💥 Exception in getStoresWithPOS:', error);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return {
      success: false,
      error: error?.message || 'Error desconocido',
    };
  }
}

/**
 * Validar que una sucursal no tenga cajas antes de eliminarla
 */
export async function canDeleteStore(storeId: string): Promise<{
  canDelete: boolean;
  reason?: string;
  posCount?: number;
}> {
  try {
    const posResult = await searchPOS({ store_id: storeId });
    if (!posResult.success) {
      return { canDelete: false, reason: 'Error al verificar cajas asociadas' };
    }

    const posCount = posResult.data?.results.length || 0;
    if (posCount > 0) {
      return {
        canDelete: false,
        reason: `La sucursal tiene ${posCount} caja${posCount > 1 ? 's' : ''} asociada${posCount > 1 ? 's' : ''}`,
        posCount,
      };
    }

    return { canDelete: true };
  } catch (error) {
    return { canDelete: false, reason: 'Error al verificar cajas' };
  }
}

/**
 * Validar horarios de negocio
 */
export function validateBusinessHours(hours: BusinessHours): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

  days.forEach((day) => {
    const dayHours = hours[day];
    if (dayHours && Array.isArray(dayHours)) {
      dayHours.forEach((slot, index) => {
        if (!timeRegex.test(slot.open)) {
          errors.push(`${day} slot ${index + 1}: Formato inválido de hora de apertura (${slot.open})`);
        }
        if (!timeRegex.test(slot.close)) {
          errors.push(`${day} slot ${index + 1}: Formato inválido de hora de cierre (${slot.close})`);
        }
        if (slot.open >= slot.close) {
          errors.push(`${day} slot ${index + 1}: La hora de cierre debe ser posterior a la de apertura`);
        }
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

/**
 * Obtener el nombre de una categoría MCC
 */
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

/**
 * Verificar configuración de Mercado Pago
 */
export function checkMercadoPagoConfig(): { configured: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!CONFIG.userId || CONFIG.userId === 'YOUR-USER-ID') {
    errors.push('VITE_MERCADOPAGO_USER_ID no configurado');
  }

  if (!CONFIG.accessToken || !CONFIG.accessToken.includes('APP_')) {
    errors.push('VITE_MERCADOPAGO_ACCESS_TOKEN no configurado o inválido');
  }

  return {
    configured: errors.length === 0,
    errors,
  };
}
