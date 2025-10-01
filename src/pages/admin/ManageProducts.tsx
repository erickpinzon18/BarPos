import React, { useMemo, useState, useEffect } from 'react';
import { useProducts } from '../../hooks/useProducts';
import { addProduct, updateProduct, deleteProduct } from '../../services/firestoreService';
import type { ProductFormData, Product } from '../../utils/types';

const designCategories = ['Todos', 'Bebida', 'Entrada', 'Comida', 'Postre'];

const ManageProducts: React.FC = () => {
  const { products, loading } = useProducts(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('Agregar Nuevo Producto');
  const [form, setForm] = useState<ProductFormData>({ name: '', description: '', price: 0, category: 'Comida', available: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // (categories mapping removed - not used in this modal)

  useEffect(() => {
    // Reset form when modal closes
    if (!showModal) {
      setForm({ name: '', description: '', price: 0, category: 'Comida', available: true });
      setEditingId(null);
      setModalTitle('Agregar Nuevo Producto');
    }
  }, [showModal]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter(p => {
        if (activeCategory !== 'all') {
          // design categories are broader; match by substring
          return p.category.toLowerCase().includes(activeCategory.toLowerCase());
        }
        return true;
      })
      .filter(p => {
        if (!q) return true;
        return (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, search, activeCategory]);

  const openAddModal = () => {
    setModalTitle('Agregar Nuevo Producto');
    setEditingId(null);
    // mount modal and trigger animation
    setShowModal(true);
  };

  const openEditModal = (p: Product) => {
    setModalTitle('Editar Producto');
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description || '', price: p.price, category: p.category, available: p.available });
    // mount modal and trigger animation
    setShowModal(true);
  };

  const submitForm = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.name || !form.price) return alert('Nombre y precio requeridos');

    if (editingId) {
      const res = await updateProduct(editingId, { name: form.name, description: form.description, price: form.price, category: form.category, available: form.available });
      if (!res.success) alert(res.error || 'Error al actualizar');
    } else {
      const res = await addProduct(form as any);
      if (!res.success) alert(res.error || 'Error al crear producto');
    }
    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar producto? Esta acción no se puede deshacer.')) return;
    const res = await deleteProduct(id);
    if (!res.success) alert(res.error || 'Error al eliminar producto');
  };

  const generateDescription = async () => {
    // Placeholder: design had an IA button that calls an external API. We provide a simple fallback
    if (!form.name) return alert('Agrega el nombre primero');
    setAiLoading(true);
    try {
      // Fallback: create a short appetizing description programmatically
      const fallback = `${form.name} — delicioso y perfecto para compartir.`;
      // Simulate latency
      await new Promise(r => setTimeout(r, 600));
      setForm(prev => ({ ...prev, description: fallback }));
    } catch (err) {
      console.error('AI generate failed', err);
      setForm(prev => ({ ...prev, description: 'No se pudo generar descripción.' }));
    } finally {
      setAiLoading(false);
    }
  };

  // animation states for modal (mount + active for transitions)
  const [modalMounted, setModalMounted] = useState(false);
  const [modalActive, setModalActive] = useState(false);

  useEffect(() => {
    let enterTimer: any;
    let exitTimer: any;
    if (showModal) {
      setModalMounted(true);
      // small timeout to allow initial classes to apply before activating transition
      enterTimer = setTimeout(() => setModalActive(true), 20);
    } else {
      // start exit animation
      setModalActive(false);
      exitTimer = setTimeout(() => setModalMounted(false), 220);
    }
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [showModal]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar is handled by layout; this is the main content area */}
      <main className="flex-1 p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Gestión de Productos</h1>
            <p className="text-gray-400">Añade, edita y controla tu catálogo.</p>
          </div>
          <button onClick={openAddModal} className="w-full md:w-auto flex items-center justify-center bg-amber-500 text-gray-900 font-bold py-2.5 px-5 rounded-lg hover:bg-amber-600 transition">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            Agregar Producto
          </button>
        </div>

        <div className="mb-6 bg-gray-800 p-4 rounded-2xl border border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="search-product" className="sr-only">Buscar</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>
                <input id="search-product" type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full pl-10 p-2.5" placeholder="Buscar producto..." />
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {designCategories.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat === 'Todos' ? 'all' : cat)} className={`px-4 py-2 text-sm font-medium rounded-lg ${activeCategory === cat ? 'bg-[#f59e0b] text-black' : 'text-gray-300 bg-gray-700 hover:bg-gray-600'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div id="products-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (
            <div className="text-gray-400">Cargando productos...</div>
          ) : visibleProducts.length === 0 ? (
            <div className="text-gray-400">No hay productos</div>
          ) : (
            visibleProducts.map(p => (
              <div
                key={p.id}
                // card animations: scale on hover, smooth shadow and transform
                className="product-card bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden transform-gpu hover:scale-105 transition-transform duration-200 ease-out hover:shadow-xl cursor-pointer"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-white">{p.name}</h3>
                    <span className="bg-amber-400 text-gray-900 text-xs font-medium px-2.5 py-0.5 rounded-full">{p.category}</span>
                  </div>
                  {p.description && <p className="text-sm text-gray-400 mt-2">{p.description}</p>}
                  <div className="flex justify-between items-center mt-4">
                    <p className="text-xl font-semibold text-amber-400">${p.price.toFixed(2)}</p>
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEditModal(p)} className="font-medium text-blue-400 hover:underline text-sm">Editar</button>
                      <button onClick={() => handleDelete(p.id)} className="font-medium text-red-500 hover:underline text-sm">Eliminar</button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal */}
        {modalMounted && (
          <div
            id="product-modal"
            onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
            className={`fixed inset-0 z-50 overflow-y-auto modal-backdrop flex items-center justify-center p-4 transition-opacity duration-300 ${modalActive ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={!modalActive}
            style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          >
            <div className={`bg-gradient-to-b from-gray-900 via-gray-800 to-gray-800 rounded-2xl shadow-2xl w-full max-w-lg m-4 border border-gray-700 transition-all duration-300 ${modalActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                    </div>
                    <h3 id="product-modal-title" className="text-xl font-bold text-white">{modalTitle}</h3>
                  </div>
                  <button onClick={() => setShowModal(false)} id="close-product-modal-btn" aria-label="Cerrar modal" className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
                <form id="product-form" onSubmit={submitForm} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="product-name" className="block mb-2 text-sm font-medium text-gray-300">Nombre del Producto</label>
                    <input id="product-name" type="text" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-opacity-60 block w-full p-2.5" placeholder="Ej: Margarita de Fresa" required />
                  </div>
                  <div>
                    <label htmlFor="product-description" className="block mb-2 text-sm font-medium text-gray-300">Descripción</label>
                    <div className="relative">
                      <textarea id="product-description" rows={3} value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-opacity-60 block w-full p-2.5" placeholder="Describe el producto..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="product-category" className="block mb-2 text-sm font-medium text-gray-300">Categoría</label>
                      <select id="product-category" value={form.category} onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value as any }))} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-opacity-60 block w-full p-2.5">
                        <option>Bebida</option>
                        <option>Entrada</option>
                        <option>Comida</option>
                        <option>Postre</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="product-price" className="block mb-2 text-sm font-medium text-gray-300">Precio ($)</label>
                      <input id="product-price" type="number" value={form.price === 0 ? '' : form.price} onChange={(e) => setForm(prev => ({ ...prev, price: Number(e.target.value) }))} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-opacity-60 block w-full p-2.5" placeholder="150.00" required />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="flex items-center space-x-2 cursor-pointer"><input id="product-available" type="checkbox" checked={form.available} onChange={(e) => setForm(prev => ({ ...prev, available: e.target.checked }))} className="h-4 w-4 rounded bg-gray-600 border-gray-500 text-amber-500 focus:ring-amber-500" /> <span className="text-sm text-gray-300">Disponible</span></label>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 gap-3">
                    <button type="button" id="cancel-product-modal-btn" onClick={() => setShowModal(false)} className="text-gray-300 bg-gray-700 hover:bg-gray-600 font-medium rounded-lg text-sm px-5 py-2.5">Cancelar</button>
                    <button type="submit" id="product-modal-action-btn" className="text-gray-900 bg-amber-500 hover:bg-amber-600 font-bold rounded-lg text-sm px-5 py-2.5 shadow-md transform hover:-translate-y-px transition">{editingId ? 'Guardar Cambios' : 'Guardar Producto'}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ManageProducts;
