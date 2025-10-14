import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  type Store,
  type CreateStorePayload,
  type UpdateStorePayload,
  type BusinessHours,
  type StoreLocation,
  createStore,
  updateStore,
  validateBusinessHours,
} from '../../services/mercadoPagoStoresService';

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  store?: Store | null; // Si existe, es edición; si no, es creación
}

const DEFAULT_HOURS = {
  open: '09:00',
  close: '18:00',
};

const StoreModal: React.FC<StoreModalProps> = ({ isOpen, onClose, onSuccess, store }) => {
  const isEditing = !!store;
  
  // Form states
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');
  const [addressLine, setAddressLine] = useState(''); // Una sola línea de dirección
  const [reference, setReference] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  
  // Business hours
  const [mondayOpen, setMondayOpen] = useState(DEFAULT_HOURS.open);
  const [mondayClose, setMondayClose] = useState(DEFAULT_HOURS.close);
  const [tuesdayOpen, setTuesdayOpen] = useState(DEFAULT_HOURS.open);
  const [tuesdayClose, setTuesdayClose] = useState(DEFAULT_HOURS.close);
  const [wednesdayOpen, setWednesdayOpen] = useState(DEFAULT_HOURS.open);
  const [wednesdayClose, setWednesdayClose] = useState(DEFAULT_HOURS.close);
  const [thursdayOpen, setThursdayOpen] = useState(DEFAULT_HOURS.open);
  const [thursdayClose, setThursdayClose] = useState(DEFAULT_HOURS.close);
  const [fridayOpen, setFridayOpen] = useState(DEFAULT_HOURS.open);
  const [fridayClose, setFridayClose] = useState(DEFAULT_HOURS.close);
  const [saturdayOpen, setSaturdayOpen] = useState('10:00');
  const [saturdayClose, setSaturdayClose] = useState('14:00');
  const [sundayOpen, setSundayOpen] = useState('');
  const [sundayClose, setSundayClose] = useState('');
  
  const [enableSunday, setEnableSunday] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cargar datos si es edición
  useEffect(() => {
    if (store) {
      setName(store.name || '');
      setExternalId(store.external_id || '');
      setAddressLine(store.location?.address_line || '');
      setReference(store.location?.reference || '');
      setLatitude(store.location?.latitude?.toString() || '');
      setLongitude(store.location?.longitude?.toString() || '');
      
      // Cargar horarios
      if (store.business_hours) {
        const hours = store.business_hours;
        if (hours.monday?.[0]) {
          setMondayOpen(hours.monday[0].open);
          setMondayClose(hours.monday[0].close);
        }
        if (hours.tuesday?.[0]) {
          setTuesdayOpen(hours.tuesday[0].open);
          setTuesdayClose(hours.tuesday[0].close);
        }
        if (hours.wednesday?.[0]) {
          setWednesdayOpen(hours.wednesday[0].open);
          setWednesdayClose(hours.wednesday[0].close);
        }
        if (hours.thursday?.[0]) {
          setThursdayOpen(hours.thursday[0].open);
          setThursdayClose(hours.thursday[0].close);
        }
        if (hours.friday?.[0]) {
          setFridayOpen(hours.friday[0].open);
          setFridayClose(hours.friday[0].close);
        }
        if (hours.saturday?.[0]) {
          setSaturdayOpen(hours.saturday[0].open);
          setSaturdayClose(hours.saturday[0].close);
        }
        if (hours.sunday?.[0]) {
          setEnableSunday(true);
          setSundayOpen(hours.sunday[0].open);
          setSundayClose(hours.sunday[0].close);
        }
      }
    } else {
      // Resetear formulario
      setName('');
      setExternalId('');
      setAddressLine('');
      setReference('');
      setLatitude('');
      setLongitude('');
      setMondayOpen(DEFAULT_HOURS.open);
      setMondayClose(DEFAULT_HOURS.close);
      setTuesdayOpen(DEFAULT_HOURS.open);
      setTuesdayClose(DEFAULT_HOURS.close);
      setWednesdayOpen(DEFAULT_HOURS.open);
      setWednesdayClose(DEFAULT_HOURS.close);
      setThursdayOpen(DEFAULT_HOURS.open);
      setThursdayClose(DEFAULT_HOURS.close);
      setFridayOpen(DEFAULT_HOURS.open);
      setFridayClose(DEFAULT_HOURS.close);
      setSaturdayOpen('10:00');
      setSaturdayClose('14:00');
      setSundayOpen('');
      setSundayClose('');
      setEnableSunday(false);
    }
  }, [store]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones
    if (!name.trim()) {
      toast.error('El nombre de la sucursal es obligatorio');
      return;
    }
    
    if (!addressLine.trim()) {
      toast.error('La dirección es obligatoria');
      return;
    }
    
    // Construir location
    const location: StoreLocation = {
      address_line: addressLine,
    };
    
    if (reference.trim()) location.reference = reference;
    if (latitude.trim()) location.latitude = parseFloat(latitude);
    if (longitude.trim()) location.longitude = parseFloat(longitude);
    
    // Construir business hours
    const business_hours: BusinessHours = {
      monday: mondayOpen && mondayClose ? [{ open: mondayOpen, close: mondayClose }] : [],
      tuesday: tuesdayOpen && tuesdayClose ? [{ open: tuesdayOpen, close: tuesdayClose }] : [],
      wednesday: wednesdayOpen && wednesdayClose ? [{ open: wednesdayOpen, close: wednesdayClose }] : [],
      thursday: thursdayOpen && thursdayClose ? [{ open: thursdayOpen, close: thursdayClose }] : [],
      friday: fridayOpen && fridayClose ? [{ open: fridayOpen, close: fridayClose }] : [],
      saturday: saturdayOpen && saturdayClose ? [{ open: saturdayOpen, close: saturdayClose }] : [],
      sunday: enableSunday && sundayOpen && sundayClose ? [{ open: sundayOpen, close: sundayClose }] : [],
    };
    
    // Validar horarios
    const validation = validateBusinessHours(business_hours);
    if (!validation.valid) {
      toast.error(`Horarios inválidos: ${validation.errors[0]}`);
      return;
    }
    
    setSaving(true);
    
    try {
      if (isEditing && store) {
        // Actualizar
        const payload: UpdateStorePayload = {
          name,
          business_hours,
          location,
        };
        if (externalId.trim()) payload.external_id = externalId;
        
        const result = await updateStore(store.id, payload);
        if (!result.success) {
          // Extraer mensajes de validación del resultado
          const error: any = result.data || new Error(result.error || 'Error al actualizar sucursal');
          error.message = result.error || 'Error al actualizar sucursal';
          throw error;
        }
        
        toast.success('✅ Sucursal actualizada correctamente');
      } else {
        // Crear
        const payload: CreateStorePayload = {
          name,
          business_hours,
          location,
        };
        if (externalId.trim()) payload.external_id = externalId;
        
        const result = await createStore(payload);
        if (!result.success) {
          // Extraer mensajes de validación del resultado
          const error: any = result.data || new Error(result.error || 'Error al crear sucursal');
          error.message = result.error || 'Error al crear sucursal';
          throw error;
        }
        
        toast.success('✅ Sucursal creada correctamente');
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error al guardar sucursal:', error);
      
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
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <h3 className="text-2xl font-bold text-white">
            {isEditing ? '✏️ Editar Sucursal' : '➕ Crear Nueva Sucursal'}
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
          {/* Información Básica */}
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            <h4 className="text-lg font-semibold text-amber-400 mb-4">📋 Información Básica</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  Nombre de la Sucursal *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Ej: Sucursal Centro"
                  required
                />
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
                  placeholder="Ej: SUC001"
                />
              </div>
            </div>
          </div>

          {/* Ubicación */}
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            <h4 className="text-lg font-semibold text-amber-400 mb-4">📍 Ubicación</h4>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">
                  Dirección Completa *
                </label>
                <input
                  type="text"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5"
                  placeholder="Ej: Calle Principal, 123, Ciudad de México, CDMX"
                  required
                />
                <p className="mt-1 text-xs text-gray-400">
                  Formato: Calle, Número, Ciudad, Estado
                </p>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">Referencia</label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5"
                  placeholder="Ej: Cerca de Mercado Pago, Entre calles A y B"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">Latitud</label>
                  <input
                    type="number"
                    step="any"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5"
                    placeholder="Ej: 19.4326"
                  />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">Longitud</label>
                  <input
                    type="number"
                    step="any"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5"
                    placeholder="Ej: -99.1332"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Horarios */}
          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            <h4 className="text-lg font-semibold text-amber-400 mb-4">🕐 Horarios de Operación</h4>
            <div className="space-y-3">
              {[
                { day: 'Lunes', open: mondayOpen, close: mondayClose, setOpen: setMondayOpen, setClose: setMondayClose },
                { day: 'Martes', open: tuesdayOpen, close: tuesdayClose, setOpen: setTuesdayOpen, setClose: setTuesdayClose },
                { day: 'Miércoles', open: wednesdayOpen, close: wednesdayClose, setOpen: setWednesdayOpen, setClose: setWednesdayClose },
                { day: 'Jueves', open: thursdayOpen, close: thursdayClose, setOpen: setThursdayOpen, setClose: setThursdayClose },
                { day: 'Viernes', open: fridayOpen, close: fridayClose, setOpen: setFridayOpen, setClose: setFridayClose },
                { day: 'Sábado', open: saturdayOpen, close: saturdayClose, setOpen: setSaturdayOpen, setClose: setSaturdayClose },
              ].map(({ day, open, close, setOpen, setClose }) => (
                <div key={day} className="grid grid-cols-3 gap-4 items-center">
                  <label className="text-sm text-gray-300 font-medium">{day}</label>
                  <input
                    type="time"
                    value={open}
                    onChange={(e) => setOpen(e.target.value)}
                    className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2"
                  />
                  <input
                    type="time"
                    value={close}
                    onChange={(e) => setClose(e.target.value)}
                    className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2"
                  />
                </div>
              ))}
              
              {/* Domingo con checkbox */}
              <div className="grid grid-cols-3 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={enableSunday}
                    onChange={(e) => setEnableSunday(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label className="text-sm text-gray-300 font-medium">Domingo</label>
                </div>
                <input
                  type="time"
                  value={sundayOpen}
                  onChange={(e) => setSundayOpen(e.target.value)}
                  disabled={!enableSunday}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2 disabled:opacity-50"
                />
                <input
                  type="time"
                  value={sundayClose}
                  onChange={(e) => setSundayClose(e.target.value)}
                  disabled={!enableSunday}
                  className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg p-2 disabled:opacity-50"
                />
              </div>
            </div>
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
              disabled={saving}
              className="px-6 py-2.5 rounded-lg font-bold bg-amber-500 hover:bg-amber-600 text-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? '⏳ Guardando...' : isEditing ? '💾 Actualizar Sucursal' : '➕ Crear Sucursal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoreModal;
