import React, { useState, useEffect } from 'react';
import { getConfig, saveConfig, requestDisableUser, getUsers, addUserClient } from '../../services/firestoreService';
import { auth } from '../../services/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import toast from 'react-hot-toast';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'roles'>('info');
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
    </div>
  );
};

export default Settings;
