import React, { useState, useEffect, useMemo } from 'react';
import { getOrdersByDateRange, getProducts } from '../../services/firestoreService';
import type { Order, OrderItem, Product } from '../../utils/types';
import toast from 'react-hot-toast';
import { Search, Wine, X, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';

interface BottleSaleEntry {
  order: Order;
  item: OrderItem;
}

interface BottleGroup {
  name: string;
  totalQty: number;
  totalAmount: number;
  sales: BottleSaleEntry[];
}

const makeLocalDateInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseLocalDateInput = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const BottleSearch: React.FC = () => {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [startDate, setStartDate] = useState<string>(makeLocalDateInput(weekAgo));
  const [endDate, setEndDate] = useState<string>(makeLocalDateInput(today));
  const [orders, setOrders] = useState<Order[]>([]);
  const [bottleProducts, setBottleProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [bottleQuery, setBottleQuery] = useState('');
  const [expandedBottles, setExpandedBottles] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Load bottle products catalog (to also show bottles with 0 sales in range)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const res = await getProducts();
      if (mounted && res.success && res.data) {
        setBottleProducts(res.data.filter(p => p.category === 'Botella'));
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSearch = async () => {
    if (!startDate || !endDate) {
      toast.error('Selecciona un rango de fechas');
      return;
    }
    const start = parseLocalDateInput(startDate);
    const end = parseLocalDateInput(endDate);
    if (start > end) {
      toast.error('La fecha inicial no puede ser mayor a la final');
      return;
    }
    setLoading(true);
    try {
      const res = await getOrdersByDateRange(start, end);
      if (res.success && res.data) {
        setOrders(res.data);
        setSearched(true);
        setExpandedBottles([]);
      } else {
        toast.error(res.error || 'Error al buscar órdenes');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al buscar órdenes');
    } finally {
      setLoading(false);
    }
  };

  // Group every bottle sold by bottle name; include catalog bottles with 0 sales
  const bottleGroups: BottleGroup[] = useMemo(() => {
    const map: Record<string, BottleGroup> = {};

    // Seed with catalog so all bottles appear even without sales in range
    bottleProducts.forEach(p => {
      map[p.name] = { name: p.name, totalQty: 0, totalAmount: 0, sales: [] };
    });

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        if (item.isDeleted) return;
        if (item.category !== 'Botella') return;
        if (!map[item.productName]) {
          map[item.productName] = { name: item.productName, totalQty: 0, totalAmount: 0, sales: [] };
        }
        const group = map[item.productName];
        group.totalQty += item.quantity ?? 1;
        group.totalAmount += (item.productPrice ?? 0) * (item.quantity ?? 1);
        group.sales.push({ order, item });
      });
    });

    // Sort each bottle's sales most recent first
    Object.values(map).forEach(g => {
      g.sales.sort((a, b) => {
        const tA = new Date(a.item.createdAt || a.order.createdAt || 0).getTime();
        const tB = new Date(b.item.createdAt || b.order.createdAt || 0).getTime();
        return tB - tA;
      });
    });

    // Most sold first, then alphabetical
    return Object.values(map).sort((a, b) =>
      b.totalQty - a.totalQty || a.name.localeCompare(b.name)
    );
  }, [orders, bottleProducts]);

  const filteredGroups = useMemo(() => {
    const q = bottleQuery.trim().toLowerCase();
    if (!q) return bottleGroups;
    return bottleGroups.filter(g => g.name.toLowerCase().includes(q));
  }, [bottleGroups, bottleQuery]);

  const toggleExpanded = (name: string) => {
    setExpandedBottles(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const formatDateTime = (d?: Date) => {
    if (!d) return '-';
    const date = new Date(d);
    return `${date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const totalSold = filteredGroups.reduce((acc, g) => acc + g.totalQty, 0);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
        <Wine className="text-purple-400" size={30} /> Buscador de Botellas
      </h1>
      <p className="text-gray-400 mb-6">
        Busca una botella y ve en qué cuentas se vendió, con quién y cuándo.
      </p>

      {/* Filtros */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-5 mb-6">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              <CalendarDays size={12} className="inline mr-1" /> Desde
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-gray-900 text-white rounded-lg p-2.5 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent [color-scheme:dark]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              <CalendarDays size={12} className="inline mr-1" /> Hasta
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-gray-900 text-white rounded-lg p-2.5 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent [color-scheme:dark]"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-lg transition-colors"
          >
            <Search size={18} />
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {!searched ? (
        <div className="text-center py-16 text-gray-500">
          <Wine size={48} className="mx-auto mb-3 opacity-40" />
          <p>Selecciona un rango de fechas y presiona "Buscar" para ver las botellas vendidas.</p>
        </div>
      ) : loading ? (
        <div className="text-center py-8 text-gray-400">Cargando...</div>
      ) : (
        <>
          {/* Buscador de botella */}
          <div className="mb-4">
            <div className="relative w-full md:w-1/2">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={bottleQuery}
                onChange={e => setBottleQuery(e.target.value)}
                placeholder="Buscar botella... ej: Centenario"
                className="w-full bg-gray-800 text-white rounded-lg py-3 pl-10 pr-10 border border-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              {bottleQuery && (
                <button
                  onClick={() => setBottleQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {filteredGroups.length} botella{filteredGroups.length !== 1 ? 's' : ''} · {totalSold} vendida{totalSold !== 1 ? 's' : ''} en el rango
            </p>
          </div>

          {/* Lista de botellas */}
          {filteredGroups.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Wine size={48} className="mx-auto mb-3 opacity-40" />
              <p>No se encontró ninguna botella con "{bottleQuery}".</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map(group => {
                const expanded = expandedBottles.includes(group.name);
                const hasSales = group.sales.length > 0;
                return (
                  <div key={group.name} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                    {/* Header de la botella */}
                    <button
                      onClick={() => hasSales && toggleExpanded(group.name)}
                      className={`w-full flex items-center justify-between p-4 text-left transition-colors ${
                        hasSales ? 'hover:bg-gray-700/40 cursor-pointer' : 'cursor-default opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🍾</span>
                        <div>
                          <p className="font-bold text-white">{group.name}</p>
                          <p className="text-sm text-gray-400">
                            {hasSales
                              ? `${group.totalQty} vendida${group.totalQty !== 1 ? 's' : ''} en ${new Set(group.sales.map(s => s.order.id)).size} cuenta${new Set(group.sales.map(s => s.order.id)).size !== 1 ? 's' : ''}`
                              : 'Sin ventas en este rango'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {hasSales && (
                          <span className="text-purple-400 font-bold">${group.totalAmount.toFixed(2)}</span>
                        )}
                        {hasSales && (expanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />)}
                      </div>
                    </button>

                    {/* Cuentas donde se vendió */}
                    {expanded && hasSales && (
                      <div className="border-t border-gray-700 divide-y divide-gray-700/50">
                        {group.sales.map(({ order, item }) => (
                          <div
                            key={`${order.id}-${item.id}`}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 bg-gray-900/40"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-semibold">
                                {item.quantity}x · {order.tableNumber === 0 ? 'Barra' : `Mesa ${order.tableNumber ?? '-'}`}
                                {order.tableName && <span className="text-red-400 font-normal"> · 🏷️ {order.tableName}</span>}
                              </p>
                              <p className="text-xs text-gray-400">
                                Mesero: <span className="text-gray-300">{order.waiterName ?? '-'}</span>
                                {' · '}{formatDateTime(item.createdAt || order.createdAt)}
                                {' · '}Ticket <span className="font-mono">#{order.id?.slice(0, 6).toUpperCase()}</span>
                                {order.status === 'cortesia' && <span className="text-yellow-400"> · 🎁 Cortesía</span>}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-1.5 px-4 rounded-lg text-xs whitespace-nowrap self-start sm:self-auto"
                            >
                              Ver cuenta
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal detalle de cuenta */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-md m-4 border border-gray-700 relative flex flex-col max-h-[90vh]">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>
            <div className="p-8 overflow-y-auto flex-1">
              <div className="text-center mb-6 border-b border-gray-600 pb-6">
                <h2 className="text-2xl font-bold text-purple-400">Detalle de Cuenta</h2>
                <p className="text-lg font-semibold text-white mt-1">
                  Ticket #{selectedOrder.id?.slice(0, 6).toUpperCase()}
                </p>
                <p className="text-sm text-gray-400">
                  {formatDateTime(selectedOrder.completedAt || selectedOrder.createdAt)}
                </p>
                {selectedOrder.status === 'cortesia' && (
                  <p className="text-xs text-yellow-400 mt-1 font-semibold">🎁 Cortesía</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                <div>
                  <p className="text-sm text-gray-400">{selectedOrder.tableNumber === 0 ? 'Barra' : 'Mesa'}</p>
                  <p className="font-bold text-white text-lg">
                    {selectedOrder.tableNumber === 0 ? 'Principal' : (selectedOrder.tableNumber ?? '-')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Mesero</p>
                  <p className="font-bold text-white text-lg">{selectedOrder.waiterName ?? '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Personas</p>
                  <p className="font-bold text-white text-lg">{selectedOrder.peopleCount ?? 1}</p>
                </div>
              </div>
              {selectedOrder.tableName && (
                <p className="text-sm text-red-400 text-center mb-4">🏷️ {selectedOrder.tableName}</p>
              )}

              <div className="border-t border-b border-dashed border-gray-600 py-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-white">CANT. PRODUCTO</span>
                  <span className="font-semibold text-white">SUBTOTAL</span>
                </div>
                {(selectedOrder.items || []).filter(i => !i.isDeleted).map(it => (
                  <div
                    key={it.id}
                    className={`flex justify-between ${it.category === 'Botella' ? 'bg-purple-500/10 -mx-2 px-2 py-1 rounded' : ''}`}
                  >
                    <span className={it.category === 'Botella' ? 'text-purple-300 font-semibold' : 'text-gray-300'}>
                      {it.category === 'Botella' && '🍾 '}{it.quantity}x {it.productName}
                    </span>
                    <span className={it.category === 'Botella' ? 'text-purple-300 font-semibold' : 'text-gray-300'}>
                      ${((it.productPrice ?? 0) * (it.quantity ?? 1)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="py-6 space-y-2">
                <div className="flex justify-between items-center text-md">
                  <span className="text-gray-300">Subtotal:</span>
                  <span className="font-semibold text-white">${(selectedOrder.subtotal ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-2xl mt-2">
                  <span className="font-bold text-purple-400">TOTAL:</span>
                  <span className="font-bold text-purple-400">${(selectedOrder.total ?? 0).toFixed(2)}</span>
                </div>
                {selectedOrder.paymentMethod && (
                  <p className="text-sm text-gray-400 text-center pt-2">
                    Pago: <span className="text-white font-semibold capitalize">{selectedOrder.paymentMethod}</span>
                    {selectedOrder.payments?.[0]?.cashierName && (
                      <> · Cajero: <span className="text-white font-semibold">{selectedOrder.payments[0].cashierName}</span></>
                    )}
                  </p>
                )}
                {selectedOrder.adminComments && (
                  <p className="text-xs text-yellow-300/80 text-center pt-1">📝 {selectedOrder.adminComments}</p>
                )}
              </div>
            </div>
            <div className="p-6 bg-gray-900/50 rounded-b-2xl">
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-5 rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BottleSearch;
