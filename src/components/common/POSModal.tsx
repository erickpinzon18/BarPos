import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  type POS,
  type CreatePOSPayload,
  type UpdatePOSPayload,
  type Store,
  createPOS,
  updatePOS,
  MCC_CATEGORIES,
  getMCCCategoryName,
} from '../../services/mercadoPagoStoresService';

interface POSModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  pos?: POS | null; // Si existe, es edición; si no, es creación
  stores: Store[]; // Lista de sucursales disponibles
  preselectedStoreId?: string; // Sucursal preseleccionada al crear
}

const POSModal: React.FC<POSModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  pos,
  stores,
  preselectedStoreId,
}) => {
  const isEditing = !!pos;

  // Form states
  const [name, setName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [category, setCategory] = useState<number>(MCC_CATEGORIES.GASTRONOMY);
  const [fixedAmount, setFixedAmount] = useState(false);
  const [externalId, setExternalId] = useState('');
  const [externalStoreId, setExternalStoreId] = useState('');
  const [saving, setSaving] = useState(false);

  // Cargar datos si es edición
  useEffect(() => {
    if (pos) {
      // console.log('📝 Editando POS:', pos);
      // console.log('  - Nombre:', pos.name);
      // console.log('  - Category (original):', pos.category);
      // console.log('  - Store ID:', pos.store_id);
      // console.log('  - Fixed amount:', pos.fixed_amount);
      // console.log('  - External ID:', pos.external_id);
      // console.log('  - External Store ID:', pos.external_store_id);
      
      setName(pos.name || '');
      setStoreId(pos.store_id || '');
      setCategory(pos.category || MCC_CATEGORIES.GASTRONOMY);
      setFixedAmount(pos.fixed_amount || false);
      setExternalId(pos.external_id || '');
      setExternalStoreId(pos.external_store_id || '');
      
      // console.log('  - Category (estado):', pos.category || MCC_CATEGORIES.GASTRONOMY);
    } else {
      // console.log('➕ Creando nuevo POS');
      // console.log('  - Sucursal preseleccionada:', preselectedStoreId);
      
      // Resetear formulario
      setName('');
      setStoreId(preselectedStoreId || '');
      setCategory(MCC_CATEGORIES.GASTRONOMY);
      setFixedAmount(false);
      setExternalId('');
      setExternalStoreId('');
    }
  }, [pos, preselectedStoreId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!name.trim()) {
      toast.error('El nombre de la caja es obligatorio');
      return;
    }

    if (!storeId) {
      toast.error('Debes seleccionar una sucursal');
      return;
    }

    setSaving(true);

    try {
      if (isEditing && pos) {
        // Actualizar (no se puede cambiar store_id)
        const payload: UpdatePOSPayload = {
          name,
          category,
          fixed_amount: fixedAmount,
        };
        if (externalId.trim()) payload.external_id = externalId;
        if (externalStoreId.trim()) payload.external_store_id = externalStoreId;

        const result = await updatePOS(pos.id, payload);
        if (!result.success) {
          // Extraer mensajes de validación del resultado
          const error: any = result.data || new Error(result.error || 'Error al actualizar caja');
          error.message = result.error || 'Error al actualizar caja';
          throw error;
        }

        toast.success('✅ Caja actualizada correctamente');
      } else {
        // Crear
        const payload: CreatePOSPayload = {
          name,
          store_id: storeId,
          category,
          fixed_amount: fixedAmount,
        };
        if (externalId.trim()) payload.external_id = externalId;
        if (externalStoreId.trim()) payload.external_store_id = externalStoreId;

        const result = await createPOS(payload);
        if (!result.success) {
          // Extraer mensajes de validación del resultado
          const error: any = result.data || new Error(result.error || 'Error al crear caja');
          error.message = result.error || 'Error al crear caja';
          throw error;
        }

        toast.success('✅ Caja creada correctamente');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error al guardar caja:', error);
      
      // Extraer mensajes de validación detallados si existen
      let errorMessage = error?.message || 'Error al guardar caja';
      
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
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <h3 className="text-2xl font-bold text-white">
            {isEditing ? '✏️ Editar Caja' : '➕ Crear Nueva Caja'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Advertencia si no tiene category */}
          {isEditing && !pos?.category && (
            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
              <p className="text-sm text-yellow-200">
                ⚠️ <strong>Advertencia:</strong> Esta caja no tiene categoría MCC configurada. 
                Por favor selecciona una para que funcione correctamente con Mercado Pago.
              </p>
            </div>
          )}
          
          {/* Información Básica */}
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            <h4 className="text-lg font-semibold text-amber-400 mb-4">💰 Información de la Caja</h4>
            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  Nombre de la Caja *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Ej: Caja Principal"
                  required
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  Sucursal *
                  {isEditing && (
                    <span className="ml-2 text-xs text-yellow-400">
                      (No se puede cambiar en edición)
                    </span>
                  )}
                </label>
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  disabled={isEditing}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">Selecciona una sucursal</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name} {store.external_id ? `(${store.external_id})` : ''}
                    </option>
                  ))}
                </select>
                {stores.length === 0 && (
                  <p className="mt-2 text-xs text-yellow-400">
                    ⚠️ No hay sucursales disponibles. Crea una sucursal primero.
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  Categoría MCC *
                </label>
                {(() => {
                  // console.log('🏷️ Renderizando select MCC');
                  // console.log('  - Valor actual de category:', category);
                  // console.log('  - MCC_CATEGORIES:', MCC_CATEGORIES);
                  return null;
                })()}
                <select
                  value={category}
                  onChange={(e) => {
                    const newValue = parseInt(e.target.value);
                    // console.log('🔄 Cambiando MCC de', category, 'a', newValue);
                    setCategory(newValue);
                  }}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5 focus:ring-amber-500 focus:border-amber-500"
                  required
                >
                  <option value={MCC_CATEGORIES.GASTRONOMY}>
                    {MCC_CATEGORIES.GASTRONOMY} - {getMCCCategoryName(MCC_CATEGORIES.GASTRONOMY)}
                  </option>
                  <option value={MCC_CATEGORIES.GAS_STATION}>
                    {MCC_CATEGORIES.GAS_STATION} - {getMCCCategoryName(MCC_CATEGORIES.GAS_STATION)}
                  </option>
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Código de categoría de comercio (Merchant Category Code)
                  <span className="block mt-1 text-amber-400">
                    Actual: {category} - {getMCCCategoryName(category)}
                  </span>
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fixedAmount}
                    onChange={(e) => setFixedAmount(e.target.checked)}
                    className="w-4 h-4 text-amber-600 bg-gray-700 border-gray-600 rounded focus:ring-amber-500"
                  />
                  <span>Solo montos fijos</span>
                </label>
                <p className="mt-1 text-xs text-gray-400 ml-6">
                  Si está habilitado, la caja solo aceptará pagos de montos predefinidos
                </p>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  ID Externo (opcional)
                </label>
                <input
                  type="text"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Ej: CAJA001"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Identificador para tu sistema interno
                </p>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  ID Externo de Sucursal (opcional)
                </label>
                <input
                  type="text"
                  value={externalStoreId}
                  onChange={(e) => setExternalStoreId(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Ej: SUC001"
                />
                <p className="mt-1 text-xs text-gray-400">
                  ID externo de la sucursal para referencia cruzada
                </p>
              </div>
            </div>
          </div>

          {/* Información adicional */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
            <p className="text-sm text-blue-200">
              ℹ️ <strong>Nota importante:</strong> Una vez creada la caja, podrás asociarle terminales físicas 
              desde el panel de Mercado Pago o mediante la API de dispositivos.
            </p>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-6 py-2.5 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || stores.length === 0}
              className="px-6 py-2.5 rounded-lg font-bold bg-amber-500 hover:bg-amber-600 text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '⏳ Guardando...' : isEditing ? '💾 Actualizar Caja' : '➕ Crear Caja'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default POSModal;
