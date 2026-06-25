// src/pages/admin/Promotions.tsx
import React, { useState, useMemo } from 'react';
import { usePromotions, isPromotionWithinSchedule } from '../../hooks/usePromotions';
import { addPromotion, updatePromotion, deletePromotion } from '../../services/firestoreService';
import { CATEGORIES } from '../../utils/categories';
import { useProducts } from '../../hooks/useProducts';
import type { Promotion, DiscountType } from '../../utils/types';
import type { CategoryKey } from '../../utils/categories';
import { Plus, Pencil, Trash2, Clock, Tag, X, Check, AlertTriangle, ChevronDown, ChevronUp, Package, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';

// 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatActiveDays = (days?: number[]): string => {
  if (!days || days.length === 0) return 'Todos los días';
  if (days.length === 7) return 'Todos los días';
  return days.map(d => DAY_LABELS[d]).join(', ');
};

// --- Form state shape ---
interface PromoForm {
  name: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  categories: CategoryKey[];
  /** IDs específicos de productos. Vacío = todos los productos de las categorías seleccionadas */
  productIds: string[];
  cutoffTime: string;
  /** Días de la semana activos (0=Dom…6=Sáb). Vacío = todos los días */
  activeDays: number[];
  active: boolean;
}

const emptyForm: PromoForm = {
  name: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  categories: [],
  productIds: [],
  cutoffTime: '23:59',
  activeDays: [],
  active: true,
};

const discountTypeLabels: Record<DiscountType, string> = {
  percentage: 'Porcentaje (%)',
  fixed: 'Monto fijo ($)',
  '2x1': '2x1',
  nxprice: 'N x Precio',
  fixedprice: 'Precio Fijo x Unidad',
};

