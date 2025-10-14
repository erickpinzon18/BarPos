



import React, { useState, useEffect } from 'react';
import { getConfig, saveConfig, requestDisableUser, getUsers, addUserClient, getTerminalsConfig, setTerminalEnabled, getTerminalsNames, setTerminalName, getTestPayments } from '../../services/firestoreService';
import { auth } from '../../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import toast from 'react-hot-toast';
import MercadoPagoTerminalModal from '../../components/common/MercadoPagoTerminalModal';
import EditTerminalNameModal from '../../components/common/EditTerminalNameModal';
import StoreModal from '../../components/common/StoreModal';
import POSModal from '../../components/common/POSModal';
import { getFormattedTerminals, CONFIG, type Terminal, setTerminalOperatingMode } from '../../services/mercadoPagoOrdersService';
import { getStoresWithPOS, deleteStore, deletePOS, canDeleteStore, type Store, type POS, type Device, getMCCCategoryName, getDevicesByPOS } from '../../services/mercadoPagoStoresService';
import { useAuth } from '../../contexts/AuthContext';
import type { PaymentDocument } from '../../services/firestoreService';

const Settings: React.FC = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'roles' | 'terminal' | 'stores'>('info');
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState<boolean>(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'waiter' | 'kitchen'>('waiter');
  const [newPin, setNewPin] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [creatingUser, setCreatingUser] = useState(false);
  
  // Terminal configuration states
  const [showTerminalModal, setShowTerminalModal] = useState(false);
  const [testPaymentStatus, setTestPaymentStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testPaymentMessage, setTestPaymentMessage] = useState('');
  const [testPaymentReferenceId, setTestPaymentReferenceId] = useState('');
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [terminalsLoading, setTerminalsLoading] = useState(false);
  const [terminalsConfig, setTerminalsConfig] = useState<Record<string, boolean>>({});
  const [terminalsNames, setTerminalsNames] = useState<Record<string, string>>({});
  
  // Edit terminal name modal states
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<Terminal | null>(null);

  // Test payments history
  const [testPayments, setTestPayments] = useState<(PaymentDocument & { id: string })[]>([]);
  const [loadingTestPayments, setLoadingTestPayments] = useState(false);

  // Stores and POS states
  const [stores, setStores] = useState<any[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showPOSModal, setShowPOSModal] = useState(false);
  const [editingStore, setEditingStore] = useState<any | null>(null);
  const [editingPOS, setEditingPOS] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await getConfig('general');
        if (!mounted) return;
        if (res.success && res.data) {
          const data = res.data;
          setName(data.name ?? '');
          setPhone(data.phone ?? '');
          setAddress(data.address ?? '');
          setLogoUrl(data.logoUrl ?? '');
        }
      } catch (err) {
        console.error('Error loading config:', err);
        toast.error('Error cargando configuración');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadUsers = async () => {
      setUsersLoading(true);
      try {
        const res = await getUsers();
        if (!mounted) return;
        if (res.success && res.data) {
          setUsers(res.data);
        }
      } catch (err) {
        console.error('Error loading users:', err);
        toast.error('Error cargando usuarios');
      } finally {
        if (mounted) setUsersLoading(false);
      }
    };
    void loadUsers();
    return () => { mounted = false; };
  }, []);

  // Cargar terminales desde la API de Mercado Pago
  useEffect(() => {
    let mounted = true;
    const loadTerminals = async () => {
      setTerminalsLoading(true);
      try {
        // Primero cargar la configuración de terminales habilitadas
        const configRes = await getTerminalsConfig();
        const config = configRes.success ? configRes.data : {};
        
        // Cargar los nombres personalizados
        const namesRes = await getTerminalsNames();
        const names = namesRes.success ? namesRes.data : {};
        
        if (!mounted) return;
        setTerminalsConfig(config || {});
        setTerminalsNames(names || {});
        
        // Luego cargar las terminales con su estado y nombres
        const fetchedTerminals = await getFormattedTerminals(config || {}, names || {});
        if (!mounted) return;
        setTerminals(fetchedTerminals);
      } catch (err) {
        console.error('Error loading terminals:', err);
        toast.error('Error cargando terminales');
      } finally {
        if (mounted) setTerminalsLoading(false);
      }
    };
    void loadTerminals();
    return () => { mounted = false; };
  }, []);

  // Función para habilitar/deshabilitar una terminal
  const handleToggleTerminal = async (terminalId: string, enabled: boolean) => {
    try {
      // 1. Cambiar el modo de operación en Mercado Pago
      const mode = enabled ? 'PDV' : 'STANDALONE';
      console.log(`🔄 Cambiando terminal ${terminalId} a modo ${mode}...`);
      
      const modeResult = await setTerminalOperatingMode(terminalId, mode);
      if (!modeResult.success) {
        throw new Error(modeResult.error || 'Error al cambiar modo de operación');
      }
      
      console.log(`✅ Terminal ${terminalId} ahora está en modo ${mode}`);
      
      // 2. Actualizar el estado en Firestore
      const res = await setTerminalEnabled(terminalId, enabled);
      if (!res.success) {
        throw new Error(res.error || 'Error al actualizar terminal en Firestore');
      }
      
      // 3. Actualizar estado local
      setTerminalsConfig(prev => ({ ...prev, [terminalId]: enabled }));
      setTerminals(prev => prev.map(t => 
        t.id === terminalId ? { ...t, enabled, operatingMode: mode } : t
      ));
      
      toast.success(
        enabled 
          ? `Terminal habilitada en modo PDV (recibe órdenes desde API)` 
          : `Terminal deshabilitada en modo STANDALONE (solo pagos manuales)`
      );
    } catch (err: any) {
      console.error('Error toggling terminal:', err);
      toast.error(err?.message || 'Error al actualizar terminal');
    }
  };

  // Función para cambiar el nombre de una terminal
  const handleSaveTerminalName = async (terminalId: string, name: string) => {
    try {
      const res = await setTerminalName(terminalId, name);
      if (!res.success) {
        throw new Error(res.error || 'Error al actualizar nombre');
      }
      
      // Actualizar estado local
      setTerminalsNames(prev => ({ ...prev, [terminalId]: name }));
      setTerminals(prev => prev.map(t => 
        t.id === terminalId ? { ...t, customName: name } : t
      ));
      
      toast.success('Nombre actualizado correctamente');
    } catch (err: any) {
      console.error('Error updating terminal name:', err);
      toast.error(err?.message || 'Error al actualizar nombre');
    }
  };

  // Función para abrir el modal de edición
  const handleEditTerminalName = (terminal: Terminal) => {
    setEditingTerminal(terminal);
    setShowEditNameModal(true);
  };

  // Cargar historial de pagos de prueba cuando se abre la pestaña terminal
  useEffect(() => {
    let mounted = true;
    const loadTestPayments = async () => {
      if (activeTab !== 'terminal') return;
      
      setLoadingTestPayments(true);
      try {
        const result = await getTestPayments();
        if (!mounted) return;
        
        if (result.success && result.data) {
          setTestPayments(result.data as (PaymentDocument & { id: string })[]);
        }
      } catch (err) {
        console.error('Error loading test payments:', err);
      } finally {
        if (mounted) setLoadingTestPayments(false);
      }
    };
    
    void loadTestPayments();
    return () => { mounted = false; };
  }, [activeTab]);

  // Cargar sucursales y cajas cuando se abre la pestaña stores
  useEffect(() => {
    if (activeTab === 'stores') {
      refreshStores();
    }
  }, [activeTab]);

  // Función para refrescar sucursales
  const refreshStores = async () => {
    setStoresLoading(true);
    try {
      console.log('🔄 Cargando sucursales y dispositivos...');
      const result = await getStoresWithPOS();
      
      if (result.success && result.data) {
        console.log(`✅ ${result.data.length} sucursales encontradas`);
        
        // Para cada store, cargar devices de cada POS
        const storesWithDevices = await Promise.all(
          result.data.map(async (store) => {
            console.log(`📦 Procesando store: ${store.name} (${store.pos.length} cajas)`);
            
            const posWithDevices = await Promise.all(
              store.pos.map(async (pos: POS) => {
                console.log(`  🔍 Buscando devices para POS: ${pos.name} (${pos.id})`);
                const devicesResult = await getDevicesByPOS(pos.id);
                
                const devices = devicesResult.success && devicesResult.data 
                  ? devicesResult.data.data.terminals 
                  : [];
                
                console.log(`    ${devices.length > 0 ? '✅' : '⚠️'} ${devices.length} devices encontrados para ${pos.name}`);
                if (devices.length > 0) {
                  console.log(`    Devices:`, devices);
                }
                
                return {
                  ...pos,
                  devices,
                };
              })
            );
            
            return {
              ...store,
              pos: posWithDevices,
            };
          })
        );
        
        console.log('✅ Todas las sucursales con devices cargadas:', storesWithDevices);
        setStores(storesWithDevices);
        
        const totalDevices = storesWithDevices.reduce((sum, store) => 
          sum + store.pos.reduce((posSum: number, pos: any) => 
            posSum + (pos.devices?.length || 0), 0
          ), 0
        );
        
        toast.success(`${storesWithDevices.length} sucursales y ${totalDevices} terminales encontradas`);
      } else {
        console.error('❌ Error al cargar sucursales:', result.error);
        toast.error(result.error || 'Error al cargar sucursales');
      }
    } catch (err) {
      console.error('❌ Exception al cargar sucursales:', err);
      toast.error('Error al cargar sucursales');
    } finally {
      setStoresLoading(false);
    }
  };

  // Función para eliminar sucursal
  const handleDeleteStore = async (storeId: string, storeName: string) => {
    // Verificar si se puede eliminar
    const canDelete = await canDeleteStore(storeId);
    if (!canDelete.canDelete) {
      toast.error(canDelete.reason || 'No se puede eliminar esta sucursal');
      return;
    }

    if (!confirm(`¿Estás seguro de eliminar la sucursal "${storeName}"?`)) {
      return;
    }

    try {
      const result = await deleteStore(storeId);
      if (!result.success) {
        throw new Error(result.error || 'Error al eliminar sucursal');
      }

      toast.success('✅ Sucursal eliminada correctamente');
      await refreshStores();
    } catch (error: any) {
      console.error('Error al eliminar sucursal:', error);
      toast.error(error?.message || 'Error al eliminar sucursal');
    }
  };

  // Función para eliminar caja
  const handleDeletePOS = async (posId: string, posName: string) => {
    if (!confirm(`¿Estás seguro de eliminar la caja "${posName}"?`)) {
      return;
    }

    try {
      const result = await deletePOS(posId);
      if (!result.success) {
        throw new Error(result.error || 'Error al eliminar caja');
      }

      toast.success('✅ Caja eliminada correctamente');
      await refreshStores();
    } catch (error: any) {
      console.error('Error al eliminar caja:', error);
      toast.error(error?.message || 'Error al eliminar caja');
    }
  };

  return (
    <div className="p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Configuración General</h1>
        <p className="text-gray-400">Administra los detalles de tu negocio, usuarios y permisos.</p>
      </header>

      <div className="border-b border-gray-700 mb-8">
        <nav className="flex -mb-px">
          <button onClick={() => setActiveTab('info')} className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-lg ${activeTab === 'info' ? 'border-b-2 border-amber-400 text-amber-400' : 'border-b-2 border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
            Información del Negocio
          </button>
          <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-lg ${activeTab === 'users' ? 'border-b-2 border-amber-400 text-amber-400' : 'border-b-2 border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
            Gestión de Usuarios
          </button>
          <button onClick={() => setActiveTab('stores')} className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-lg ${activeTab === 'stores' ? 'border-b-2 border-amber-400 text-amber-400' : 'border-b-2 border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
            Sucursales y Cajas
          </button>
          <button onClick={() => setActiveTab('terminal')} className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-lg ${activeTab === 'terminal' ? 'border-b-2 border-amber-400 text-amber-400' : 'border-b-2 border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
            Configurar Terminal
          </button>
          {/* <button onClick={() => setActiveTab('roles')} className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold rounded-t-lg ${activeTab === 'roles' ? 'border-b-2 border-amber-400 text-amber-400' : 'border-b-2 border-transparent text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
            Roles y Permisos
          </button> */}
        </nav>
      </div>

      <div>
        {activeTab === 'info' && (
          <div className="tab-content bg-gray-800 rounded-2xl border border-gray-700 p-8 max-w-4xl">
            <h2 className="text-2xl font-bold text-white mb-6">Detalles del Bar</h2>
            <form className="space-y-6" onSubmit={async (e) => {
              e.preventDefault();
              try {
                const payload = { name, phone, address, logoUrl };
                const res = await saveConfig(payload);
                if (!res.success) throw new Error(res.error || 'Error al guardar');
                toast.success('Configuración guardada');
              } catch (err: any) {
                console.error('Error saving config:', err);
                toast.error(err?.message || 'Error al guardar configuración');
              }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">Nombre del Negocio</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5 focus:ring-amber-500 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-300">Teléfono</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5 focus:ring-amber-500 focus:border-amber-500" />
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">Dirección</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5 focus:ring-amber-500 focus:border-amber-500" />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-300">URL del Logo</label>
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5 focus:ring-amber-500 focus:border-amber-500" />
              </div>
              <div className="pt-4 flex justify-end">
                <button type="submit" disabled={loading} className={`text-gray-900 bg-amber-500 hover:bg-amber-600 font-bold rounded-lg text-sm px-6 py-2.5 transition transform hover:-translate-y-px disabled:opacity-60`}>{loading ? 'Guardando...' : 'Guardar Cambios'}</button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="tab-content bg-gray-800 rounded-2xl border border-gray-700 p-6">
            <div className="p-6 flex justify-between items-center border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white">Usuarios del Sistema</h2>
              {/* <button onClick={() => setShowAddUserModal(true)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition transform hover:-translate-y-px">Agregar Usuario</button> */}
            </div>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm text-left text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3">Usuario</th>
                    <th className="px-6 py-3">Rol</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading && (
                    <tr><td colSpan={4} className="px-6 py-4">Cargando usuarios...</td></tr>
                  )}
                  {!usersLoading && users.length === 0 && (
                    <tr className="border-b border-gray-700 hover:bg-gray-700/30"><td colSpan={4} className="px-6 py-4">No hay usuarios registrados.</td></tr>
                  )}
                  {!usersLoading && users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                      <td className="px-6 py-4 font-medium text-white">{u.displayName || u.name || 'Sin nombre'} <p className="font-normal text-gray-400">{u.email}</p></td>
                      <td className="px-6 py-4">{u.role || '-'}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${u.active === false ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{u.active === false ? 'Inactivo' : 'Activo'}</span></td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={async () => {
                            try {
                                console.log('u', u.email);
                              await sendPasswordResetEmail(auth, u.email);
                              toast.success(`Enlace enviado a ${u.email}`);
                            } catch (err: any) {
                              console.error('Error sending reset email', err);
                              toast.error(err?.message || 'Error al enviar enlace');
                            }
                          }} className="text-sm px-3 py-1 rounded bg-sky-600 hover:bg-sky-700">Restablecer</button>
                          <button onClick={async () => {
                            try {
                              const res = await requestDisableUser(u.email, u.active !== false);
                              if (!res.success) throw new Error(res.error || 'No disponible');
                              toast.success(u.active === false ? 'Usuario activado' : 'Usuario desactivado');
                              // refresh users list
                              const refreshed = await getUsers();
                              if (refreshed.success) setUsers(refreshed.data ?? []);
                            } catch (err: any) {
                              toast.error(err?.message || 'No se pudo actualizar el usuario');
                            }
                          }} className="text-sm px-3 py-1 rounded bg-red-600 hover:bg-red-700">{u.active === false ? 'Activar' : 'Desactivar'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add User Modal (client-side only: creates Firestore profile, not Auth account) */}
        {showAddUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 w-full max-w-lg">
              <h3 className="text-lg font-bold text-white mb-4">Agregar Usuario</h3>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setCreatingUser(true);
                try {
                  // create Firestore profile document
                  const payload = { displayName: newName, email: newEmail, role: newRole, pin: newPin, active: newActive };
                  const res = await addUserClient(payload as any);
                  if (!res.success) throw new Error(res.error || 'Error creando usuario');
                  toast.success('Usuario creado (perfil guardado). Recuerde crear la cuenta en Auth mediante backend)');
                  // refresh users
                  const refreshed = await getUsers();
                  if (refreshed.success) setUsers(refreshed.data ?? []);
                  setShowAddUserModal(false);
                  setNewName(''); setNewEmail(''); setNewPin(''); setNewActive(true); setNewRole('waiter');
                } catch (err: any) {
                  console.error('Error creating user client-side', err);
                  toast.error(err?.message || 'Error al crear usuario');
                } finally {
                  setCreatingUser(false);
                }
              }}>
                <div className="grid grid-cols-1 gap-3">
                  <label className="text-sm text-gray-300">Nombre</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5" />
                  <label className="text-sm text-gray-300">Email</label>
                  <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5" />
                  <label className="text-sm text-gray-300">Rol</label>
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5">
                    <option value="admin">Administrador</option>
                    <option value="waiter">Mesero</option>
                    <option value="kitchen">Cocina</option>
                  </select>
                  <label className="text-sm text-gray-300">PIN (opcional)</label>
                  <input value={newPin} onChange={(e) => setNewPin(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg w-full p-2.5" />
                  <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={newActive} onChange={(e) => setNewActive(e.target.checked)} /> Activo</label>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowAddUserModal(false)} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600">Cancelar</button>
                  <button type="submit" disabled={creatingUser} className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-600 text-gray-900">{creatingUser ? 'Creando...' : 'Crear Usuario'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="tab-content space-y-6">
            {/* Configuración y Estado */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8">
              <h2 className="text-2xl font-bold text-white mb-6">Configuración de Terminal Mercado Pago</h2>
              
              {/* Estado de Configuración */}
              <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-amber-400 mb-4">📊 Estado de Configuración</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Access Token</p>
                    <p className="text-white font-mono text-sm">
                      {CONFIG.accessToken.includes('TEST_') || CONFIG.accessToken.includes('APP_') 
                        ? `${CONFIG.accessToken.substring(0, 15)}...` 
                        : '❌ No configurado'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">User ID</p>
                    <p className="text-white font-mono text-sm">
                      {CONFIG.userId !== 'YOUR-USER-ID' ? CONFIG.userId : '❌ No configurado'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Ambiente</p>
                    <p className={`font-semibold ${CONFIG.environment === 'production' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {CONFIG.environment === 'production' ? '🟢 Producción' : '🟡 Sandbox (Pruebas)'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Terminales Configuradas</p>
                    <p className="text-white font-semibold">
                      {terminals.length} total · {terminals.filter(t => t.enabled !== false).length} habilitadas
                    </p>
                  </div>
                </div>
              </div>

              {/* Lista de Terminales */}
              <div className="bg-gray-900 rounded-lg p-6 mb-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-amber-400">🖥️ Terminales Disponibles</h3>
                  <button
                    onClick={async () => {
                      setTerminalsLoading(true);
                      try {
                        const configRes = await getTerminalsConfig();
                        const config = configRes.success ? configRes.data : {};
                        
                        const namesRes = await getTerminalsNames();
                        const names = namesRes.success ? namesRes.data : {};
                        
                        setTerminalsConfig(config || {});
                        setTerminalsNames(names || {});
                        
                        const fetchedTerminals = await getFormattedTerminals(config || {}, names || {});
                        setTerminals(fetchedTerminals);
                        toast.success(`${fetchedTerminals.length} terminales encontradas`);
                      } catch (err) {
                        toast.error('Error al cargar terminales');
                      } finally {
                        setTerminalsLoading(false);
                      }
                    }}
                    disabled={terminalsLoading}
                    className="text-sm px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 flex items-center gap-2"
                  >
                    {terminalsLoading ? '🔄 Cargando...' : '🔄 Actualizar Terminales'}
                  </button>
                </div>

                {/* Terminales de la API */}
                {terminalsLoading && (
                  <div className="text-center py-8">
                    <p className="text-gray-400">Cargando terminales...</p>
                  </div>
                )}

                {!terminalsLoading && terminals.length === 0 && (
                  <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                    <p className="text-yellow-300 text-sm">
                      ⚠️ No se encontraron terminales. Verifica tu configuración de Mercado Pago.
                    </p>
                  </div>
                )}

                {!terminalsLoading && terminals.length > 0 && (
                  <div className="space-y-3">
                    {terminals.map((terminal) => {
                      // El estado real es el modo de operación de la API
                      const isInPDVMode = terminal.operatingMode === 'PDV';
                      
                      return (
                      <div key={terminal.id} className={`bg-gray-800 rounded-lg p-4 border-2 transition-all ${isInPDVMode ? 'border-green-700/50' : 'border-gray-700 opacity-60'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {/* Nombre personalizado o nombre por defecto */}
                              <p className="text-white font-semibold text-lg">
                                {terminal.customName || terminal.name}
                              </p>
                              <button
                                onClick={() => handleEditTerminalName(terminal)}
                                className="text-amber-400 hover:text-amber-300 transition-colors p-1 hover:bg-gray-700 rounded"
                                title="Editar nombre"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isInPDVMode ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {isInPDVMode ? '✓ Habilitada' : '✗ Deshabilitada'}
                              </span>
                              {/* Indicador de Modo de Operación REAL desde la API */}
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isInPDVMode ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {isInPDVMode ? '📡 PDV' : '🔒 STANDALONE'}
                              </span>
                            </div>
                            {/* Mostrar nombre original si hay uno personalizado */}
                            {terminal.customName && (
                              <p className="text-xs text-gray-500 mb-2">
                                Nombre original: {terminal.name}
                              </p>
                            )}
                            <p className="text-sm text-gray-400 mb-2">
                              📍 {terminal.location}
                            </p>
                            {/* Descripción del modo REAL */}
                            <p className="text-xs text-gray-500 mb-2 italic">
                              {isInPDVMode 
                                ? '📡 Modo PDV: Recibe órdenes desde la API (integración)'
                                : '🔒 Modo STANDALONE: Solo acepta pagos manuales en la terminal'
                              }
                            </p>
                            <div className="mt-2 space-y-1">
                              <p className="text-xs text-gray-500">
                                <span className="text-gray-400">Device ID:</span> <span className="text-green-400 font-mono">{terminal.id}</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                <span className="text-gray-400">Store ID:</span> <span className="text-green-400 font-mono">{terminal.storeId}</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                <span className="text-gray-400">POS ID:</span> <span className="text-green-400 font-mono">{terminal.posId}</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                <span className="text-gray-400">Modo actual:</span> <span className={`font-mono font-semibold ${isInPDVMode ? 'text-blue-400' : 'text-yellow-400'}`}>{terminal.operatingMode || 'Desconocido'}</span>
                              </p>
                            </div>
                          </div>
                          
                          {/* Toggle Switch - sincronizado con el modo REAL */}
                          <div className="ml-4 flex flex-col items-center gap-2">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isInPDVMode}
                                onChange={(e) => handleToggleTerminal(terminal.id, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                            <span className="text-xs text-gray-400">
                              {isInPDVMode ? 'PDV' : 'STANDALONE'}
                            </span>
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Prueba de Pago */}
              <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg p-6 border border-blue-700">
                <h3 className="text-lg font-semibold text-blue-300 mb-4">🧪 Prueba de Pago Productivo</h3>
                <p className="text-sm text-gray-300 mb-4">
                  Realiza un cobro de prueba de <strong className="text-white">$5.00 MXN</strong> para verificar que la terminal 
                  y la configuración de Mercado Pago funcionan correctamente.
                </p>
                <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-200">
                    ℹ️ <strong>Monto mínimo:</strong> Mercado Pago Point requiere un monto mínimo de $5.00 MXN por transacción.
                  </p>
                </div>
                
                {testPaymentStatus === 'success' && (
                  <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 mb-4">
                    <p className="text-green-300 font-semibold">✅ {testPaymentMessage}</p>
                    <p className="text-sm text-gray-400 mt-1">La terminal está configurada correctamente.</p>
                    
                    {testPaymentReferenceId && (
                      <div className="mt-4 p-4 bg-blue-900/30 border border-blue-600 rounded-lg">
                        <p className="text-xs text-gray-400 mb-2">
                          🏆 <strong>ID de Referencia para Certificación Mercado Pago:</strong>
                        </p>
                        <div className="bg-gray-900/50 rounded p-3 mb-2">
                          <p className="font-mono text-xl text-blue-300 font-bold text-center tracking-wider">
                            {testPaymentReferenceId}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          📋 Ingresa este ID en tu cuenta de <strong>Mercado Pago Developers</strong> para 
                          completar la certificación de tu integración API.
                        </p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(testPaymentReferenceId);
                            toast.success('ID copiado al portapapeles');
                          }}
                          className="mt-2 w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                        >
                          📋 Copiar ID al Portapapeles
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {testPaymentStatus === 'error' && (
                  <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 mb-4">
                    <p className="text-red-300 font-semibold">❌ {testPaymentMessage}</p>
                    <p className="text-sm text-gray-400 mt-1">Vuelve a intentar el pago</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setTestPaymentStatus('testing');
                      setShowTerminalModal(true);
                    }}
                    disabled={testPaymentStatus === 'testing'}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-sm transition transform hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span>💳</span>
                    {testPaymentStatus === 'testing' ? 'Procesando...' : 'Hacer Cobro de Prueba ($5.00)'}
                  </button>
                  
                  {testPaymentStatus === 'success' && (
                    <button
                      onClick={() => {
                        setTestPaymentStatus('idle');
                        setTestPaymentMessage('');
                      }}
                      className="py-3 px-6 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
                    >
                      Resetear
                    </button>
                  )}
                </div>
              </div>

              {/* Historial de Pagos de Prueba */}
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-amber-400">📜 Historial de Pagos de Prueba</h3>
                  <button
                    onClick={async () => {
                      setLoadingTestPayments(true);
                      try {
                        const result = await getTestPayments();
                        if (result.success && result.data) {
                          setTestPayments(result.data as (PaymentDocument & { id: string })[]);
                          toast.success(`${result.data.length} pagos encontrados`);
                        }
                      } catch (err) {
                        toast.error('Error al cargar pagos');
                      } finally {
                        setLoadingTestPayments(false);
                      }
                    }}
                    disabled={loadingTestPayments}
                    className="text-sm px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-60"
                  >
                    {loadingTestPayments ? '🔄 Cargando...' : '🔄 Actualizar'}
                  </button>
                </div>

                {loadingTestPayments && (
                  <div className="text-center py-8">
                    <p className="text-gray-400">Cargando historial...</p>
                  </div>
                )}

                {!loadingTestPayments && testPayments.length === 0 && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
                    <p className="text-gray-400 text-sm">
                      No hay pagos de prueba registrados. Realiza un cobro de prueba para ver el historial aquí.
                    </p>
                  </div>
                )}

                {!loadingTestPayments && testPayments.length > 0 && (
                  <div className="space-y-3">
                    {testPayments.map((payment) => {
                      const isSuccess = payment.status === 'processed' || payment.status === 'paid';
                      const isFailed = payment.status === 'failed' || payment.status === 'canceled';
                      const createdDate = payment.created_date ? new Date(payment.created_date) : null;
                      
                      return (
                        <div
                          key={payment.id}
                          className={`bg-gray-800 rounded-lg p-4 border-2 transition-all ${
                            isSuccess
                              ? 'border-green-700/50'
                              : isFailed
                              ? 'border-red-700/50'
                              : 'border-yellow-700/50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">
                                  {isSuccess ? '✅' : isFailed ? '❌' : '⏳'}
                                </span>
                                <div>
                                  <p className="text-white font-semibold">
                                    Prueba de Pago - ${payment.transactions?.payments?.[0]?.amount || '5.00'}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {createdDate ? createdDate.toLocaleString('es-MX', {
                                      dateStyle: 'medium',
                                      timeStyle: 'short'
                                    }) : 'Fecha no disponible'}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-1 text-sm">
                                <p className="text-gray-400">
                                  <span className="text-gray-500">Estado:</span>{' '}
                                  <span className={`font-semibold ${
                                    isSuccess ? 'text-green-400' : isFailed ? 'text-red-400' : 'text-yellow-400'
                                  }`}>
                                    {payment.status === 'processed' ? 'Procesado ✓' :
                                     payment.status === 'paid' ? 'Pagado ✓' :
                                     payment.status === 'failed' ? 'Fallido' :
                                     payment.status === 'canceled' ? 'Cancelado' :
                                     payment.status}
                                  </span>
                                </p>
                                
                                <p className="text-gray-400">
                                  <span className="text-gray-500">Usuario:</span>{' '}
                                  <span className="text-white">{payment.userData?.displayName || 'N/A'}</span>
                                </p>

                                {payment.transactions?.payments?.[0]?.reference_id && (
                                  <p className="text-gray-400">
                                    <span className="text-gray-500">Reference ID:</span>{' '}
                                    <span className="text-green-400 font-mono text-xs">
                                      {payment.transactions.payments[0].reference_id}
                                    </span>
                                  </p>
                                )}

                                <p className="text-gray-400">
                                  <span className="text-gray-500">Order ID:</span>{' '}
                                  <span className="text-blue-400 font-mono text-xs">{payment.id}</span>
                                </p>

                                {payment.external_reference && (
                                  <p className="text-gray-400">
                                    <span className="text-gray-500">Referencia:</span>{' '}
                                    <span className="text-purple-400 text-xs">{payment.external_reference}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Botón para repetir prueba */}
                            <div className="ml-4">
                              <button
                                onClick={() => {
                                  setTestPaymentStatus('testing');
                                  setShowTerminalModal(true);
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors font-medium"
                                title="Repetir prueba de pago"
                              >
                                🔄 Repetir
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Instrucciones */}
              <div className="mt-6 bg-amber-900/20 border border-amber-700 rounded-lg p-4">
                <h4 className="text-amber-300 font-semibold mb-2">📝 Configuración Rápida de Mercado Pago Point</h4>
                <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
                  <li>
                    <strong>Obtén credenciales:</strong> Accede al <a href="https://www.mercadopago.com.mx/developers/panel/app" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Panel de Desarrolladores</a> y copia tu <code className="bg-gray-800 px-1 rounded">Access Token</code> y <code className="bg-gray-800 px-1 rounded">User ID</code>
                  </li>
                  <li>
                    <strong>Configura variables de entorno:</strong> Crea el archivo <code className="bg-gray-800 px-1 rounded">.env</code> en la raíz del proyecto:
                    <pre className="bg-gray-900 p-2 rounded mt-1 text-xs overflow-x-auto">
{`VITE_MERCADOPAGO_ACCESS_TOKEN=APP_USR-tu-access-token
VITE_MERCADOPAGO_USER_ID=tu-user-id`}
                    </pre>
                  </li>
                  <li>
                    <strong>Gestiona terminales:</strong> Las terminales aparecerán automáticamente al cargar esta página. Usa el botón <span className="text-blue-400">🔄 Actualizar</span> para refrescar la lista
                  </li>
                  <li>
                    <strong>Configura modos de operación:</strong>
                    <ul className="ml-6 mt-1 space-y-1 list-disc text-xs">
                      <li><span className="text-green-400 font-semibold">PDV (Habilitada)</span>: Terminal recibe órdenes desde la API - Integración automática con el sistema</li>
                      <li><span className="text-yellow-400 font-semibold">STANDALONE (Deshabilitada)</span>: Terminal solo acepta pagos manuales - Sin integración</li>
                      <li>💡 El modo se actualiza automáticamente al activar/desactivar el toggle de cada terminal</li>
                    </ul>
                  </li>
                  <li>
                    <strong>Prueba la configuración:</strong> Realiza un cobro de prueba de $5.00 MXN para verificar que todo funciona correctamente
                  </li>
                </ol>
                <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700 rounded">
                  <p className="text-xs text-blue-200">
                    💡 <strong>Tip:</strong> Las terminales pueden cambiar de modo desde la terminal física. Usa el botón de actualizar para sincronizar el estado real.
                  </p>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  � Para más detalles técnicos, consulta <code className="bg-gray-800 px-1 rounded">MERCADO_PAGO_TERMINAL_USAGE.md</code> en la raíz del proyecto.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'stores' && (
          <div className="tab-content space-y-6">
            {/* Header con botones */}
            <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">🏪 Gestión de Sucursales y Cajas</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Administra tus sucursales y cajas para Mercado Pago Point
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={refreshStores}
                    disabled={storesLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm disabled:opacity-60 flex items-center gap-2"
                  >
                    {storesLoading ? '🔄 Cargando...' : '🔄 Actualizar'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingStore(null);
                      setShowStoreModal(true);
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm flex items-center gap-2"
                  >
                    ➕ Nueva Sucursal
                  </button>
                </div>
              </div>

              {/* Info importante */}
              <div className="bg-amber-900/20 border border-amber-700 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-200">
                  ⚠️ <strong>Requerimiento de certificación:</strong> Mercado Pago requiere que gestiones 
                  sucursales y cajas mediante API para completar la certificación de tu integración.
                </p>
              </div>

              {/* Estado de configuración */}
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-amber-400 mb-3">📊 Estado Actual</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Total Sucursales</p>
                    <p className="text-2xl font-bold text-white">{stores.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Total Cajas</p>
                    <p className="text-2xl font-bold text-white">
                      {stores.reduce((sum, store) => sum + store.pos.length, 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-1">User ID</p>
                    <p className="text-sm font-mono text-green-400">{CONFIG.userId || 'No configurado'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de sucursales */}
            {storesLoading && (
              <div className="bg-gray-800 rounded-2xl border border-gray-700 p-12 text-center">
                <p className="text-gray-400">🔄 Cargando sucursales...</p>
              </div>
            )}

            {!storesLoading && stores.length === 0 && (
              <div className="bg-gray-800 rounded-2xl border border-gray-700 p-12 text-center">
                <div className="mb-4 text-6xl">🏪</div>
                <h3 className="text-xl font-bold text-white mb-2">No hay sucursales</h3>
                <p className="text-gray-400 mb-6">
                  Crea tu primera sucursal para comenzar a gestionar tus puntos de venta
                </p>
                <button
                  onClick={() => {
                    setEditingStore(null);
                    setShowStoreModal(true);
                  }}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold inline-flex items-center gap-2"
                >
                  ➕ Crear Primera Sucursal
                </button>
              </div>
            )}

            {!storesLoading && stores.length > 0 && (
              <div className="space-y-6">
                {stores.map((store: Store & { pos: POS[] }) => (
                  <div
                    key={store.id}
                    className="bg-gray-800 rounded-2xl border-2 border-gray-700 overflow-hidden hover:border-amber-600 transition-all"
                  >
                    {/* Header de la sucursal */}
                    <div className="bg-gradient-to-r from-amber-900/30 to-gray-800 p-6 border-b border-gray-700">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-3xl">🏪</span>
                            <h3 className="text-2xl font-bold text-white">{store.name}</h3>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p className="text-gray-300">
                              📍 {store.location.address_line}
                            </p>
                            {store.location.reference && (
                              <p className="text-gray-400 italic">
                                📝 {store.location.reference}
                              </p>
                            )}
                            <p className="text-gray-500">
                              <span className="text-gray-400">ID:</span> <span className="font-mono text-xs">{store.id}</span>
                            </p>
                            {store.external_id && (
                              <p className="text-gray-500">
                                <span className="text-gray-400">ID Externo:</span> <span className="font-mono text-xs">{store.external_id}</span>
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingStore(store);
                              setShowStoreModal(true);
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                          >
                            ✏️ Editar
                          </button>
                          <button
                            onClick={() => handleDeleteStore(store.id, store.name)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
                      </div>

                      {/* Horarios (resumido) */}
                      {store.business_hours && (
                        <div className="mt-4 pt-4 border-t border-gray-700">
                          <p className="text-sm text-gray-400 mb-2">🕐 Horarios de atención:</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(store.business_hours).map(([day, hours]) => {
                              if (!hours || hours.length === 0) return null;
                              const dayNames: Record<string, string> = {
                                monday: 'Lun',
                                tuesday: 'Mar',
                                wednesday: 'Mié',
                                thursday: 'Jue',
                                friday: 'Vie',
                                saturday: 'Sáb',
                                sunday: 'Dom',
                              };
                              return (
                                <span
                                  key={day}
                                  className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs"
                                >
                                  {dayNames[day]}: {hours[0].open}-{hours[0].close}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cajas de la sucursal */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
                          💰 Cajas ({store.pos.length})
                        </h4>
                        <button
                          onClick={() => {
                            setEditingPOS(null);
                            setEditingStore(store); // Para pasar el storeId preseleccionado
                            setShowPOSModal(true);
                          }}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                        >
                          ➕ Nueva Caja
                        </button>
                      </div>

                      {store.pos.length === 0 ? (
                        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-6 text-center">
                          <p className="text-gray-400 text-sm">
                            Esta sucursal no tiene cajas. Crea una para comenzar a operar.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {store.pos.map((pos: POS) => (
                            <div
                              key={pos.id}
                              className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 hover:border-amber-600 transition-all"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <h5 className="text-white font-semibold flex items-center gap-2">
                                    💳 {pos.name}
                                  </h5>
                                  <p className="text-xs text-gray-500 font-mono mt-1">
                                    ID: {pos.id}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400">Categoría:</span>
                                  <span className="text-gray-300">
                                    {pos.category ? getMCCCategoryName(pos.category) : '⚠️ No configurado'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400">MCC:</span>
                                  <span className={`font-mono text-xs ${pos.category ? 'text-gray-300' : 'text-yellow-400'}`}>
                                    {pos.category || '⚠️ Sin MCC'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-400">Monto fijo:</span>
                                  <span className={pos.fixed_amount ? 'text-green-400' : 'text-gray-500'}>
                                    {pos.fixed_amount ? '✓ Sí' : '✗ No'}
                                  </span>
                                </div>
                                {pos.external_id && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-400">ID Ext:</span>
                                    <span className="text-gray-300 font-mono text-xs">{pos.external_id}</span>
                                  </div>
                                )}
                                
                                {/* Mostrar Terminales/Devices */}
                                {(() => {
                                  const devices = (pos as any).devices;
                                  console.log(`🖥️ Renderizando devices para ${pos.name}:`, devices);
                                  
                                  if (!devices || devices.length === 0) {
                                    return (
                                      <div className="mt-3 pt-3 border-t border-gray-700">
                                        <p className="text-gray-500 text-xs italic">
                                          📱 Sin terminales asociadas
                                        </p>
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <div className="mt-3 pt-3 border-t border-gray-700">
                                      <p className="text-amber-400 text-xs font-semibold mb-2">
                                        📱 Terminales ({devices.length})
                                      </p>
                                      <div className="space-y-1">
                                        {devices.map((device: Device) => (
                                          <div key={device.id} className="flex items-center justify-between text-xs bg-gray-800/50 p-2 rounded">
                                            <span className="text-gray-300 font-mono truncate flex-1">
                                              {device.id}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ml-2 ${
                                              device.operating_mode === 'PDV' 
                                                ? 'bg-blue-900/50 text-blue-300' 
                                                : 'bg-purple-900/50 text-purple-300'
                                            }`}>
                                              {device.operating_mode}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>

                              <div className="mt-4 pt-4 border-t border-gray-700 flex gap-2">
                                <button
                                  onClick={() => {
                                    setEditingPOS(pos);
                                    setEditingStore(store);
                                    setShowPOSModal(true);
                                  }}
                                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleDeletePOS(pos.id, pos.name)}
                                  className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium"
                                >
                                  🗑️ Eliminar
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Información adicional */}
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6">
              <h4 className="text-blue-300 font-semibold mb-3">ℹ️ Información Importante</h4>
              <ul className="space-y-2 text-sm text-blue-200">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>
                    <strong>Jerarquía:</strong> Usuario → Sucursal → Caja → Terminal física
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>
                    <strong>No puedes eliminar</strong> una sucursal que tenga cajas asociadas. 
                    Elimina primero las cajas.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>
                    <strong>No puedes cambiar</strong> la sucursal de una caja existente. 
                    Debes crear una nueva caja en la otra sucursal.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span>
                    <strong>Las terminales físicas</strong> se asocian a las cajas mediante el panel de 
                    Mercado Pago o la API de dispositivos.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="tab-content bg-gray-800 rounded-2xl border border-gray-700 p-8 max-w-4xl">
            <h2 className="text-2xl font-bold text-white mb-6">Roles y Permisos</h2>
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg text-amber-400">Administrador</h3>
                <p className="text-sm text-gray-300 mt-2">Acceso completo al sistema: panel, configuración, gestión de usuarios y cierre de caja.</p>
              </div>
              <div>
                <h3 className="font-bold text-lg text-amber-400">Mesero</h3>
                <p className="text-sm text-gray-300 mt-2">Puede agregar pedidos y cobrar (con PIN), pero no puede eliminar items ni acceder a la configuración.</p>
              </div>
              <div>
                <h3 className="font-bold text-lg text-amber-400">Cocina</h3>
                <p className="text-sm text-gray-300 mt-2">Acceso al kanban de cocina para actualizar estados de preparación.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mercado Pago Terminal Modal para prueba */}
      {showTerminalModal && (
        <MercadoPagoTerminalModal
          isOpen={showTerminalModal}
          onClose={() => {
            setShowTerminalModal(false);
            if (testPaymentStatus === 'testing') {
              setTestPaymentStatus('error');
              setTestPaymentMessage('Pago cancelado por el usuario');
            }
          }}
          onSuccess={(paymentData) => {
            setShowTerminalModal(false);
            setTestPaymentStatus('success');
            setTestPaymentMessage('¡Pago de prueba exitoso! La terminal está funcionando correctamente.');
            setTestPaymentReferenceId(paymentData?.referenceId || '');
            toast.success('¡Terminal configurada correctamente!');
          }}
          onError={(error) => {
            setShowTerminalModal(false);
            setTestPaymentStatus('error');
            setTestPaymentMessage(error || 'Error al procesar el pago de prueba');
            toast.error('Error en la prueba de pago');
          }}
          amount={5.00}
          orderId="setting"
          waiterName={currentUser?.displayName || 'Admin'}
          userData={currentUser ? {
            id: currentUser.id,
            displayName: currentUser.displayName || 'Usuario',
            email: currentUser.email || '',
            role: currentUser.role || 'admin'
          } : undefined}
        />
      )}

      {/* Edit Terminal Name Modal */}
      {showEditNameModal && editingTerminal && (
        <EditTerminalNameModal
          isOpen={showEditNameModal}
          onClose={() => {
            setShowEditNameModal(false);
            setEditingTerminal(null);
          }}
          onSave={(name) => handleSaveTerminalName(editingTerminal.id, name)}
          currentName={editingTerminal.customName || editingTerminal.name}
          terminalId={editingTerminal.id}
        />
      )}

      {/* Store Modal (Create/Edit) */}
      {showStoreModal && (
        <StoreModal
          isOpen={showStoreModal}
          onClose={() => {
            setShowStoreModal(false);
            setEditingStore(null);
          }}
          onSuccess={() => {
            setShowStoreModal(false);
            setEditingStore(null);
            refreshStores();
          }}
          store={editingStore}
        />
      )}

      {/* POS Modal (Create/Edit) */}
      {showPOSModal && (
        <POSModal
          isOpen={showPOSModal}
          onClose={() => {
            setShowPOSModal(false);
            setEditingPOS(null);
            setEditingStore(null);
          }}
          onSuccess={() => {
            setShowPOSModal(false);
            setEditingPOS(null);
            setEditingStore(null);
            refreshStores();
          }}
          pos={editingPOS}
          stores={stores}
          preselectedStoreId={editingStore?.id}
        />
      )}
    </div>
  );
};

export default Settings;