const Promotions: React.FC = () => {
  const { promotions, loading, refresh } = usePromotions();
  const { products: allProducts } = useProducts(false); // todos los productos (incl. no disponibles)
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromoForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Categorías expandidas en el selector de productos
  const [expandedCats, setExpandedCats] = useState<CategoryKey[]>([]);

  // ---- helpers ----
  const openCreateModal = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowModal(true);
  };

  const openEditModal = (promo: Promotion) => {
    setEditingId(promo.id);
    setForm({
      name: promo.name,
      description: promo.description ?? '',
      discountType: promo.discountType,
      discountValue: String(promo.discountValue),
      categories: promo.categories ?? [],
      productIds: promo.productIds ?? [],
      cutoffTime: promo.cutoffTime ?? '23:59',
      activeDays: promo.activeDays ?? [],
      active: promo.active,
    });
    setExpandedCats([]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setExpandedCats([]);
  };

  const toggleCategory = (key: CategoryKey) => {
    setForm(prev => {
      const removing = prev.categories.includes(key);
      // Al quitar una categoría, eliminar también sus productos del filtro
      const newProductIds = removing
        ? prev.productIds.filter(pid => {
            const p = allProducts.find(pr => pr.id === pid);
            return p?.category !== key;
          })
        : prev.productIds;
      return {
        ...prev,
        categories: removing
          ? prev.categories.filter(c => c !== key)
          : [...prev.categories, key],
        productIds: newProductIds,
      };
    });
  };

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      activeDays: prev.activeDays.includes(day)
        ? prev.activeDays.filter(d => d !== day)
        : [...prev.activeDays, day].sort(),
    }));
  };

  const toggleProduct = (productId: string) => {
    setForm(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter(id => id !== productId)
        : [...prev.productIds, productId],
    }));
  };

  const toggleExpandCat = (key: CategoryKey) => {
    setExpandedCats(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Productos agrupados por las categorías seleccionadas en el form
  const productsBySelectedCat = useMemo(() => {
    const map: Record<string, typeof allProducts> = {};
    for (const cat of form.categories) {
      map[cat] = allProducts.filter(p => p.category === cat);
    }
    return map;
  }, [form.categories, allProducts]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    const discountValue = parseFloat(form.discountValue);
    if (isNaN(discountValue) || discountValue < 0) {
      toast.error('Valor de descuento inválido');
      return;
    }
    if (!form.cutoffTime) {
      toast.error('La hora de corte es obligatoria');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        discountType: form.discountType,
        discountValue,
        categories: form.categories,
        productIds: form.productIds,
        cutoffTime: form.cutoffTime,
        activeDays: form.activeDays,
        active: form.active,
      };

      if (editingId) {
        const res = await updatePromotion(editingId, payload);
        if (!res.success) throw new Error(res.error);
        toast.success('Promoción actualizada');
      } else {
        const res = await addPromotion(payload as any);
        if (!res.success) throw new Error(res.error);
        toast.success('Promoción creada');
      }
      closeModal();
      await refresh();
    } catch (err: any) {
      console.error('Error saving promotion:', err);
      toast.error(err?.message || 'Error al guardar promoción');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await deletePromotion(id);
      if (!res.success) throw new Error(res.error);
      toast.success('Promoción eliminada');
      await refresh();
    } catch (err: any) {
      console.error('Error deleting promotion:', err);
      toast.error(err?.message || 'Error al eliminar promoción');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (promo: Promotion) => {
    try {
      const res = await updatePromotion(promo.id, { active: !promo.active });
      if (!res.success) throw new Error(res.error);
      toast.success(promo.active ? 'Promoción desactivada' : 'Promoción activada');
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Error al actualizar');
    }
  };

  // ---- render ----
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Cargando promociones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Promociones</h1>
          <p className="text-gray-400 mt-1">Gestiona las promociones del negocio y sus horarios de vigencia.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-5 rounded-lg text-sm transition transform hover:-translate-y-px shadow-lg"
        >
          <Plus size={18} />
          Nueva Promoción
        </button>
      </div>

      {/* Grid de Promociones */}
      {promotions.length === 0 ? (
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-16 text-center">
          <Tag className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Sin Promociones</h3>
          <p className="text-gray-400 mb-6">Aún no has creado ninguna promoción. Crea una para ofrecer descuentos a tus clientes.</p>
          <button
            onClick={openCreateModal}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition"
          >
            Crear Primera Promoción
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {promotions.map(promo => {
            const withinSchedule = isPromotionWithinSchedule(promo.cutoffTime);
            const isAvailable = promo.active && withinSchedule;

            return (
              <div
                key={promo.id}
                className={`bg-gray-800 rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                  isAvailable
                    ? 'border-green-600/50 shadow-green-900/20'
                    : promo.active
                    ? 'border-amber-600/50 shadow-amber-900/20'
                    : 'border-gray-700 opacity-70'
                }`}
              >
                {/* Card Header */}
                <div className={`px-5 py-4 border-b ${
                  isAvailable
                    ? 'border-green-700/50 bg-gradient-to-r from-green-900/30 to-transparent'
                    : promo.active
                    ? 'border-amber-700/50 bg-gradient-to-r from-amber-900/30 to-transparent'
                    : 'border-gray-700 bg-gray-800/50'
                }`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white truncate flex-1">{promo.name}</h3>
                    <div className="flex items-center gap-2 ml-3">
                      {/* Status badge */}
                      {isAvailable ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 flex items-center gap-1">
                          <Check size={12} />
                          Activa
                        </span>
                      ) : promo.active && !withinSchedule ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          Fuera de horario
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-600/30 text-gray-400">
                          Inactiva
                        </span>
                      )}
                    </div>
                  </div>
                  {promo.description && (
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{promo.description}</p>
                  )}
                </div>

                {/* Card Body */}
                <div className="px-5 py-4 space-y-4">
                  {/* Discount Info */}
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                      isAvailable
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {promo.discountType === 'percentage' ? '%' : promo.discountType === '2x1' ? '2x1' : promo.discountType === 'fixedprice' ? '$' : '$'}
                    </div>
                    <div>
                      <p className="text-white font-semibold">
                        {promo.discountType === 'percentage' && `${promo.discountValue}% de descuento`}
                        {promo.discountType === 'fixed' && `$${promo.discountValue} de descuento`}
                        {promo.discountType === '2x1' && `2x1`}
                        {promo.discountType === 'nxprice' && `N x $${promo.discountValue}`}
                        {promo.discountType === 'fixedprice' && `Precio fijo $${promo.discountValue}/u`}
                      </p>
                      <p className="text-xs text-gray-500">{discountTypeLabels[promo.discountType]}</p>
                    </div>
                  </div>

                  {/* Cutoff Time */}
                  <div className="flex items-center gap-3 bg-gray-900/50 rounded-lg p-3">
                    <Clock size={18} className={withinSchedule ? 'text-green-400' : 'text-amber-400'} />
                    <div>
                      <p className="text-sm text-gray-300">
                        Disponible hasta las <span className="font-bold text-white">{promo.cutoffTime}</span> hrs
                      </p>
                      {!withinSchedule && (
                        <p className="text-xs text-amber-400 mt-0.5">⚠️ Ya pasó la hora de corte. No se puede aplicar hoy.</p>
                      )}
                    </div>
                  </div>

                  {/* Active Days */}
                  {promo.activeDays && promo.activeDays.length > 0 && promo.activeDays.length < 7 && (
                    <div className="flex items-center gap-2 bg-gray-900/50 rounded-lg px-3 py-2">
                      <CalendarDays size={15} className="text-amber-400 shrink-0" />
                      <span className="text-sm text-gray-300">
                        Solo: <span className="font-semibold text-amber-300">{formatActiveDays(promo.activeDays)}</span>
                      </span>
                    </div>
                  )}

                  {/* Categories + Products summary */}
                  {promo.categories && promo.categories.length > 0 ? (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Aplica a:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {promo.categories.map(cat => {
                          const catInfo = CATEGORIES.find(c => c.key === cat);
                          return (
                            <span
                              key={cat}
                              className="px-2 py-1 rounded-md text-xs font-medium bg-gray-700 text-gray-300"
                            >
                              {catInfo?.icon} {catInfo?.label ?? cat}
                            </span>
                          );
                        })}
                      </div>
                      {promo.productIds && promo.productIds.length > 0 && (
                        <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                          <Package size={11} />
                          Solo {promo.productIds.length} producto{promo.productIds.length !== 1 ? 's' : ''} específico{promo.productIds.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">Aplica a <span className="text-gray-300 font-medium">todos los productos</span></p>
                  )}
                </div>

                {/* Card Footer - Actions */}
                <div className="px-5 py-3 border-t border-gray-700 flex items-center justify-between bg-gray-800/50">
                  <button
                    onClick={() => handleToggleActive(promo)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition ${
                      promo.active
                        ? 'text-amber-400 hover:bg-amber-500/10'
                        : 'text-green-400 hover:bg-green-500/10'
                    }`}
                  >
                    {promo.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(promo)}
                      className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition"
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(promo.id)}
                      disabled={deletingId === promo.id}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition disabled:opacity-50"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Create/Edit Modal ---- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white">
                {editingId ? 'Editar Promoción' : 'Nueva Promoción'}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-700 rounded-lg transition">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Happy Hour, Noche de Shots..."
                  className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-4 py-2.5 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Descripción (opcional)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción breve de la promoción..."
                  rows={2}
                  className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-4 py-2.5 focus:ring-red-500 focus:border-red-500 resize-none"
                />
              </div>

              {/* Discount Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo de Descuento</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(discountTypeLabels) as DiscountType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, discountType: type }))}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
                        form.discountType === type
                          ? 'bg-red-600 text-white ring-2 ring-red-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {discountTypeLabels[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount Value */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  {form.discountType === 'percentage' ? 'Porcentaje (%)' :
                   form.discountType === '2x1' ? 'Valor (no aplica)' :
                   form.discountType === 'fixedprice' ? 'Precio Fijo por Unidad ($)' :
                   'Monto ($)'}
                </label>
                {form.discountType === 'fixedprice' && (
                  <p className="text-xs text-blue-400 mb-1.5">
                    💡 Todos los productos seleccionados se cobrarán a este precio, sin importar su precio original.
                  </p>
                )}
                <input
                  type="number"
                  min="0"
                  max={form.discountType === 'percentage' ? 100 : undefined}
                  step="0.01"
                  value={form.discountValue}
                  onChange={e => setForm(prev => ({ ...prev, discountValue: e.target.value }))}
                  placeholder={form.discountType === 'percentage' ? '10' : form.discountType === 'fixedprice' ? '1000' : '50'}
                  disabled={form.discountType === '2x1'}
                  className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-4 py-2.5 focus:ring-red-500 focus:border-red-500 disabled:opacity-50"
                />
              </div>

              {/* Cutoff Time - THE KEY FEATURE */}
              <div className="bg-gradient-to-br from-red-900/30 to-amber-900/20 border border-red-600/40 rounded-xl p-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-red-400 mb-2">
                  <Clock size={16} />
                  Hora Límite de Aplicación *
                </label>
                <input
                  type="time"
                  value={form.cutoffTime}
                  onChange={e => setForm(prev => ({ ...prev, cutoffTime: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 text-white text-sm rounded-lg px-4 py-3 focus:ring-red-500 focus:border-red-500 [color-scheme:dark]"
                />
                <p className="text-xs text-gray-400 mt-2">
                  Después de esta hora, la promoción <span className="text-amber-400 font-semibold">NO podrá ser aplicada</span> aunque esté activa.
                  Por ejemplo, si pones 18:00, después de las 6pm ya no podrán agregar esta promoción a ninguna cuenta.
                </p>
              </div>

              {/* Active Days */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <CalendarDays size={15} />
                  Días activos
                  <span className="text-xs text-gray-500">(vacío = todos los días)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((label, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => toggleDay(index)}
                      className={`w-12 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        form.activeDays.includes(index)
                          ? 'bg-red-600 text-white ring-1 ring-red-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {form.activeDays.length > 0 && (
                  <p className="text-xs text-amber-400 mt-2">
                    Solo aplica los: {formatActiveDays(form.activeDays)}
                  </p>
                )}
              </div>

              {/* Categories + Products */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">
                  Categorías que aplica
                  <span className="text-xs text-gray-500 ml-2">(vacío = todas)</span>
                </label>

                {/* Category chips */}
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => toggleCategory(cat.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        form.categories.includes(cat.key)
                          ? 'bg-red-600 text-white ring-1 ring-red-400'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                {/* Per-category product accordion */}
                {form.categories.length > 0 && (
                  <div className="space-y-2 mt-1">
                    {form.categories.map(catKey => {
                      const catInfo = CATEGORIES.find(c => c.key === catKey)!;
                      const catProducts = productsBySelectedCat[catKey] ?? [];
                      const isExpanded = expandedCats.includes(catKey);
                      const selectedInCat = form.productIds.filter(pid =>
                        catProducts.some(p => p.id === pid)
                      );
                      const allSelected = catProducts.length > 0 && selectedInCat.length === catProducts.length;
                      const someSelected = selectedInCat.length > 0 && !allSelected;

                      return (
                        <div key={catKey} className="border border-gray-700 rounded-xl overflow-hidden">
                          {/* Accordion header */}
                          <button
                            type="button"
                            onClick={() => toggleExpandCat(catKey)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-700/60 hover:bg-gray-700 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2 text-sm font-medium text-white">
                              <span>{catInfo.icon}</span>
                              <span>{catInfo.label}</span>
                              {selectedInCat.length > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
                                  {selectedInCat.length}/{catProducts.length} productos
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">
                                  Todos
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-gray-400">
                              <Package size={14} />
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                          </button>

                          {/* Accordion body */}
                          {isExpanded && (
                            <div className="bg-gray-900/50 px-4 py-3">
                              {catProducts.length === 0 ? (
                                <p className="text-xs text-gray-500">Sin productos en esta categoría.</p>
                              ) : (
                                <>
                                  {/* Select all / none */}
                                  <div className="flex gap-2 mb-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        // Deselect all products of this cat, meaning "apply to all"
                                        setForm(prev => ({
                                          ...prev,
                                          productIds: prev.productIds.filter(pid =>
                                            !catProducts.some(p => p.id === pid)
                                          ),
                                        }));
                                      }}
                                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${!someSelected && !allSelected ? 'bg-green-600/30 text-green-400 ring-1 ring-green-600' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                    >
                                      ✓ Todos
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const ids = catProducts.map(p => p.id);
                                        setForm(prev => ({
                                          ...prev,
                                          productIds: [
                                            ...prev.productIds.filter(pid => !ids.includes(pid)),
                                            ...ids,
                                          ],
                                        }));
                                      }}
                                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors"
                                    >
                                      Seleccionar todos
                                    </button>
                                  </div>

                                  {/* Individual products */}
                                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                    {catProducts.map(product => {
                                      const isChecked = form.productIds.includes(product.id);
                                      return (
                                        <button
                                          key={product.id}
                                          type="button"
                                          onClick={() => toggleProduct(product.id)}
                                          className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                                            isChecked
                                              ? 'bg-red-600/20 text-white ring-1 ring-red-500/50'
                                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                          }`}
                                        >
                                          <div>
                                            <span className="font-medium">{product.name}</span>
                                            <span className="ml-2 text-xs text-gray-500">${product.price.toFixed(2)}</span>
                                            {!product.available && (
                                              <span className="ml-2 text-xs text-amber-500">No disponible</span>
                                            )}
                                          </div>
                                          {isChecked && <Check size={14} className="text-red-400 flex-shrink-0" />}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {someSelected && (
                                    <p className="text-xs text-amber-400 mt-2">
                                      ⚡ La promoción solo aplica a los {selectedInCat.length} productos seleccionados.
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-green-500' : 'bg-gray-600'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.active ? 'translate-x-5' : ''}`}></div>
                  </div>
                </div>
                <span className="text-sm text-gray-300">{form.active ? 'Promoción activa' : 'Promoción inactiva'}</span>
              </label>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={closeModal}
                className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium text-sm transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Promoción'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Promotions;
